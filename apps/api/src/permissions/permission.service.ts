import { enforceScopeDenials } from './scope-denial-policy.js';
import {
  DOMAIN_PERMISSIONS,
  enforceDomainRestriction,
  requestDomainPermission,
} from './domain-permissions.js';
import { consentAccess } from '../consents/consent-access.js';
import { ConflictException } from '@nestjs/common';
import { campaignOrganizationAccess } from '../campaign-organizations/organization-access.js';
import { activeRoster } from '../organization-structure/structure-access.js';
import { teamMemberships } from '../database/schema/organization-structure.js';
import { activeParticipationPredicate } from '../resource-scopes/participation-access.js';
import { campaignMembers, territoryAssignments, territories } from '../database/schema/index.js';
import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { DATABASE } from '../database/database.constants.js';
import { Database, DatabaseExecutor } from '../database/database.types.js';
import {
  campaigns,
  membershipResourceScopes,
  campaignProspectAssignments,
  teams,
  tenantRolePermissions,
  userAccessGrants,
} from '../database/schema/index.js';
import { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { PERMISSIONS, publicRole, type ConfigurablePermission } from './permission-catalogue.js';
type Scope = { organizationId?: string; teamId?: string };
type RequestContext = {
  method?: string;
  routeOptions?: { url?: string };
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
};
const uuid = (value: unknown): string | undefined =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ? value
    : undefined;
@Injectable()
export class PermissionService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}
  async effective(tenantId: string, membershipId: string, executor: DatabaseExecutor = this.db) {
    const grants = await executor
      .select()
      .from(userAccessGrants)
      .where(
        and(eq(userAccessGrants.tenantId, tenantId), eq(userAccessGrants.userId, membershipId)),
      )
      .orderBy(asc(userAccessGrants.id));
    const configs = await executor
      .select()
      .from(tenantRolePermissions)
      .where(eq(tenantRolePermissions.tenantId, tenantId));
    const structural = grants.map((grant) => {
      const role = publicRole(grant.role);
      const config = configs.find((row) => row.role === role);
      return {
        grantId: grant.id,
        role,
        scopeType: grant.scopeType,
        organizationId: grant.organizationId,
        teamId: grant.teamId,
        permissions: PERMISSIONS.filter(
          (item) =>
            (item.roles as readonly string[]).includes(role) &&
            (!item.configurable || !config || config.permissions.includes(item.permission)),
        ).map((item) => item.permission),
      };
    });
    const resources = await executor
      .select()
      .from(membershipResourceScopes)
      .where(
        and(
          eq(membershipResourceScopes.tenantId, tenantId),
          eq(membershipResourceScopes.userId, membershipId),
        ),
      )
      .orderBy(asc(membershipResourceScopes.id));
    const campaignParticipation = await executor
      .select({ id: campaignMembers.id, campaignId: campaignMembers.campaignId })
      .from(campaignMembers)
      .innerJoin(
        campaigns,
        and(
          eq(campaigns.tenantId, campaignMembers.tenantId),
          eq(campaigns.id, campaignMembers.campaignId),
        ),
      )
      .where(
        and(
          activeParticipationPredicate(tenantId, membershipId, 'campaign'),
          sql`${campaigns.status} <> 'archived'`,
        ),
      )
      .orderBy(campaignMembers.id);
    const territoryParticipation = await executor
      .select({ id: territoryAssignments.id, territoryId: territoryAssignments.territoryId })
      .from(territoryAssignments)
      .innerJoin(
        territories,
        and(
          eq(territories.tenantId, territoryAssignments.tenantId),
          eq(territories.id, territoryAssignments.territoryId),
        ),
      )
      .where(
        and(
          activeParticipationPredicate(tenantId, membershipId, 'territory'),
          eq(territories.status, 'active'),
        ),
      )
      .orderBy(territoryAssignments.id);
    const rosterParticipation = await executor
      .select({
        id: teamMemberships.id,
        teamId: teamMemberships.teamId,
        organizationId: teams.organizationId,
      })
      .from(teamMemberships)
      .innerJoin(
        teams,
        and(eq(teams.tenantId, teamMemberships.tenantId), eq(teams.id, teamMemberships.teamId)),
      )
      .where(
        and(
          eq(teamMemberships.tenantId, tenantId),
          eq(teamMemberships.membershipId, membershipId),
          sql`${teamMemberships.revokedAt} IS NULL AND ${teamMemberships.startsAt} <= CURRENT_TIMESTAMP AND (${teamMemberships.endsAt} IS NULL OR ${teamMemberships.endsAt} > CURRENT_TIMESTAMP)`,
          activeRoster(tenantId, membershipId, sql`${teams.id}`),
        ),
      )
      .orderBy(teamMemberships.id);
    const organizationParticipation = await executor.execute<{
      id: string;
      campaign_id: string;
      organization_id: string;
      access_level: string;
    }>(sql`SELECT co.id, co.campaign_id, co.organization_id,
      CASE WHEN ${campaignOrganizationAccess(tenantId, membershipId, 'read_write')} THEN 'read_write' ELSE 'read' END AS access_level
      FROM campaign_organizations co JOIN campaigns c ON c.tenant_id = co.tenant_id AND c.id = co.campaign_id
      WHERE c.status <> 'archived' AND ${campaignOrganizationAccess(tenantId, membershipId)} ORDER BY co.id`);
    const derived = [
      ...organizationParticipation.rows.map((p) => ({
        grantId: p.id,
        source: 'campaign_organization',
        role: null,
        scopeType: 'campaign',
        organizationId: p.organization_id,
        teamId: null,
        campaignId: p.campaign_id,
        territoryId: null,
        accessLevel: p.access_level,
        permissions: ['scope.read'],
      })),
      ...rosterParticipation.map((p) => ({
        grantId: p.id,
        source: 'team_membership',
        role: null,
        scopeType: 'team',
        organizationId: p.organizationId,
        teamId: p.teamId,
        campaignId: null,
        territoryId: null,
        accessLevel: 'read',
        permissions: ['scope.read'],
      })),
      ...campaignParticipation.map((p) => ({
        grantId: p.id,
        source: 'campaign_member',
        role: null,
        scopeType: 'campaign',
        organizationId: null,
        teamId: null,
        campaignId: p.campaignId,
        territoryId: null,
        accessLevel: 'read',
        permissions: ['scope.read'],
      })),
      ...territoryParticipation.map((p) => ({
        grantId: p.id,
        source: 'territory_assignment',
        role: null,
        scopeType: 'territory',
        organizationId: null,
        teamId: null,
        campaignId: null,
        territoryId: p.territoryId,
        accessLevel: 'read',
        permissions: ['scope.read'],
      })),
    ];
    const denials = await executor.execute(
      sql`SELECT * FROM membership_scope_denials WHERE tenant_id=${tenantId} AND user_id=${membershipId} ORDER BY id`,
    );
    const protectedAdmin = grants.some(
      (g) => g.role === 'client_admin' && g.scopeType === 'tenant',
    );
    const membershipRoles = new Set([...grants, ...resources].map((g) => publicRole(g.role)));
    const restrictedDomains = new Set<string>(
      protectedAdmin
        ? []
        : DOMAIN_PERMISSIONS.filter((permission) =>
            configs.some((c) => membershipRoles.has(c.role) && !c.permissions.includes(permission)),
          ),
    );
    return [
      ...denials.rows.map((d) => ({
        grantId: String(d.id),
        role: null,
        scopeType: String(d.scope_type),
        organizationId: null,
        teamId: null,
        effect: 'deny',
        resourceId: String(d.resource_id),
        reason: String(d.reason),
        permissions: [] as string[],
      })),
      ...structural,
      ...derived,
      ...resources.map((grant) => ({
        grantId: grant.id,
        role: publicRole(grant.role),
        scopeType: grant.scopeType,
        organizationId: null,
        teamId: null,
        campaignId: grant.campaignId,
        territoryId: grant.territoryId,
        accessLevel: grant.accessLevel,
        permissions: ['scope.read'],
      })),
    ].map((grant) => ({
      ...grant,
      permissions: grant.permissions.filter((permission) => !restrictedDomains.has(permission)),
    }));
  }
  async assertAllowed(
    auth: AuthenticatedPrincipal,
    permission: ConfigurablePermission,
    scope: Scope,
  ) {
    const grants = await this.effective(auth.tenantId, auth.membershipId);
    const roles = PERMISSIONS.find((item) => item.permission === permission)!
      .roles as readonly string[];
    const eligible = grants.filter(
      (grant) =>
        ['tenant', 'organization', 'team'].includes(grant.scopeType) &&
        grant.role !== null &&
        roles.includes(grant.role) &&
        (grant.scopeType === 'tenant' ||
          ((!scope.organizationId || grant.organizationId === scope.organizationId) &&
            (grant.scopeType === 'organization' ||
              !scope.teamId ||
              grant.teamId === scope.teamId))),
    );
    if (!eligible.length) {
      // Exports perform uncached authorization in their service; teams have a
      // dedicated pre-interceptor management guard. Preserve their masked 404s.
      if (permission === 'exports.create' || permission === 'teams.manage') return;
      if (permission === 'collisions.override')
        throw new ForbiddenException('User is not authorized to approve collision overrides');
      throw new ForbiddenException('Assignment management access required');
    }
    if (!eligible.some((grant) => grant.permissions.includes(permission)))
      throw new ForbiddenException(`Permission ${permission} is not available in this scope`);
  }
  // Runs inside AuthGuard, before all interceptors including idempotent replay.
  async enforceRequest(auth: AuthenticatedPrincipal, request: RequestContext) {
    const path = request.routeOptions?.url?.replace(/^\/api\/v1(?=\/)/, '') ?? '';
    const method = request.method ?? '';
    await enforceScopeDenials(this.db, auth, path, method, request.params);
    const domainPermission = requestDomainPermission(path, method);
    if (domainPermission) await enforceDomainRestriction(this.db, auth, domainPermission);

    const contactOperation =
      (method === 'POST' && /\/(reservation|activities|follow-ups)$/.test(path)) ||
      (method === 'PATCH' && /\/follow-ups\/:followUpId\/reschedule$/.test(path));
    const consentCampaign = uuid(request.params?.campaignId),
      consentProspect = uuid(request.params?.prospectId);
    if (contactOperation && consentCampaign && consentProspect) {
      const type = request.body?.type ?? request.body?.channel;
      const channel =
        type === 'call'
          ? 'phone'
          : type === 'message'
            ? 'sms'
            : typeof type === 'string'
              ? type
              : null;
      const blocked = await this.db
        .execute(sql`SELECT target.id FROM campaign_prospects target WHERE target.tenant_id=${auth.tenantId} AND target.campaign_id=${consentCampaign} AND target.id=${consentProspect}
        AND ${consentAccess(auth.tenantId, auth.membershipId, sql`target.establishment_id`)}`);
      // Scope the check to the canonical prospect, without exposing restrictions
      // for someone else's individual assignment.
      if (blocked.rows.length) {
        if (method === 'POST' && /\/(reservation|activities)$/.test(path)) {
          const paused = await this.db.execute(
            sql`SELECT id FROM campaign_prospect_assignments WHERE tenant_id=${auth.tenantId} AND campaign_prospect_id=${consentProspect} AND ended_at IS NULL AND status='paused'`,
          );
          if (paused.rows.length) throw new ConflictException('Assignment is paused');
        }
        const restriction = await this.db.execute(
          sql`SELECT cp.id FROM campaign_prospects cp WHERE cp.tenant_id=${auth.tenantId} AND cp.id=${consentProspect} AND trackroster_consent_blocked(cp.tenant_id,cp.establishment_id,${channel})`,
        );
        if (restriction.rows.length)
          throw new ConflictException({
            code: 'CONTACT_BLOCKED',
            message: 'Prospect opposition blocks this contact channel',
          });
      }
    }
    let permission: ConfigurablePermission | undefined;
    if (/\/assignment$/.test(path) && ['POST', 'PUT', 'DELETE'].includes(method))
      permission = 'assignments.manage';
    if (/\/collision-overrides$/.test(path) && method === 'POST')
      permission = 'collisions.override';
    if (path.startsWith('/exports/') && method === 'GET') permission = 'exports.create';
    if (/^\/teams\/:teamId$/.test(path) && ['PATCH', 'DELETE'].includes(method))
      permission = 'teams.manage';
    if (!permission) return;
    const scope: Scope = {
      organizationId: uuid(request.query?.organizationId),
      teamId: uuid(request.query?.teamId),
    };
    const campaignId = uuid(request.params?.campaignId);
    if (campaignId) {
      const [campaign] = await this.db
        .select()
        .from(campaigns)
        .where(and(eq(campaigns.tenantId, auth.tenantId), eq(campaigns.id, campaignId)));
      if (!campaign) return; // Existing resource handler returns its tenant-safe 404.
      scope.organizationId = campaign.organizationId;
      const prospectId = uuid(request.params?.prospectId);
      if (prospectId) {
        const [assignment] = await this.db
          .select()
          .from(campaignProspectAssignments)
          .where(
            and(
              eq(campaignProspectAssignments.tenantId, auth.tenantId),
              eq(campaignProspectAssignments.campaignId, campaignId),
              eq(campaignProspectAssignments.campaignProspectId, prospectId),
              isNull(campaignProspectAssignments.endedAt),
            ),
          );
        if (assignment) scope.teamId = assignment.teamId;
      }
    }
    const teamId =
      uuid(request.params?.teamId) ?? uuid(request.body?.teamId) ?? uuid(request.query?.teamId);
    if (teamId) {
      if (scope.teamId) await this.assertAllowed(auth, permission, scope);
      const [team] = await this.db
        .select()
        .from(teams)
        .where(and(eq(teams.tenantId, auth.tenantId), eq(teams.id, teamId)));
      if (!team) return;
      scope.organizationId = team.organizationId;
      scope.teamId = team.id;
    }
    await this.assertAllowed(auth, permission, scope);
  }
}
