import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { DATABASE } from '../database/database.constants.js';
import type { Database, DatabaseExecutor } from '../database/database.types.js';
import {
  auditEvents,
  campaignProspectAssignments,
  campaigns,
  organizations,
  teams,
  tenantMemberships,
  tenants,
} from '../database/schema/index.js';
import type { GeographicAllocationDto } from './allocation.dto.js';
type Candidate = {
  territory_id: string;
  responsibility_id: string;
  priority: number;
  team_id: string;
  membership_id: string | null;
  capacity: number | null;
  workload: number;
  team_capacity: number;
  team_workload: number;
};
type Decision = {
  prospectId: string;
  outcome: string;
  teamId?: string;
  membershipId?: string | null;
  territoryId?: string;
  responsibilityId?: string;
  assignmentId?: string;
};
@Injectable()
export class GeographicAllocationService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}
  async authorize(
    auth: AuthenticatedPrincipal,
    campaignId: string,
    tx: DatabaseExecutor = this.db,
  ) {
    const result = await tx.execute<{
      organization_id: string;
      status: string;
    }>(sql`SELECT c.organization_id,c.status FROM campaigns c WHERE c.tenant_id=${auth.tenantId} AND c.id=${campaignId}
      AND EXISTS(SELECT 1 FROM user_access_grants g WHERE g.tenant_id=c.tenant_id AND g.user_id=${auth.membershipId}
      AND ((g.role='client_admin' AND g.scope_type='tenant') OR (g.role='director' AND g.scope_type='organization' AND g.organization_id=c.organization_id))
      AND (NOT EXISTS(SELECT 1 FROM tenant_role_permissions p WHERE p.tenant_id=g.tenant_id AND p.role=CASE WHEN g.role='client_admin' THEN 'tenant_admin' ELSE g.role::text END)
      OR EXISTS(SELECT 1 FROM tenant_role_permissions p WHERE p.tenant_id=g.tenant_id AND p.role=CASE WHEN g.role='client_admin' THEN 'tenant_admin' ELSE g.role::text END AND p.permissions ? 'assignments.manage')))`);
    if (!result.rows[0])
      throw new ForbiddenException('Campaign-wide assignment management permission required');
    return result.rows[0];
  }
  async run(
    auth: AuthenticatedPrincipal,
    campaignId: string,
    input: GeographicAllocationDto,
    apply: boolean,
  ) {
    return this.db.transaction(async (tx) => {
      // Also serialize with permissions, territory/link and participation writers.
      await tx
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.id, auth.tenantId))
        .for('no key update');
      const authority = await this.authorize(auth, campaignId, tx);
      const [campaign] = await tx
        .select()
        .from(campaigns)
        .where(and(eq(campaigns.tenantId, auth.tenantId), eq(campaigns.id, campaignId)))
        .for('share');
      if (!campaign || ['completed', 'archived'].includes(campaign.status))
        throw new ConflictException('Campaign is no longer assignable');
      const [org] = await tx
        .select()
        .from(organizations)
        .where(
          and(
            eq(organizations.tenantId, auth.tenantId),
            eq(organizations.id, authority.organization_id),
          ),
        )
        .for('share');
      if (org?.status !== 'active')
        throw new ConflictException('Campaign organization is inactive');
      // Team locks serialize with manual assignment writers, which lock the team
      // before membership capacity. Stable ordering avoids cross-batch deadlocks.
      await tx
        .select({ id: teams.id })
        .from(teams)
        .where(
          and(eq(teams.tenantId, auth.tenantId), eq(teams.organizationId, campaign.organizationId)),
        )
        .orderBy(teams.id)
        .for('update');
      const ids = input.prospectIds.map((id) => id.toLowerCase()).sort();
      const idList = sql.join(
        ids.map((id) => sql`${id}::uuid`),
        sql`, `,
      );
      const prospects = await tx.execute<{
        id: string;
        status: string;
        establishment_status: string;
        has_location: boolean;
      }>(sql`SELECT cp.id,cp.status,e.status AS establishment_status,e.location IS NOT NULL AS has_location
        FROM campaign_prospects cp JOIN establishments e ON e.tenant_id=cp.tenant_id AND e.id=cp.establishment_id
        WHERE cp.tenant_id=${auth.tenantId} AND cp.campaign_id=${campaignId} AND cp.id IN (${idList}) ORDER BY cp.id FOR NO KEY UPDATE OF cp FOR SHARE OF e`);
      if (prospects.rows.length !== ids.length)
        throw new NotFoundException('One or more campaign prospects were not found');
      // Lock all potentially targeted memberships before computing capacities.
      const memberIds = await tx.execute<{ id: string }>(
        sql`SELECT DISTINCT g.user_id AS id FROM user_access_grants g JOIN teams t ON t.tenant_id=g.tenant_id AND t.id=g.team_id WHERE g.tenant_id=${auth.tenantId} AND t.organization_id=${campaign.organizationId} AND g.role='prospector' AND g.scope_type='team'`,
      );
      if (memberIds.rows.length)
        await tx
          .select({ id: tenantMemberships.id })
          .from(tenantMemberships)
          .where(
            and(
              eq(tenantMemberships.tenantId, auth.tenantId),
              inArray(
                tenantMemberships.id,
                memberIds.rows.map((r) => r.id),
              ),
            ),
          )
          .orderBy(tenantMemberships.id)
          .for('update');
      const addedMembers = new Map<string, number>(),
        addedTeams = new Map<string, number>();
      const decisions: Decision[] = [];
      for (const prospect of prospects.rows) {
        const skip = (outcome: string) => decisions.push({ prospectId: prospect.id, outcome });
        const current = await tx
          .select({ id: campaignProspectAssignments.id })
          .from(campaignProspectAssignments)
          .where(
            and(
              eq(campaignProspectAssignments.tenantId, auth.tenantId),
              eq(campaignProspectAssignments.campaignProspectId, prospect.id),
              sql`${campaignProspectAssignments.endedAt} IS NULL`,
            ),
          );
        if (current.length) {
          skip('already_assigned');
          continue;
        }
        if (prospect.status !== 'active' || prospect.establishment_status !== 'active') {
          skip('inactive_prospect');
          continue;
        }
        if (!prospect.has_location) {
          skip('missing_coordinates');
          continue;
        }
        const candidates = await tx.execute<Candidate>(sql`WITH matching AS (
          SELECT ta.id AS responsibility_id,ta.territory_id,ta.priority,ta.team_id,ta.membership_id FROM territory_assignments ta
          JOIN territories tr ON tr.tenant_id=ta.tenant_id AND tr.id=ta.territory_id
          JOIN campaign_territories ct ON ct.tenant_id=tr.tenant_id AND ct.territory_id=tr.id AND ct.campaign_id=${campaignId}
          JOIN campaign_prospects cp ON cp.tenant_id=ta.tenant_id AND cp.id=${prospect.id}
          JOIN establishments e ON e.tenant_id=cp.tenant_id AND e.id=cp.establishment_id
          WHERE ta.tenant_id=${auth.tenantId} AND tr.status='active' AND tr.boundary IS NOT NULL AND ST_Covers(tr.boundary,e.location)
            AND ta.revoked_at IS NULL AND ta.starts_at <= clock_timestamp() AND (ta.ends_at IS NULL OR ta.ends_at > clock_timestamp())
        ), targets AS (
          SELECT m.*,m.team_id AS target_team FROM matching m WHERE m.team_id IS NOT NULL
          UNION ALL
          SELECT m.*,g.team_id AS target_team FROM matching m JOIN user_access_grants g ON g.tenant_id=${auth.tenantId} AND g.user_id=m.membership_id AND g.role='prospector' AND g.scope_type='team' WHERE m.membership_id IS NOT NULL
        ) SELECT DISTINCT x.territory_id,x.responsibility_id,x.priority,t.id AS team_id,x.membership_id,ms.capacity,
          (SELECT count(*)::integer FROM campaign_prospect_assignments a WHERE a.tenant_id=${auth.tenantId} AND a.assigned_user_id=x.membership_id AND a.ended_at IS NULL) AS workload,
          COALESCE(ts.capacity,100) AS team_capacity,
          (SELECT count(*)::integer FROM campaign_prospect_assignments a WHERE a.tenant_id=${auth.tenantId} AND a.team_id=t.id AND a.ended_at IS NULL) AS team_workload
          FROM targets x JOIN teams t ON t.tenant_id=${auth.tenantId} AND t.id=x.target_team AND t.organization_id=${campaign.organizationId} AND t.status='active'
          LEFT JOIN team_settings ts ON ts.tenant_id=t.tenant_id AND ts.team_id=t.id
          LEFT JOIN tenant_memberships m ON m.tenant_id=t.tenant_id AND m.id=x.membership_id
          LEFT JOIN identities i ON i.id=m.identity_id
          LEFT JOIN membership_settings ms ON ms.tenant_id=m.tenant_id AND ms.membership_id=m.id
          WHERE x.membership_id IS NULL OR (m.status='active' AND i.status='active')
          ORDER BY x.priority,x.territory_id,x.responsibility_id,t.id`);
        if (!candidates.rows.length) {
          skip('no_eligible_responsibility');
          continue;
        }
        const candidate = candidates.rows.find(
          (c) =>
            c.team_workload + (apply ? 0 : (addedTeams.get(c.team_id) ?? 0)) < c.team_capacity &&
            (!c.membership_id ||
              c.capacity === null ||
              c.workload + (apply ? 0 : (addedMembers.get(c.membership_id) ?? 0)) < c.capacity),
        );
        if (!candidate) {
          skip('capacity_exhausted');
          continue;
        }
        const decision: Decision = {
          prospectId: prospect.id,
          outcome: apply ? 'assigned' : 'proposed',
          teamId: candidate.team_id,
          membershipId: candidate.membership_id,
          territoryId: candidate.territory_id,
          responsibilityId: candidate.responsibility_id,
        };
        if (apply) {
          const [assignment] = await tx
            .insert(campaignProspectAssignments)
            .values({
              tenantId: auth.tenantId,
              campaignId,
              campaignProspectId: prospect.id,
              organizationId: campaign.organizationId,
              teamId: candidate.team_id,
              assignedUserId: candidate.membership_id,
            })
            .onConflictDoNothing()
            .returning();
          if (!assignment) {
            skip('already_assigned');
            continue;
          }
          decision.assignmentId = assignment.id;
          await tx.insert(auditEvents).values({
            tenantId: auth.tenantId,
            actorType: 'user',
            actorUserId: auth.membershipId,
            resourceType: 'campaign_prospect',
            resourceId: prospect.id,
            action: 'assignment.assigned',
            metadata: {
              ...decision,
              campaignId,
              organizationId: campaign.organizationId,
              source: 'geographic_allocation',
              priority: candidate.priority,
            },
          });
        } else {
          addedTeams.set(candidate.team_id, (addedTeams.get(candidate.team_id) ?? 0) + 1);
          if (candidate.membership_id)
            addedMembers.set(
              candidate.membership_id,
              (addedMembers.get(candidate.membership_id) ?? 0) + 1,
            );
        }
        decisions.push(decision);
      }
      return {
        campaignId,
        mode: apply ? 'apply' : 'preview',
        decisions,
        assigned: decisions.filter((d) => d.outcome === 'assigned').length,
        proposed: decisions.filter((d) => d.outcome === 'proposed').length,
        skipped: decisions.filter((d) => !['assigned', 'proposed'].includes(d.outcome)).length,
      };
    });
  }
}
