import { prospectReadScope } from '../actions/action-access.js';
import type { ListCampaignsDto } from '../campaigns/dto/list-campaigns.dto.js';
import { campaignOrganizationAccess } from '../campaign-organizations/organization-access.js';
import { activeParticipationPredicate } from './participation-access.js';
import { campaignMembers, territoryAssignments } from '../database/schema/participation.js';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, sql, type SQL } from 'drizzle-orm';
import { DATABASE } from '../database/database.constants.js';
import type { Database, DatabaseExecutor } from '../database/database.types.js';
import {
  auditEvents,
  campaigns,
  membershipResourceScopes,
  tenantMemberships,
  tenants,
  territories,
} from '../database/schema/index.js';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { internalRole, publicRole } from '../permissions/permission-catalogue.js';
import { assertResourceMatches } from '../http/resource-etag.js';
import type { MembershipScopeDto } from '../memberships/membership.dto.js';
export type ResourceKind = 'campaign' | 'territory';
export type ResourceLevel = 'read' | 'read_write' | 'manage';

export function resourceScopePredicate(
  auth: AuthenticatedPrincipal,
  kind: ResourceKind,
  level: ResourceLevel = 'read',
): SQL {
  const table = kind === 'campaign' ? campaigns : territories;
  const participation = kind === 'campaign' ? campaignMembers : territoryAssignments;
  const participationResource =
    kind === 'campaign' ? campaignMembers.campaignId : territoryAssignments.territoryId;
  const idColumn = kind === 'campaign' ? sql`s.campaign_id` : sql`s.territory_id`;
  const levels =
    level === 'manage'
      ? sql`('manage')`
      : level === 'read_write'
        ? sql`('read_write','manage')`
        : sql`('read','read_write','manage')`;
  return sql`(${table.tenantId} = ${auth.tenantId} AND (
      EXISTS (SELECT 1 FROM user_access_grants g WHERE g.tenant_id = ${auth.tenantId} AND g.user_id = ${auth.membershipId}
        AND ((g.scope_type = 'tenant' AND (g.role = 'client_admin' ${level === 'read' ? sql`OR g.role = 'observer'` : sql``}))
        ${kind === 'campaign' ? sql`OR (g.scope_type = 'organization' AND g.organization_id = ${campaigns.organizationId} AND (g.role = 'director' ${level === 'read' ? sql`OR g.role = 'observer'` : sql``}))` : sql``}))
      OR (${kind === 'territory' ? sql`${territories.status} = 'active'` : sql`true`} AND EXISTS (SELECT 1 FROM membership_resource_scopes s
        WHERE s.tenant_id = ${auth.tenantId} AND s.user_id = ${auth.membershipId} AND ${idColumn} = ${table.id} AND s.access_level IN ${levels}))
      ${
        level === 'read'
          ? sql`OR (${kind === 'territory' ? sql`${territories.status} = 'active'` : sql`${campaigns.status} <> 'archived'`} AND EXISTS (
        SELECT 1 FROM ${participation} WHERE ${participationResource} = ${table.id}
          AND ${activeParticipationPredicate(auth.tenantId, auth.membershipId, kind)}))`
          : sql``
      }
      ${kind === 'campaign' && level !== 'manage' ? sql`OR (${campaigns.status} <> 'archived' AND EXISTS (SELECT 1 FROM campaign_organizations co WHERE co.campaign_id = ${campaigns.id} AND ${campaignOrganizationAccess(auth.tenantId, auth.membershipId, level)}))` : sql``}
    ))`;
}

