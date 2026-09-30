import { ResourceScopeService } from '../resource-scopes/resource-scope.service.js';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, gt, ilike, isNull, or, sql } from 'drizzle-orm';
import { DATABASE } from '../database/database.constants.js';
import { Database, DatabaseExecutor } from '../database/database.types.js';
import {
  membershipScopeDenials,
  auditEvents,
  campaignProspectAssignments,
  identities,
  membershipSettings,
  membershipResourceScopes,
  organizations,
  teams,
  tenantMemberships,
  tenants,
  userAccessGrants,
  teamSettings,
} from '../database/schema/index.js';
import { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { assertAdministratorRemains } from '../authorization/administrator-continuity.js';
import { internalRole, publicRole } from '../permissions/permission-catalogue.js';
import { PermissionService } from '../permissions/permission.service.js';
import { assertResourceMatches, resourceETag } from '../http/resource-etag.js';
import { currentTenantExecutor } from '../database/request-tenant-executor.js';
import { withTenantContext } from '../database/tenant-context.js';
import { ListMembershipsDto, MembershipScopeDto, UpdateMembershipDto } from './membership.dto.js';
@Injectable()
export class MembershipService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly permissions: PermissionService,
    private readonly resourceScopes: ResourceScopeService,
  ) {}
  async list(
    auth: AuthenticatedPrincipal,
    query: ListMembershipsDto,
  ): Promise<{ items: unknown[]; nextCursor: string | null }> {
    if (!currentTenantExecutor())
      return withTenantContext(this.db, auth.tenantId, () => this.list(auth, query));
    const resourceScoped = query.territoryId || query.campaignId;
    const scoped = query.role || query.teamId || query.organizationId;
    const rows = await this.db
      .select({
        id: tenantMemberships.id,
        identityId: identities.id,
        email: identities.email,
        displayName: tenantMemberships.displayName,
        status: tenantMemberships.status,
        capacity: membershipSettings.capacity,
        roles: sql<
          string[]
        >`(SELECT coalesce(jsonb_agg(DISTINCT CASE role WHEN 'client_admin' THEN 'tenant_admin' WHEN 'observer' THEN 'auditor' ELSE role::text END), '[]'::jsonb) FROM (SELECT role FROM user_access_grants WHERE tenant_id = ${auth.tenantId} AND user_id = ${tenantMemberships.id} UNION SELECT role FROM membership_resource_scopes WHERE tenant_id = ${auth.tenantId} AND user_id = ${tenantMemberships.id}) role_grants)`,
      })
      .from(tenantMemberships)
      .innerJoin(identities, eq(identities.id, tenantMemberships.identityId))
      .leftJoin(membershipSettings, eq(membershipSettings.membershipId, tenantMemberships.id))
      .where(
        and(
          eq(tenantMemberships.tenantId, auth.tenantId),
          query.status ? eq(tenantMemberships.status, query.status) : undefined,
          query.cursor ? gt(tenantMemberships.id, query.cursor) : undefined,
          query.search
            ? or(
                ilike(identities.email, `%${query.search}%`),
                ilike(tenantMemberships.displayName, `%${query.search}%`),
              )
            : undefined,
          resourceScoped
            ? sql`EXISTS (SELECT 1 FROM membership_resource_scopes r WHERE r.tenant_id = ${auth.tenantId} AND r.user_id = ${tenantMemberships.id}
            ${query.role ? sql`AND r.role = ${internalRole(query.role)}` : sql``}
            ${query.territoryId ? sql`AND r.territory_id = ${query.territoryId}` : sql``}
            ${query.campaignId ? sql`AND r.campaign_id = ${query.campaignId}` : sql``})`
            : undefined,
          scoped && (!resourceScoped || query.teamId || query.organizationId)
            ? sql`(EXISTS (SELECT 1 FROM user_access_grants g WHERE g.tenant_id = ${auth.tenantId} AND g.user_id = ${tenantMemberships.id}
        ${query.role ? sql`AND g.role = ${internalRole(query.role)}` : sql``}
        ${query.organizationId ? sql`AND g.organization_id = ${query.organizationId}` : sql``}
        ${query.teamId ? sql`AND g.team_id = ${query.teamId}` : sql``})
        ${query.role && !query.teamId && !query.organizationId ? sql`OR EXISTS (SELECT 1 FROM membership_resource_scopes r WHERE r.tenant_id = ${auth.tenantId} AND r.user_id = ${tenantMemberships.id} AND r.role = ${internalRole(query.role)})` : sql``})`
            : undefined,
        ),
      )
      .orderBy(asc(tenantMemberships.id))
      .limit(query.limit + 1);
    return {
      items: rows.slice(0, query.limit),
      nextCursor: rows.length > query.limit ? rows[query.limit - 1]!.id : null,
    };
  }
  async get(
    auth: AuthenticatedPrincipal,
    id: string,
    executor: DatabaseExecutor = this.db,
  ): Promise<unknown> {
    if (!currentTenantExecutor() && executor === this.db)
      return withTenantContext(this.db, auth.tenantId, (tx) => this.get(auth, id, tx));
    const [row] = await executor
      .select({
        id: tenantMemberships.id,
        tenantId: tenantMemberships.tenantId,
        identityId: identities.id,
        email: identities.email,
        identityStatus: identities.status,
        displayName: tenantMemberships.displayName,
        status: tenantMemberships.status,
        invitedAt: tenantMemberships.invitedAt,
        activatedAt: tenantMemberships.activatedAt,
        suspendedAt: tenantMemberships.suspendedAt,
        departedAt: tenantMemberships.departedAt,
        updatedAt: tenantMemberships.updatedAt,
        capacity: membershipSettings.capacity,
      })
      .from(tenantMemberships)
      .innerJoin(identities, eq(identities.id, tenantMemberships.identityId))
      .leftJoin(membershipSettings, eq(membershipSettings.membershipId, tenantMemberships.id))
      .where(and(eq(tenantMemberships.tenantId, auth.tenantId), eq(tenantMemberships.id, id)));
    if (!row) throw new NotFoundException('Membership not found');
    const scopes = await this.permissions.effective(auth.tenantId, id, executor);
    const [work] = await executor
      .select({ count: sql<number>`count(*)::integer` })
      .from(campaignProspectAssignments)
      .where(
        and(
          eq(campaignProspectAssignments.tenantId, auth.tenantId),
          eq(campaignProspectAssignments.assignedUserId, id),
          isNull(campaignProspectAssignments.endedAt),
        ),
      );
    const roster = await executor.execute(
      sql`SELECT tm.*, t.name AS team_name, t.organization_id, (tm.revoked_at IS NULL AND tm.starts_at<=now() AND (tm.ends_at IS NULL OR tm.ends_at>now())) AS effective FROM team_memberships tm JOIN teams t ON t.tenant_id=tm.tenant_id AND t.id=tm.team_id WHERE tm.tenant_id=${auth.tenantId} AND tm.membership_id=${id} ORDER BY tm.starts_at DESC,tm.id DESC LIMIT 101`,
    );
    return {
      ...row,
      activeAssignments: work!.count,
      availableCapacity: row.capacity === null ? null : Math.max(0, row.capacity - work!.count),
      scopes,
      rosterHistory: { items: roster.rows.slice(0, 100), truncated: roster.rows.length > 100 },
    };
  }
  private async lock(auth: AuthenticatedPrincipal, id: string, executor: DatabaseExecutor) {
    await executor
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.id, auth.tenantId))
      .for('update');
    const [member] = await executor
      .select()
      .from(tenantMemberships)
      .where(and(eq(tenantMemberships.tenantId, auth.tenantId), eq(tenantMemberships.id, id)))
      .for('update');
    if (!member) throw new NotFoundException('Membership not found');
    return member;
  }
  async update(
    auth: AuthenticatedPrincipal,
    id: string,
    input: UpdateMembershipDto,
    ifMatch?: string,
  ): Promise<unknown> {
    if (!currentTenantExecutor())
      return withTenantContext(this.db, auth.tenantId, () => this.update(auth, id, input, ifMatch));
    if (!Object.entries(input).some(([key, value]) => key !== 'reason' && value !== undefined))
      throw new BadRequestException('At least one field is required');
    if ((input.role || input.status) && !input.reason?.trim())
      throw new BadRequestException('A reason is required for role or status changes');
    if (!input.role && (input.scopeType || input.organizationId || input.teamId))
      throw new BadRequestException('Scope fields require a role');
    return this.db.transaction(async (tx) => {
      const member = await this.lock(auth, id, tx);
      const before = (await this.get(auth, id, tx)) as { activeAssignments: number } & Record<
        string,
        unknown
      >;
      assertResourceMatches(ifMatch, before);
      if (input.status && input.status !== member.status) {
        if (member.status === 'invited' && input.status !== 'departed')
          throw new ConflictException('Pending invitations must be accepted by the invitee');
        if (member.status === 'departed')
          throw new ConflictException('Departed memberships cannot be reactivated');
        if (input.status === 'active' && member.status !== 'suspended')
          throw new ConflictException('Only suspended memberships can be reactivated');
        if (input.status !== 'active') await assertAdministratorRemains(tx, auth.tenantId, id);
        if (input.status === 'departed' && before.activeAssignments)
          throw new ConflictException('Reassign active work before ending membership');
        await tx
          .update(tenantMemberships)
          .set({
            status: input.status,
            suspendedAt:
              input.status === 'suspended'
                ? sql`clock_timestamp()`
                : input.status === 'active'
                  ? null
                  : member.suspendedAt,
            departedAt: input.status === 'departed' ? sql`clock_timestamp()` : null,
            updatedAt: sql`clock_timestamp()`,
          })
          .where(eq(tenantMemberships.id, id));
      }
      if (input.role) {
        if (member.status === 'departed' || input.status === 'departed')
          throw new ConflictException('Departed memberships cannot receive access');
        const scope = await this.validateScope(
          auth.tenantId,
          {
            role: input.role,
            scopeType:
              input.scopeType ??
              (input.teamId ? 'team' : input.organizationId ? 'organization' : 'tenant'),
            organizationId: input.organizationId,
            teamId: input.teamId,
          },
          tx,
        );
        const previous = await tx
          .select()
          .from(userAccessGrants)
          .where(
            and(eq(userAccessGrants.tenantId, auth.tenantId), eq(userAccessGrants.userId, id)),
          );
        if (previous.some((g) => g.role === 'client_admin') && scope.role !== 'client_admin')
          await assertAdministratorRemains(tx, auth.tenantId, id);
        for (const grant of previous)
          if (!(
            grant.role === scope.role &&
            grant.scopeType === scope.scopeType &&
            grant.organizationId === (scope.organizationId ?? null) &&
            grant.teamId === (scope.teamId ?? null)
          ))
            await this.assertGrantRemovable(auth.tenantId, grant, tx);
        await tx
          .delete(userAccessGrants)
          .where(
            and(eq(userAccessGrants.tenantId, auth.tenantId), eq(userAccessGrants.userId, id)),
          );
        await tx
          .delete(membershipResourceScopes)
          .where(
            and(
              eq(membershipResourceScopes.tenantId, auth.tenantId),
              eq(membershipResourceScopes.userId, id),
            ),
          );
        await tx.insert(userAccessGrants).values({ tenantId: auth.tenantId, userId: id, ...scope });
      }
      if (input.capacity !== undefined) {
        if (input.capacity !== null && input.capacity < before.activeAssignments)
          throw new ConflictException('Capacity cannot be lower than the current workload');
        await tx
          .insert(membershipSettings)
          .values({ tenantId: auth.tenantId, membershipId: id, capacity: input.capacity })
          .onConflictDoUpdate({
            target: membershipSettings.membershipId,
            set: { capacity: input.capacity, updatedAt: sql`clock_timestamp()` },
          });
      }
      if (input.displayName !== undefined)
        await tx
          .update(tenantMemberships)
          .set({ displayName: input.displayName, updatedAt: sql`clock_timestamp()` })
          .where(eq(tenantMemberships.id, id));
      const after = await this.get(auth, id, tx);
      await this.audit(auth, id, 'membership.updated', { reason: input.reason, before, after }, tx);
      return after;
    });
  }
  private async validateScope(
    tenantId: string,
    input: MembershipScopeDto,
    executor: DatabaseExecutor,
  ) {
    if (
      input.scopeType === 'campaign' ||
      input.scopeType === 'territory' ||
      input.campaignId ||
      input.territoryId ||
      input.accessLevel
    )
      throw new BadRequestException(
        'Use a resource scope for territory/campaign access; structural grants cannot include resource fields',
      );
    const scopeType = input.scopeType;
    const role = internalRole(input.role);
    const validShape =
      input.scopeType === 'tenant'
        ? !input.organizationId && !input.teamId
        : input.scopeType === 'organization'
          ? !!input.organizationId && !input.teamId
          : !!input.organizationId && !!input.teamId;
    const validRole =
      role === 'client_admin'
        ? input.scopeType === 'tenant'
        : role === 'director'
          ? input.scopeType === 'organization'
          : role === 'observer' || input.scopeType === 'team';
    if (!validShape || !validRole) throw new BadRequestException('Role and scope do not match');
    if (input.organizationId) {
      const [organization] = await executor
        .select()
        .from(organizations)
        .where(
          and(
            eq(organizations.tenantId, tenantId),
            eq(organizations.id, input.organizationId),
            eq(organizations.status, 'active'),
          ),
        );
      if (!organization) throw new NotFoundException('Organization is unavailable');
    }
    if (input.teamId) {
      const [team] = await executor
        .select()
        .from(teams)
        .where(
          and(
            eq(teams.tenantId, tenantId),
            eq(teams.organizationId, input.organizationId!),
            eq(teams.id, input.teamId),
            eq(teams.status, 'active'),
          ),
        );
      if (!team) throw new NotFoundException('Team is unavailable');
    }
    return {
      role,
      scopeType,
      organizationId: input.organizationId ?? null,
      teamId: input.teamId ?? null,
    };
  }
  async scopes(auth: AuthenticatedPrincipal, id: string) {
    await this.get(auth, id);
    const grants = await this.db
      .select()
      .from(userAccessGrants)
      .where(and(eq(userAccessGrants.tenantId, auth.tenantId), eq(userAccessGrants.userId, id)))
      .orderBy(asc(userAccessGrants.id));
    const resources = await this.db
      .select()
      .from(membershipResourceScopes)
      .where(
        and(
          eq(membershipResourceScopes.tenantId, auth.tenantId),
          eq(membershipResourceScopes.userId, id),
        ),
      )
      .orderBy(asc(membershipResourceScopes.id));
    const denials = await this.db
      .select()
      .from(membershipScopeDenials)
      .where(
        and(
          eq(membershipScopeDenials.tenantId, auth.tenantId),
          eq(membershipScopeDenials.userId, id),
        ),
      )
      .orderBy(asc(membershipScopeDenials.id));
    return [
      ...denials.map((row) => {
        const resource = { ...row, effect: 'deny' };
        return { ...resource, etag: resourceETag(resource) };
      }),
      ...[...grants, ...resources].map((grant) => {
        const resource = { ...grant, role: publicRole(grant.role) };
        return { ...resource, etag: resourceETag(resource) };
      }),
    ];
  }
  async addScope(auth: AuthenticatedPrincipal, id: string, input: MembershipScopeDto) {
    if (input.effect === 'deny') return this.mutateDenial(auth, id, null, input);
    if (input.scopeType === 'campaign' || input.scopeType === 'territory')
      return this.resourceScopes.mutate(auth, id, null, input);
    return this.scopeMutation(async (tx) => {
      const member = await this.lock(auth, id, tx);
      if (member.status === 'departed')
        throw new ConflictException('Departed memberships cannot receive access');
      const scope = await this.validateScope(auth.tenantId, input, tx);
      const [grant] = await tx
        .insert(userAccessGrants)
        .values({ tenantId: auth.tenantId, userId: id, ...scope })
        .returning();
      await this.audit(auth, id, 'membership.scope_added', { grant }, tx);
      return { ...grant!, role: publicRole(grant!.role) };
    });
  }
  async changeScope(
    auth: AuthenticatedPrincipal,
    scopeId: string,
    input: MembershipScopeDto | null,
    ifMatch?: string,
  ) {
    const [denial] = await this.db
      .select()
      .from(membershipScopeDenials)
      .where(
        and(
          eq(membershipScopeDenials.tenantId, auth.tenantId),
          eq(membershipScopeDenials.id, scopeId),
        ),
      );
    if (denial) return this.mutateDenial(auth, denial.userId, scopeId, input, ifMatch);
    if (input?.effect === 'deny')
      throw new BadRequestException(
        'Create a separate deny rule; an allow grant cannot be converted',
      );
    const [resource] = await this.db
      .select({ id: membershipResourceScopes.id })
      .from(membershipResourceScopes)
      .where(
        and(
          eq(membershipResourceScopes.tenantId, auth.tenantId),
          eq(membershipResourceScopes.id, scopeId),
        ),
      );
    if (resource) return this.resourceScopes.mutate(auth, null, scopeId, input, ifMatch);
    return this.scopeMutation(async (tx) => {
      const [located] = await tx
        .select()
        .from(userAccessGrants)
        .where(and(eq(userAccessGrants.id, scopeId), eq(userAccessGrants.tenantId, auth.tenantId)));
      if (!located) throw new NotFoundException('Scope not found');
      const member = await this.lock(auth, located.userId, tx);
      if (input && member.status === 'departed')
        throw new ConflictException('Departed memberships cannot receive access');
      const [before] = await tx
        .select()
        .from(userAccessGrants)
        .where(and(eq(userAccessGrants.id, scopeId), eq(userAccessGrants.tenantId, auth.tenantId)));
      if (!before) throw new NotFoundException('Scope not found');
      assertResourceMatches(ifMatch, { ...before, role: publicRole(before.role) });
      const replacement = input ? await this.validateScope(auth.tenantId, input, tx) : null;
      if (before.role === 'client_admin' && replacement?.role !== 'client_admin')
        await assertAdministratorRemains(tx, auth.tenantId, before.userId);
      if (
        !replacement ||
        replacement.role !== before.role ||
        replacement.teamId !== before.teamId ||
        replacement.organizationId !== before.organizationId
      )
        await this.assertGrantRemovable(auth.tenantId, before, tx);
      if (!replacement) {
        await tx.delete(userAccessGrants).where(eq(userAccessGrants.id, scopeId));
        await this.audit(auth, before.userId, 'membership.scope_removed', { before }, tx);
        return;
      }
      const [after] = await tx
        .update(userAccessGrants)
        .set(replacement)
        .where(eq(userAccessGrants.id, scopeId))
        .returning();
      await this.audit(auth, before.userId, 'membership.scope_changed', { before, after }, tx);
      return { ...after!, role: publicRole(after!.role) };
    });
  }
  private async mutateDenial(
    auth: AuthenticatedPrincipal,
    id: string,
    scopeId: string | null,
    input: MembershipScopeDto | null,
    ifMatch?: string,
  ) {
    return this.scopeMutation(async (tx) => {
      await this.lock(auth, id, tx);
      const admin = await tx.execute(
        sql`SELECT 1 FROM user_access_grants WHERE tenant_id=${auth.tenantId} AND user_id=${id} AND role='client_admin' AND scope_type='tenant'`,
      );
      if (input && admin.rows.length)
        throw new ConflictException(
          'Tenant administrator access cannot be denied; change the role first',
        );
      const [before] = scopeId
        ? await tx
            .select()
            .from(membershipScopeDenials)
            .where(
              and(
                eq(membershipScopeDenials.tenantId, auth.tenantId),
                eq(membershipScopeDenials.id, scopeId),
              ),
            )
        : [];
      if (scopeId && !before) throw new NotFoundException('Scope not found');
      if (before) assertResourceMatches(ifMatch, { ...before, effect: 'deny' });
      if (!input) {
        await tx.delete(membershipScopeDenials).where(eq(membershipScopeDenials.id, scopeId!));
        await this.audit(auth, id, 'membership.deny_removed', { before }, tx);
        return;
      }
      if (input.effect !== 'deny' || !input.reason?.trim() || input.role || input.accessLevel)
        throw new BadRequestException(
          'Deny rules require effect=deny and a reason, without role or accessLevel',
        );
      const resourceId =
        input.scopeType === 'tenant'
          ? auth.tenantId
          : input[
              `${input.scopeType}Id` as 'organizationId' | 'teamId' | 'campaignId' | 'territoryId'
            ];
      const keys = ['organizationId', 'teamId', 'campaignId', 'territoryId'] as const;
      if (!resourceId || keys.some((key) => input[key] && key !== `${input.scopeType}Id`))
        throw new BadRequestException('Supply only the identifier matching the deny scope');
      const table = {
        tenant: 'tenants',
        organization: 'organizations',
        team: 'teams',
        campaign: 'campaigns',
        territory: 'territories',
      }[input.scopeType];
      const exists = await tx.execute(
        sql`SELECT id FROM ${sql.identifier(table)} WHERE id=${resourceId} ${input.scopeType === 'tenant' ? sql`` : sql`AND tenant_id=${auth.tenantId}`}`,
      );
      if (!exists.rows.length) throw new NotFoundException('Scope resource not found');
      const values = {
        tenantId: auth.tenantId,
        userId: id,
        scopeType: input.scopeType,
        resourceId,
        reason: input.reason.trim(),
      };
      const [after] = before
        ? await tx
            .update(membershipScopeDenials)
            .set({ ...values, updatedAt: sql`clock_timestamp()` })
            .where(eq(membershipScopeDenials.id, scopeId!))
            .returning()
        : await tx.insert(membershipScopeDenials).values(values).returning();
      await this.audit(
        auth,
        id,
        before ? 'membership.deny_changed' : 'membership.deny_added',
        { before, after },
        tx,
      );
      return { ...after!, effect: 'deny' };
    });
  }
  private async scopeMutation<T>(callback: (executor: DatabaseExecutor) => Promise<T>) {
    try {
      return await this.db.transaction(callback);
    } catch (error) {
      if (
        error instanceof Error &&
        (error.cause as { code?: string } | undefined)?.code === '23505'
      )
        throw new ConflictException('This scope grant already exists');
      throw error;
    }
  }
  private async assertGrantRemovable(
    tenantId: string,
    grant: typeof userAccessGrants.$inferSelect,
    executor: DatabaseExecutor,
  ) {
    if (grant.role === 'prospector' && grant.teamId) {
      const [assignment] = await executor
        .select({ id: campaignProspectAssignments.id })
        .from(campaignProspectAssignments)
        .where(
          and(
            eq(campaignProspectAssignments.tenantId, tenantId),
            eq(campaignProspectAssignments.assignedUserId, grant.userId),
            eq(campaignProspectAssignments.teamId, grant.teamId),
            isNull(campaignProspectAssignments.endedAt),
          ),
        )
        .limit(1);
      if (assignment)
        throw new ConflictException('Reassign active work before removing its prospector scope');
    }
    if (grant.role === 'manager' && grant.teamId) {
      const [configured] = await executor
        .select({ id: teamSettings.teamId })
        .from(teamSettings)
        .where(
          and(
            eq(teamSettings.tenantId, tenantId),
            eq(teamSettings.teamId, grant.teamId),
            eq(teamSettings.managerMembershipId, grant.userId),
          ),
        );
      if (configured)
        throw new ConflictException(
          'Change the configured team manager before removing this scope',
        );
    }
  }
  async history(auth: AuthenticatedPrincipal, id: string, query: ListMembershipsDto) {
    await this.get(auth, id);
    const result = await this.db.execute(sql`
      SELECT payload, digest, id,
        digest = encode(sha256(convert_to(payload::text, 'UTF8')), 'hex') AS verified
      FROM membership_access_evidence
      WHERE tenant_id=${auth.tenantId} AND membership_id=${id}
      ${query.cursor ? sql`AND (occurred_at,id) < (SELECT occurred_at,id FROM membership_access_evidence WHERE tenant_id=${auth.tenantId} AND membership_id=${id} AND id=${query.cursor})` : sql``}
      ORDER BY occurred_at DESC,id DESC LIMIT ${query.limit + 1}`);
    return {
      items: result.rows.slice(0, query.limit).map((row) => ({
        ...(row.payload as Record<string, unknown>),
        integrity: { algorithm: 'sha256', digest: row.digest, verified: row.verified },
      })),
      nextCursor: result.rows.length > query.limit ? result.rows[query.limit - 1]!.id : null,
    };
  }

  private async audit(
    auth: AuthenticatedPrincipal,
    id: string,
    action: string,
    metadata: Record<string, unknown>,
    executor: DatabaseExecutor,
  ) {
    await executor.insert(auditEvents).values({
      tenantId: auth.tenantId,
      actorType: 'user',
      actorUserId: auth.membershipId,
      action,
      resourceType: 'tenant_membership',
      resourceId: id,
      metadata,
    });
  }
}
