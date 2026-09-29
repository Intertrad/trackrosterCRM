import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, gt, isNull, or, sql } from 'drizzle-orm';
import { DATABASE } from '../database/database.constants.js';
import type { Database, DatabaseExecutor } from '../database/database.types.js';
import {
  auditEvents,
  identities,
  organizationRelationships,
  organizations,
  teams,
  teamMemberships,
  tenantMemberships,
  tenants,
  userAccessGrants,
} from '../database/schema/index.js';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { assertResourceMatches, resourceETag } from '../http/resource-etag.js';
import { organizationRead, teamRead } from './structure-access.js';
import type {
  CreateRelationshipDto,
  CreateRosterDto,
  ListRelationshipsDto,
  ListRosterDto,
  UpdateRosterDto,
} from './structure.dto.js';
@Injectable()
export class StructureService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}
  private async lock(auth: AuthenticatedPrincipal, tx: DatabaseExecutor) {
    // Serialize structure changes without blocking the FK key-share locks used
    // by existing resource writers before they write audit events.
    await tx
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.id, auth.tenantId))
      .for('no key update');
  }
  private async transaction<T>(fn: (tx: DatabaseExecutor) => Promise<T>) {
    try {
      return await this.db.transaction(fn);
    } catch (error) {
      if (['23505', '23P01'].includes((error as { cause?: { code?: string } }).cause?.code ?? ''))
        throw new ConflictException(
          'Duplicate relationship, existing parent, or overlapping roster period',
        );
      throw error;
    }
  }
  private async isAdmin(auth: AuthenticatedPrincipal, tx: DatabaseExecutor) {
    const rows = await tx
      .select({ id: userAccessGrants.id })
      .from(userAccessGrants)
      .where(
        and(
          eq(userAccessGrants.tenantId, auth.tenantId),
          eq(userAccessGrants.userId, auth.membershipId),
          eq(userAccessGrants.role, 'client_admin'),
          eq(userAccessGrants.scopeType, 'tenant'),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }
  async listRelationships(auth: AuthenticatedPrincipal, query: ListRelationshipsDto) {
    const r = organizationRelationships;
    const rows = await this.db
      .select()
      .from(r)
      .where(
        and(
          eq(r.tenantId, auth.tenantId),
          organizationRead(auth.tenantId, auth.membershipId, sql`${r.parentOrganizationId}`),
          organizationRead(auth.tenantId, auth.membershipId, sql`${r.childOrganizationId}`),
          query.organizationId
            ? or(
                eq(r.parentOrganizationId, query.organizationId),
                eq(r.childOrganizationId, query.organizationId),
              )
            : undefined,
          query.relationshipType ? eq(r.relationshipType, query.relationshipType) : undefined,
          query.cursor ? gt(r.id, query.cursor) : undefined,
          query.state === 'all'
            ? undefined
            : query.state === 'active'
              ? isNull(r.endedAt)
              : sql`${r.endedAt} IS NOT NULL`,
        ),
      )
      .orderBy(r.id)
      .limit(query.limit + 1);
    return {
      items: rows.slice(0, query.limit).map((row) => ({ ...row, etag: resourceETag(row) })),
      nextCursor: rows.length > query.limit ? rows[query.limit - 1]!.id : null,
    };
  }
  async createRelationship(auth: AuthenticatedPrincipal, input: CreateRelationshipDto) {
    return this.transaction(async (tx) => {
      await this.lock(auth, tx);
      if (!(await this.isAdmin(auth, tx)))
        throw new ForbiddenException('Tenant administrator access required');
      let parent = input.parentOrganizationId.toLowerCase(),
        child = input.childOrganizationId.toLowerCase();
      if (parent === child)
        throw new BadRequestException('An organization cannot relate to itself');
      if (['partner', 'coordination'].includes(input.relationshipType) && parent > child)
        [parent, child] = [child, parent];
      const endpoints = await tx
        .select()
        .from(organizations)
        .where(
          and(
            eq(organizations.tenantId, auth.tenantId),
            or(eq(organizations.id, parent), eq(organizations.id, child)),
          ),
        )
        .orderBy(organizations.id)
        .for('share');
      if (endpoints.length !== 2) throw new NotFoundException('Organization not found');
      if (endpoints.some((r) => r.status !== 'active'))
        throw new ConflictException('Relationship endpoints must be active');
      if (['parent', 'brand'].includes(input.relationshipType)) {
        const cycle = await tx.execute(sql`WITH RECURSIVE descendants(id) AS (
          SELECT child_organization_id FROM organization_relationships WHERE tenant_id = ${auth.tenantId} AND parent_organization_id = ${child} AND ended_at IS NULL AND relationship_type IN ('parent','brand')
          UNION SELECT r.child_organization_id FROM organization_relationships r JOIN descendants d ON r.parent_organization_id = d.id
          WHERE r.tenant_id = ${auth.tenantId} AND r.ended_at IS NULL AND r.relationship_type IN ('parent','brand')
        ) SELECT id FROM descendants WHERE id = ${parent}`);
        if (cycle.rows.length)
          throw new ConflictException('Organization hierarchy cannot contain cycles');
      }
      const [after] = await tx
        .insert(organizationRelationships)
        .values({
          tenantId: auth.tenantId,
          parentOrganizationId: parent,
          childOrganizationId: child,
          relationshipType: input.relationshipType,
        })
        .returning();
      await this.audit(
        auth,
        'organization_relationship',
        after!.id,
        'organization_relationship.created',
        { after },
        tx,
      );
      return after!;
    });
  }
  async endRelationship(auth: AuthenticatedPrincipal, id: string, ifMatch?: string) {
    return this.transaction(async (tx) => {
      await this.lock(auth, tx);
      if (!(await this.isAdmin(auth, tx)))
        throw new ForbiddenException('Tenant administrator access required');
      const [before] = await tx
        .select()
        .from(organizationRelationships)
        .where(
          and(
            eq(organizationRelationships.tenantId, auth.tenantId),
            eq(organizationRelationships.id, id),
          ),
        );
      if (!before) throw new NotFoundException('Relationship not found');
      assertResourceMatches(ifMatch, before);
      if (before.endedAt) return;
      const [after] = await tx
        .update(organizationRelationships)
        .set({ endedAt: sql`clock_timestamp()` })
        .where(eq(organizationRelationships.id, id))
        .returning();
      await this.audit(
        auth,
        'organization_relationship',
        id,
        'organization_relationship.ended',
        { before, after },
        tx,
      );
    });
  }
  private async team(
    auth: AuthenticatedPrincipal,
    id: string,
    tx: DatabaseExecutor,
    writing = false,
  ) {
    const query = tx
      .select()
      .from(teams)
      .where(
        and(
          eq(teams.tenantId, auth.tenantId),
          eq(teams.id, id),
          teamRead(
            auth.tenantId,
            auth.membershipId,
            sql`${teams.id}`,
            sql`${teams.organizationId}`,
          ),
        ),
      );
    const [team] = writing ? await query.for('share') : await query;
    if (!team) throw new NotFoundException('Team not found');
    return team;
  }
  async authorizeRoster(
    auth: AuthenticatedPrincipal,
    teamId: string,
    requireAdmin = false,
    tx: DatabaseExecutor = this.db,
  ) {
    const team = await this.team(auth, teamId, tx);
    if (await this.isAdmin(auth, tx)) return team;
    if (requireAdmin)
      throw new ForbiddenException('Tenant administrator access required for roster roles');
    const authority = await tx.execute(sql`SELECT 1 FROM user_access_grants g
      WHERE g.tenant_id = ${auth.tenantId} AND g.user_id = ${auth.membershipId}
      AND ((g.role = 'director' AND g.scope_type = 'organization' AND g.organization_id = ${team.organizationId})
        OR (g.role = 'manager' AND g.scope_type = 'team' AND g.team_id = ${teamId}))
      AND (NOT EXISTS (SELECT 1 FROM tenant_role_permissions p WHERE p.tenant_id = g.tenant_id AND p.role = g.role::text)
        OR EXISTS (SELECT 1 FROM tenant_role_permissions p WHERE p.tenant_id = g.tenant_id AND p.role = g.role::text AND p.permissions ? 'teams.manage')) LIMIT 1`);
    if (!authority.rows.length) throw new ForbiddenException('Team management permission required');
    return team;
  }
  async rosterHasManager(
    auth: AuthenticatedPrincipal,
    teamId: string,
    membershipId: string,
    periodId?: string,
    tx: DatabaseExecutor = this.db,
  ) {
    const t = teamMemberships;
    const rows = await tx
      .select({ role: t.teamRole })
      .from(t)
      .where(
        and(
          eq(t.tenantId, auth.tenantId),
          eq(t.teamId, teamId),
          eq(t.membershipId, membershipId),
          periodId
            ? eq(t.id, periodId)
            : sql`${t.revokedAt} IS NULL AND (${t.endsAt} IS NULL OR ${t.endsAt} > CURRENT_TIMESTAMP)`,
        ),
      );
    return rows.some((r) => r.role === 'manager');
  }
  async listRoster(auth: AuthenticatedPrincipal, teamId: string, query: ListRosterDto) {
    await this.team(auth, teamId, this.db);
    const t = teamMemberships;
    const state = sql<string>`CASE WHEN ${t.revokedAt} IS NOT NULL THEN 'revoked' WHEN ${t.endsAt} <= CURRENT_TIMESTAMP THEN 'ended' WHEN ${t.startsAt} > CURRENT_TIMESTAMP THEN 'scheduled' ELSE 'active' END`;
    const rows = await this.db
      .select({ record: t, state })
      .from(t)
      .innerJoin(teams, and(eq(teams.tenantId, t.tenantId), eq(teams.id, t.teamId)))
      .where(
        and(
          eq(t.tenantId, auth.tenantId),
          eq(t.teamId, teamId),
          teamRead(
            auth.tenantId,
            auth.membershipId,
            sql`${teams.id}`,
            sql`${teams.organizationId}`,
          ),
          query.membershipId ? eq(t.membershipId, query.membershipId) : undefined,
          query.cursor ? gt(t.id, query.cursor) : undefined,
          query.state === 'all' ? undefined : sql`${state} = ${query.state}`,
        ),
      )
      .orderBy(t.id)
      .limit(query.limit + 1);
    return {
      items: rows
        .slice(0, query.limit)
        .map(({ record, state }) => ({ ...record, state, etag: resourceETag(record) })),
      nextCursor: rows.length > query.limit ? rows[query.limit - 1]!.record.id : null,
    };
  }
  private async eligible(
    auth: AuthenticatedPrincipal,
    teamId: string,
    membershipId: string,
    tx: DatabaseExecutor,
  ) {
    const team = await this.team(auth, teamId, tx, true);
    const [org] = await tx
      .select()
      .from(organizations)
      .where(
        and(eq(organizations.tenantId, auth.tenantId), eq(organizations.id, team.organizationId)),
      )
      .for('share');
    if (team.status !== 'active' || org?.status !== 'active')
      throw new ConflictException('Team and organization must be active');
    const [member] = await tx
      .select({ id: tenantMemberships.id })
      .from(tenantMemberships)
      .innerJoin(identities, eq(identities.id, tenantMemberships.identityId))
      .where(
        and(
          eq(tenantMemberships.tenantId, auth.tenantId),
          eq(tenantMemberships.id, membershipId),
          eq(tenantMemberships.status, 'active'),
          eq(identities.status, 'active'),
        ),
      )
      .for('share');
    if (!member) throw new NotFoundException('Active membership not found');
  }
  private dates(startsAt: Date, endsAt: Date | null) {
    if (
      !Number.isFinite(startsAt.getTime()) ||
      (endsAt && (!Number.isFinite(endsAt.getTime()) || endsAt <= startsAt))
    )
      throw new BadRequestException('endsAt must be after startsAt');
  }
  async createRoster(auth: AuthenticatedPrincipal, teamId: string, input: CreateRosterDto) {
    return this.transaction(async (tx) => {
      await this.lock(auth, tx);
      await this.authorizeRoster(auth, teamId, input.teamRole === 'manager', tx);
      await this.eligible(auth, teamId, input.membershipId, tx);
      const startsAt = input.startsAt ? new Date(input.startsAt) : new Date();
      const endsAt = input.endsAt ? new Date(input.endsAt) : null;
      this.dates(startsAt, endsAt);
      const [after] = await tx
        .insert(teamMemberships)
        .values({
          tenantId: auth.tenantId,
          teamId,
          membershipId: input.membershipId,
          teamRole: input.teamRole ?? 'member',
          startsAt,
          endsAt,
        })
        .returning();
      await this.audit(
        auth,
        'tenant_membership',
        input.membershipId,
        'membership.team_joined',
        { after },
        tx,
      );
      return after!;
    });
  }
  async updateRoster(
    auth: AuthenticatedPrincipal,
    teamId: string,
    membershipId: string,
    input: UpdateRosterDto | null,
    periodId?: string,
    ifMatch?: string,
  ) {
    if (input && !Object.values(input).some((v) => v !== undefined))
      throw new BadRequestException('At least one field is required');
    return this.transaction(async (tx) => {
      await this.lock(auth, tx);
      const t = teamMemberships;
      const rows = await tx
        .select()
        .from(t)
        .where(
          and(
            eq(t.tenantId, auth.tenantId),
            eq(t.teamId, teamId),
            eq(t.membershipId, membershipId),
            periodId
              ? eq(t.id, periodId)
              : sql`${t.revokedAt} IS NULL AND (${t.endsAt} IS NULL OR ${t.endsAt} > CURRENT_TIMESTAMP)`,
          ),
        )
        .orderBy(t.startsAt);
      if (!rows.length) throw new NotFoundException('Roster period not found');
      if (rows.length > 1) throw new ConflictException('Multiple periods match; specify periodId');
      const before = rows[0]!;
      await this.authorizeRoster(
        auth,
        teamId,
        input?.teamRole !== undefined || before.teamRole === 'manager',
        tx,
      );
      assertResourceMatches(ifMatch, before);
      if (before.revokedAt) {
        if (!input) return before;
        throw new ConflictException('Cancelled periods cannot be edited');
      }
      const clock = await tx.execute<{ now: string }>(sql`SELECT clock_timestamp() AS now`);
      const now = new Date(clock.rows[0]!.now);
      if (input && before.endsAt && before.endsAt <= now)
        throw new ConflictException('Historical periods cannot be edited; create a new period');
      let after: typeof teamMemberships.$inferSelect;
      if (!input) {
        [after] = (await tx
          .update(t)
          .set({ revokedAt: now, updatedAt: now })
          .where(eq(t.id, before.id))
          .returning()) as [typeof t.$inferSelect];
      } else {
        await this.eligible(auth, teamId, membershipId, tx);
        const endsAt =
          input.endsAt === undefined
            ? before.endsAt
            : input.endsAt === null
              ? null
              : new Date(input.endsAt);
        if (input.teamRole && input.teamRole !== before.teamRole && before.startsAt < now) {
          const transition = input.startsAt ? new Date(input.startsAt) : now;
          if (transition < now || (before.endsAt && transition >= before.endsAt))
            throw new BadRequestException('Role transition must be within the remaining period');
          this.dates(transition, endsAt);
          await tx.update(t).set({ endsAt: transition, updatedAt: now }).where(eq(t.id, before.id));
          [after] = (await tx
            .insert(t)
            .values({
              tenantId: auth.tenantId,
              teamId,
              membershipId,
              teamRole: input.teamRole,
              startsAt: transition,
              endsAt,
            })
            .returning()) as [typeof t.$inferSelect];
        } else {
          const startsAt = input.startsAt ? new Date(input.startsAt) : before.startsAt;
          if (before.startsAt <= now && startsAt.getTime() !== before.startsAt.getTime())
            throw new BadRequestException('An active period start cannot be rewritten');
          this.dates(startsAt, endsAt);
          if (before.startsAt <= now && endsAt && endsAt < now)
            throw new BadRequestException('An active period cannot be ended retroactively');
          [after] = (await tx
            .update(t)
            .set({ startsAt, endsAt, teamRole: input.teamRole, updatedAt: now })
            .where(eq(t.id, before.id))
            .returning()) as [typeof t.$inferSelect];
        }
      }
      await this.audit(
        auth,
        'tenant_membership',
        membershipId,
        input ? 'membership.team_changed' : 'membership.team_left',
        { before, after },
        tx,
      );
      return after;
    });
  }
  private async audit(
    auth: AuthenticatedPrincipal,
    resourceType: string,
    id: string,
    action: string,
    metadata: Record<string, unknown>,
    tx: DatabaseExecutor,
  ) {
    await tx.insert(auditEvents).values({
      tenantId: auth.tenantId,
      actorType: 'user',
      actorUserId: auth.membershipId,
      resourceType,
      resourceId: id,
      action,
      metadata,
    });
  }
}