@Injectable()
export class ResourceScopeService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  // This predicate is embedded in the resource query, not applied to an already
  // paginated response. Explicit resource grants never become organization grants.
  predicate(auth: AuthenticatedPrincipal, kind: ResourceKind, level: ResourceLevel = 'read'): SQL {
    return resourceScopePredicate(auth, kind, level);
  }
  async require(
    auth: AuthenticatedPrincipal,
    kind: ResourceKind,
    id: string,
    level: ResourceLevel = 'read',
    executor: DatabaseExecutor = this.db,
  ) {
    const table = kind === 'campaign' ? campaigns : territories;
    const rows = await executor
      .select({ id: table.id })
      .from(table)
      .where(and(eq(table.id, id), this.predicate(auth, kind, level)));
    if (!rows.length)
      throw new NotFoundException(`${kind === 'campaign' ? 'Campaign' : 'Territory'} not found`);
  }
  async listCampaigns(auth: AuthenticatedPrincipal, q?: ListCampaignsDto) {
    if (!q || !Object.values(q).some((value) => value !== undefined))
      return this.db
        .select()
        .from(campaigns)
        .where(this.predicate(auth, 'campaign'))
        .orderBy(campaigns.createdAt, campaigns.id);
    if (
      q.startsAfter &&
      q.startsBefore &&
      new Date(q.startsAfter).getTime() > new Date(q.startsBefore).getTime()
    )
      throw new BadRequestException('Invalid campaign date range');
    const filters = [this.predicate(auth, 'campaign')];
    if (q.organizationId) filters.push(eq(campaigns.organizationId, q.organizationId));
    if (q.status) filters.push(eq(campaigns.status, q.status));
    if (q.search)
      filters.push(sql`${campaigns.name} ILIKE ${'%' + q.search.replace(/[\\%_]/g, '\\$&') + '%'}`);
    if (q.startsAfter) filters.push(sql`${campaigns.startsAt}>=${q.startsAfter}::timestamptz`);
    if (q.startsBefore) filters.push(sql`${campaigns.startsAt}<${q.startsBefore}::timestamptz`);
    if (q.territoryId)
      filters.push(
        sql`EXISTS(SELECT 1 FROM campaign_territories ct WHERE ct.tenant_id=${auth.tenantId} AND ct.campaign_id=${campaigns.id} AND ct.territory_id=${q.territoryId})`,
      );
    const sort = q.sort === 'name' ? campaigns.name : campaigns.createdAt;
    if (q.cursor) {
      const [cursor] = await this.db
        .select()
        .from(campaigns)
        .where(and(...filters, eq(campaigns.id, q.cursor)));
      if (!cursor) throw new BadRequestException('Cursor is outside the filtered campaign list');
      filters.push(
        sql`(${sort},${campaigns.id})>(${q.sort === 'name' ? cursor.name : cursor.createdAt.toISOString()},${cursor.id}::uuid)`,
      );
    }
    const limit = q.limit ?? 25;
    const rows = await this.db
      .select()
      .from(campaigns)
      .where(and(...filters))
      .orderBy(sort, campaigns.id)
      .limit(limit + 1);
    return {
      items: rows.slice(0, limit),
      nextCursor: rows.length > limit ? rows[limit - 1]!.id : null,
    };
  }
  async getCampaign(
    auth: AuthenticatedPrincipal,
    id: string,
    executor: DatabaseExecutor = this.db,
  ) {
    const [row] = await executor
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, id), this.predicate(auth, 'campaign')));
    if (!row) throw new NotFoundException('Campaign not found');
    const stats =
      await executor.execute(sql`WITH visible AS (SELECT cp.* FROM campaign_prospects cp WHERE cp.tenant_id=${auth.tenantId} AND cp.campaign_id=${id} AND ${prospectReadScope(auth, sql`cp.id`)}) SELECT
    (SELECT count(*)::int FROM visible) AS prospects,
    (SELECT coalesce(jsonb_object_agg(stage,n),'{}'::jsonb) FROM (SELECT lifecycle_stage AS stage,count(*)::int AS n FROM visible GROUP BY lifecycle_stage) grouped) AS "byLifecycleStage",
    (SELECT count(*)::int FROM campaign_prospect_assignments a WHERE a.tenant_id=${auth.tenantId} AND a.campaign_prospect_id IN(SELECT id FROM visible) AND a.ended_at IS NULL) AS "activeAssignments",
    (SELECT count(*)::int FROM campaign_prospect_assignments a WHERE a.tenant_id=${auth.tenantId} AND a.campaign_prospect_id IN(SELECT id FROM visible) AND a.ended_at IS NULL AND a.status='paused') AS "pausedAssignments",
    (SELECT count(*)::int FROM prospect_follow_ups f WHERE f.tenant_id=${auth.tenantId} AND f.campaign_prospect_id IN(SELECT id FROM visible) AND f.status='pending') AS "pendingFollowUps",
    (SELECT count(*)::int FROM prospect_follow_ups f WHERE f.tenant_id=${auth.tenantId} AND f.campaign_prospect_id IN(SELECT id FROM visible) AND f.status='pending' AND f.due_at<now()) AS "overdueFollowUps",
    (SELECT count(*)::int FROM actions a WHERE a.tenant_id=${auth.tenantId} AND a.campaign_prospect_id IN(SELECT id FROM visible) AND a.status='completed') AS "completedActions",
    (SELECT count(*)::int FROM campaign_territories WHERE tenant_id=${auth.tenantId} AND campaign_id=${id}) AS "territoryCount"`);
    return { ...row, summary: { ...stats.rows[0], scope: 'visible_prospects' } };
  }
  async validate(tenantId: string, input: MembershipScopeDto, tx: DatabaseExecutor) {
    if (
      !['campaign', 'territory'].includes(input.scopeType) ||
      input.organizationId ||
      input.teamId ||
      input.role === 'tenant_admin'
    )
      throw new BadRequestException('Invalid resource scope');
    const kind = input.scopeType as ResourceKind;
    const id = kind === 'campaign' ? input.campaignId : input.territoryId;
    if (!id || (kind === 'campaign' ? input.territoryId : input.campaignId))
      throw new BadRequestException('Exactly one matching resource is required');
    const accessLevel = input.accessLevel ?? 'read';
    if (['auditor', 'prospector'].includes(input.role) && accessLevel !== 'read')
      throw new BadRequestException('This role supports read access only');
    const table = kind === 'campaign' ? campaigns : territories;
    const [row] = await tx
      .select({ id: table.id, status: table.status })
      .from(table)
      .where(and(eq(table.tenantId, tenantId), eq(table.id, id)))
      .for('share');
    if (!row || row.status === 'inactive' || row.status === 'archived')
      throw new NotFoundException('Scope resource is unavailable');
    return {
      role: internalRole(input.role),
      scopeType: kind,
      campaignId: kind === 'campaign' ? id : null,
      territoryId: kind === 'territory' ? id : null,
      accessLevel,
    };
  }
  async mutate(
    auth: AuthenticatedPrincipal,
    memberId: string | null,
    scopeId: string | null,
    input: MembershipScopeDto | null,
    ifMatch?: string,
  ) {
    try {
      return await this.db.transaction(async (tx) => {
        await tx
          .select({ id: tenants.id })
          .from(tenants)
          .where(eq(tenants.id, auth.tenantId))
          .for('update');
        const [before] = scopeId
          ? await tx
              .select()
              .from(membershipResourceScopes)
              .where(
                and(
                  eq(membershipResourceScopes.tenantId, auth.tenantId),
                  eq(membershipResourceScopes.id, scopeId),
                ),
              )
          : [];
        if (scopeId && !before) throw new NotFoundException('Scope not found');
        const target = before?.userId ?? memberId!;
        const [member] = await tx
          .select()
          .from(tenantMemberships)
          .where(
            and(eq(tenantMemberships.tenantId, auth.tenantId), eq(tenantMemberships.id, target)),
          )
          .for('update');
        if (!member) throw new NotFoundException('Membership not found');
        if (input && member.status === 'departed')
          throw new ConflictException('Departed memberships cannot receive access');
        if (before) assertResourceMatches(ifMatch, { ...before, role: publicRole(before.role) });
        let after: typeof membershipResourceScopes.$inferSelect | undefined;
        if (input) {
          const value = await this.validate(auth.tenantId, input, tx);
          [after] = before
            ? await tx
                .update(membershipResourceScopes)
                .set({ ...value, updatedAt: sql`clock_timestamp()` })
                .where(eq(membershipResourceScopes.id, before.id))
                .returning()
            : await tx
                .insert(membershipResourceScopes)
                .values({ ...value, tenantId: auth.tenantId, userId: target })
                .returning();
        } else if (before)
          await tx
            .delete(membershipResourceScopes)
            .where(eq(membershipResourceScopes.id, before.id));
        await tx.insert(auditEvents).values({
          tenantId: auth.tenantId,
          actorType: 'user',
          actorUserId: auth.membershipId,
          resourceType: 'tenant_membership',
          resourceId: target,
          action: !before
            ? 'membership.scope_added'
            : input
              ? 'membership.scope_changed'
              : 'membership.scope_removed',
          metadata: { before, after },
        });
        return after ? { ...after, role: publicRole(after.role) } : undefined;
      });
    } catch (error) {
      if ((error as { cause?: { code?: string } }).cause?.code === '23505')
        throw new ConflictException('This scope grant already exists');
      throw error;
    }
  }
}
