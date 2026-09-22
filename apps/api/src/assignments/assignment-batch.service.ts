import { distanceKm } from './allocation-distance.js';
import {
  BadRequestException,
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
  assignmentRules,
  auditEvents,
  campaignProspectAssignments,
  teams,
  tenantMemberships,
  tenants,
} from '../database/schema/index.js';
import type { AssignmentRuleTarget } from '../database/schema/assignment-rules.js';
import type { AssignmentBatchDto } from './assignment-batch.dto.js';
export type TargetState = AssignmentRuleTarget & {
  eligible: boolean;
  teamCapacity: number;
  teamWorkload: number;
  memberCapacity: number | null;
  memberWorkload: number;
};
type Decision = {
  prospectId: string;
  outcome:
    | 'proposed'
    | 'assigned'
    | 'already_assigned'
    | 'inactive_prospect'
    | 'capacity_exhausted'
    | 'ineligible_target'
    | 'missing_coordinates'
    | 'no_skill_match'
    | 'no_proximity_match';
  teamId?: string;
  assignedUserId?: string | null;
  assignmentId?: string;
  distanceKm?: number;
  candidates?: Array<{
    teamId: string;
    assignedUserId: string | null;
    distanceKm: number | null;
    availableTeamCapacity: number;
    availableMemberCapacity: number | null;
  }>;
};
@Injectable()
export class AssignmentBatchService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}
  async lock(a: AuthenticatedPrincipal, tx: DatabaseExecutor) {
    await tx
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.id, a.tenantId))
      .for('no key update');
  }
  async authorize(
    a: AuthenticatedPrincipal,
    campaignId: string,
    teamIds: string[] | null,
    tx: DatabaseExecutor = this.db,
  ) {
    // Resource participation/read scopes do not confer operational assignment authority.
    const result = await tx.execute<{ organization_id: string; status: string }>(sql`
      SELECT c.organization_id,c.status FROM campaigns c WHERE c.tenant_id=${a.tenantId} AND c.id=${campaignId}
      AND EXISTS (SELECT 1 FROM tenant_memberships m JOIN identities i ON i.id=m.identity_id
        WHERE m.tenant_id=c.tenant_id AND m.id=${a.membershipId} AND m.status='active' AND i.status='active')
      AND EXISTS (SELECT 1 FROM user_access_grants g WHERE g.tenant_id=c.tenant_id AND g.user_id=${a.membershipId}
        AND ((g.role='client_admin' AND g.scope_type='tenant') OR (g.role='director' AND g.scope_type='organization' AND g.organization_id=c.organization_id)
          OR (${teamIds !== null} AND g.role='manager' AND g.scope_type='team' AND g.organization_id=c.organization_id AND g.team_id = ANY(${sql.param(teamIds ?? [])}::uuid[])))
        AND (g.role='client_admin' OR NOT EXISTS(SELECT 1 FROM tenant_role_permissions p WHERE p.tenant_id=g.tenant_id AND p.role=g.role::text)
          OR EXISTS(SELECT 1 FROM tenant_role_permissions p WHERE p.tenant_id=g.tenant_id AND p.role=g.role::text AND p.permissions ? 'assignments.manage')))`);
    if (!result.rows[0]) throw new ForbiddenException('Assignment management permission required');
    // Manual batches use one team. Rules require campaign-wide (admin/director) authority.
    return result.rows[0];
  }
  async rule(a: AuthenticatedPrincipal, id: string, tx: DatabaseExecutor = this.db) {
    const [r] = await tx
      .select()
      .from(assignmentRules)
      .where(and(eq(assignmentRules.tenantId, a.tenantId), eq(assignmentRules.id, id)));
    if (!r) throw new NotFoundException('Assignment rule not found');
    await this.authorize(a, r.campaignId, null, tx);
    return r;
  }
  async authorizeBatch(
    a: AuthenticatedPrincipal,
    input: AssignmentBatchDto,
    tx: DatabaseExecutor = this.db,
  ) {
    if (input.ruleId) {
      if (input.teamId || input.assignedUserId != null)
        throw new BadRequestException('Use either a rule or a manual target');
      const rule = await this.rule(a, input.ruleId, tx);
      if (rule.campaignId !== input.campaignId.toLowerCase())
        throw new BadRequestException('Rule belongs to a different campaign');
      return this.authorize(a, input.campaignId, null, tx);
    }
    if (!input.teamId) throw new BadRequestException('A teamId or ruleId is required');
    return this.authorize(a, input.campaignId, [input.teamId], tx);
  }
  normalize(
    targets: {
      teamId: string;
      assignedUserId?: string | null;
      skills?: string[];
      location?: { longitude: number; latitude: number };
    }[],
  ): AssignmentRuleTarget[] {
    const normalized = targets.map((t) => ({
      teamId: t.teamId.toLowerCase(),
      assignedUserId: t.assignedUserId?.toLowerCase() ?? null,
      skills: [...new Set((t.skills ?? []).map((s) => s.toLowerCase()))],
      ...(t.location ? { location: t.location } : {}),
    }));
    if (new Set(normalized.map((t) => `${t.teamId}:${t.assignedUserId}`)).size !== targets.length)
      throw new BadRequestException('Rule targets must be unique');
    return normalized;
  }
  async targets(
    a: AuthenticatedPrincipal,
    organizationId: string,
    targets: AssignmentRuleTarget[],
    tx: DatabaseExecutor,
  ): Promise<TargetState[]> {
    // Same order as the manual/geographic writers: team, membership, prospect.
    await tx
      .select({ id: teams.id })
      .from(teams)
      .where(
        and(
          eq(teams.tenantId, a.tenantId),
          inArray(teams.id, [...new Set(targets.map((t) => t.teamId))]),
        ),
      )
      .orderBy(teams.id)
      .for('update');
    const memberIds = targets.flatMap((t) => (t.assignedUserId ? [t.assignedUserId] : []));
    if (memberIds.length)
      await tx
        .select({ id: tenantMemberships.id })
        .from(tenantMemberships)
        .where(
          and(
            eq(tenantMemberships.tenantId, a.tenantId),
            inArray(tenantMemberships.id, [...new Set(memberIds)]),
          ),
        )
        .orderBy(tenantMemberships.id)
        .for('update');
    const states: TargetState[] = [];
    for (const target of targets) {
      const result = await tx.execute<{
        eligible: boolean;
        teamCapacity: number;
        teamWorkload: number;
        memberCapacity: number | null;
        memberWorkload: number;
      }>(sql`
        SELECT t.status='active' AND o.status='active' AND (${target.assignedUserId}::uuid IS NULL OR (m.status='active' AND i.status='active' AND EXISTS(
          SELECT 1 FROM user_access_grants g WHERE g.tenant_id=t.tenant_id AND g.team_id=t.id AND g.user_id=m.id AND g.scope_type='team' AND g.role='prospector'))) AS eligible,
          COALESCE(ts.capacity,100) AS "teamCapacity", ms.capacity AS "memberCapacity",
          (SELECT count(*)::int FROM campaign_prospect_assignments a WHERE a.tenant_id=t.tenant_id AND a.team_id=t.id AND a.ended_at IS NULL) AS "teamWorkload",
          (SELECT count(*)::int FROM campaign_prospect_assignments a WHERE a.tenant_id=t.tenant_id AND a.assigned_user_id=${target.assignedUserId}::uuid AND a.ended_at IS NULL) AS "memberWorkload"
        FROM teams t JOIN organizations o ON o.tenant_id=t.tenant_id AND o.id=t.organization_id
        LEFT JOIN team_settings ts ON ts.tenant_id=t.tenant_id AND ts.team_id=t.id
        LEFT JOIN tenant_memberships m ON m.tenant_id=t.tenant_id AND m.id=${target.assignedUserId}::uuid
        LEFT JOIN identities i ON i.id=m.identity_id LEFT JOIN membership_settings ms ON ms.tenant_id=m.tenant_id AND ms.membership_id=m.id
        WHERE t.tenant_id=${a.tenantId} AND t.id=${target.teamId} AND t.organization_id=${organizationId}`);
      if (!result.rows[0])
        throw new BadRequestException('Target team must belong to the campaign organization');
      states.push({ ...target, ...result.rows[0], eligible: result.rows[0].eligible === true });
    }
    return states;
  }
  async run(
    a: AuthenticatedPrincipal,
    input: AssignmentBatchDto,
    apply: boolean,
    includeCandidates = false,
  ) {
    try {
      return await this.db.transaction(async (tx) => {
        await this.lock(a, tx);
        const authority = await this.authorizeBatch(a, input, tx);
        // Lock campaign status before deciding; archived/completed campaigns cannot allocate.
        const campaign = await tx.execute<{ status: string }>(
          sql`SELECT status FROM campaigns WHERE tenant_id=${a.tenantId} AND id=${input.campaignId} FOR SHARE`,
        );
        if (['completed', 'archived'].includes(campaign.rows[0]!.status))
          throw new ConflictException('Campaign is no longer assignable');
        const rule = input.ruleId ? await this.rule(a, input.ruleId, tx) : null;
        if (rule && !rule.isActive) throw new ConflictException('Assignment rule is inactive');
        const targets =
          rule?.targets ??
          this.normalize([{ teamId: input.teamId!, assignedUserId: input.assignedUserId }]);
        const states = await this.targets(a, authority.organization_id, targets, tx);
        const ids = input.prospectIds.map((id) => id.toLowerCase()).sort();
        const prospects = await tx.execute<{
          id: string;
          status: string;
          establishment_status: string;
          longitude: number | null;
          latitude: number | null;
        }>(sql`
          SELECT cp.id,cp.status,e.status AS establishment_status,e.longitude,e.latitude FROM campaign_prospects cp
          JOIN establishments e ON e.tenant_id=cp.tenant_id AND e.id=cp.establishment_id
          WHERE cp.tenant_id=${a.tenantId} AND cp.campaign_id=${input.campaignId} AND cp.id=ANY(${sql.param(ids)}::uuid[])
          ORDER BY cp.id FOR NO KEY UPDATE OF cp FOR SHARE OF e`);
        if (prospects.rows.length !== ids.length)
          throw new NotFoundException('One or more campaign prospects were not found');
        const current = await tx.execute<{ campaign_prospect_id: string }>(
          sql`SELECT campaign_prospect_id FROM campaign_prospect_assignments WHERE tenant_id=${a.tenantId} AND campaign_prospect_id=ANY(${sql.param(ids)}::uuid[]) AND ended_at IS NULL`,
        );
        const owned = new Set(current.rows.map((r) => r.campaign_prospect_id));
        const decisions: Decision[] = [];
        let cursor = rule?.nextTarget ?? 0;
        const available = (s: TargetState) =>
          s.eligible &&
          s.teamWorkload < s.teamCapacity &&
          (!s.assignedUserId || s.memberCapacity === null || s.memberWorkload < s.memberCapacity);
        for (const p of prospects.rows) {
          if (owned.has(p.id)) {
            decisions.push({ prospectId: p.id, outcome: 'already_assigned' });
            continue;
          }
          if (p.status !== 'active' || p.establishment_status !== 'active') {
            decisions.push({ prospectId: p.id, outcome: 'inactive_prospect' });
            continue;
          }
          if (rule?.strategy === 'proximity' && (p.longitude === null || p.latitude === null)) {
            decisions.push({ prospectId: p.id, outcome: 'missing_coordinates' });
            continue;
          }
          const skilled = states
            .map((state, index) => ({
              state,
              index,
              distance:
                state.location && p.longitude !== null && p.latitude !== null
                  ? distanceKm(state.location, { longitude: p.longitude, latitude: p.latitude })
                  : null,
            }))
            .filter(
              (c) =>
                c.state.eligible &&
                (rule?.requiredSkills ?? []).every((skill) =>
                  (c.state.skills ?? []).includes(skill),
                ),
            );
          const matching = skilled.filter(
            (c) =>
              rule?.strategy !== 'proximity' ||
              (c.distance !== null &&
                (rule.maxDistanceKm === null || c.distance <= rule.maxDistanceKm)),
          );
          const candidates = matching.filter((c) => available(c.state));
          if (!candidates.length) {
            decisions.push({
              prospectId: p.id,
              outcome: matching.length
                ? 'capacity_exhausted'
                : !states.some((s) => s.eligible)
                  ? 'ineligible_target'
                  : !skilled.length
                    ? 'no_skill_match'
                    : 'no_proximity_match',
            });
            continue;
          }
          if (rule?.strategy === 'round_robin')
            candidates.sort(
              (l, r) =>
                ((l.index - cursor + states.length) % states.length) -
                ((r.index - cursor + states.length) % states.length),
            );
          else
            candidates.sort((l, r) => {
              // Prefer the lowest utilization; unlimited member capacity falls back to absolute workload.
              const score = (s: TargetState) =>
                Math.max(
                  s.teamWorkload / s.teamCapacity,
                  s.assignedUserId && s.memberCapacity ? s.memberWorkload / s.memberCapacity : 0,
                );
              return (
                (rule?.strategy === 'proximity' ? l.distance! - r.distance! : 0) ||
                score(l.state) - score(r.state) ||
                l.state.memberWorkload - r.state.memberWorkload ||
                l.index - r.index
              );
            });
          const { state: chosen, index } = candidates[0]!;
          decisions.push({
            prospectId: p.id,
            outcome: 'proposed',
            teamId: chosen.teamId,
            assignedUserId: chosen.assignedUserId,
            ...(rule?.strategy === 'proximity' ? { distanceKm: candidates[0]!.distance! } : {}),
            ...(includeCandidates
              ? {
                  candidates: candidates.map((c) => ({
                    teamId: c.state.teamId,
                    assignedUserId: c.state.assignedUserId,
                    distanceKm: c.distance,
                    availableTeamCapacity: c.state.teamCapacity - c.state.teamWorkload,
                    availableMemberCapacity:
                      c.state.assignedUserId && c.state.memberCapacity !== null
                        ? c.state.memberCapacity - c.state.memberWorkload
                        : null,
                  })),
                }
              : {}),
          });
          // All targets referencing a shared team/member consume the same running capacity.
          for (const s of states) {
            if (s.teamId === chosen.teamId) s.teamWorkload++;
            if (chosen.assignedUserId && s.assignedUserId === chosen.assignedUserId)
              s.memberWorkload++;
          }
          cursor = (index + 1) % states.length;
        }
        const conflicts = decisions.filter((d) => d.outcome !== 'proposed');
        if (apply && conflicts.length)
          throw new ConflictException({
            code: 'ASSIGNMENT_BATCH_CONFLICT',
            message: 'No assignments were written. Resolve conflicts and retry.',
            decisions,
          });
        if (apply) {
          for (const d of decisions) {
            const [assignment] = await tx
              .insert(campaignProspectAssignments)
              .values({
                tenantId: a.tenantId,
                campaignId: input.campaignId,
                campaignProspectId: d.prospectId,
                organizationId: authority.organization_id,
                teamId: d.teamId!,
                assignedUserId: d.assignedUserId,
              })
              .returning();
            d.outcome = 'assigned';
            d.assignmentId = assignment!.id;
            await tx.insert(auditEvents).values({
              tenantId: a.tenantId,
              actorType: 'user',
              actorUserId: a.membershipId,
              action: 'assignment.assigned',
              resourceType: 'campaign_prospect',
              resourceId: d.prospectId,
              metadata: {
                ...d,
                campaignId: input.campaignId,
                source: 'bulk_assignment',
                ruleId: rule?.id ?? null,
                ruleSnapshot: rule,
              },
            });
          }
          if (rule?.strategy === 'round_robin')
            await tx
              .update(assignmentRules)
              .set({ nextTarget: cursor, updatedAt: sql`clock_timestamp()` })
              .where(
                and(eq(assignmentRules.tenantId, a.tenantId), eq(assignmentRules.id, rule.id)),
              );
        }
        return {
          campaignId: input.campaignId,
          ruleId: rule?.id ?? null,
          mode: apply ? 'apply' : 'preview',
          canApply: conflicts.length === 0,
          assigned: apply ? decisions.length : 0,
          proposed: apply ? 0 : decisions.length - conflicts.length,
          conflicts: conflicts.length,
          decisions,
        };
      });
    } catch (e) {
      const code =
        (e as { code?: string; cause?: { code?: string } }).code ??
        (e as { cause?: { code?: string } }).cause?.code;
      if (code === '23505')
        throw new ConflictException('Assignments changed concurrently; preview and retry');
      throw e;
    }
  }
}
