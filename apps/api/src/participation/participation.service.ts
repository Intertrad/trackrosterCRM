import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, gt, sql } from 'drizzle-orm';
import { DATABASE } from '../database/database.constants.js';
import type { Database, DatabaseExecutor } from '../database/database.types.js';
import {
  auditEvents,
  campaignMembers,
  campaigns,
  identities,
  organizations,
  teams,
  tenantMemberships,
  tenants,
  territories,
  territoryAssignments,
} from '../database/schema/index.js';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import {
  ResourceScopeService,
  type ResourceKind,
} from '../resource-scopes/resource-scope.service.js';
import { assertResourceMatches, resourceETag } from '../http/resource-etag.js';
import type {
  CreateCampaignMemberDto,
  CreateTerritoryAssignmentDto,
  ListParticipationDto,
  UpdateCampaignMemberDto,
  UpdateTerritoryAssignmentDto,
} from './participation.dto.js';
type CreateInput = CreateCampaignMemberDto | CreateTerritoryAssignmentDto;
type UpdateInput = UpdateCampaignMemberDto | UpdateTerritoryAssignmentDto;
type RecordRow = typeof campaignMembers.$inferSelect | typeof territoryAssignments.$inferSelect;

@Injectable()
export class ParticipationService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly scopes: ResourceScopeService,
  ) {}
  private table(kind: ResourceKind) {
    return kind === 'campaign' ? campaignMembers : territoryAssignments;
  }
  private resourceId(kind: ResourceKind, row: RecordRow) {
    return kind === 'campaign'
      ? (row as typeof campaignMembers.$inferSelect).campaignId
      : (row as typeof territoryAssignments.$inferSelect).territoryId;
  }
  async requireMutation(
    auth: AuthenticatedPrincipal,
    kind: ResourceKind,
    id: string,
    tx: DatabaseExecutor = this.db,
  ) {
    const table = this.table(kind);
    const [row] = await tx
      .select()
      .from(table)
      .where(and(eq(table.tenantId, auth.tenantId), eq(table.id, id)));
    if (!row) throw new NotFoundException('Participation record not found');
    await this.scopes.require(auth, kind, this.resourceId(kind, row), 'manage', tx);
    return row;
  }
  async list(
    auth: AuthenticatedPrincipal,
    kind: ResourceKind,
    query: ListParticipationDto,
    campaignId?: string,
  ) {
    if (kind === 'campaign') {
      if (query.territoryId)
        throw new BadRequestException('Territory filter is not supported for campaign members');
      await this.scopes.require(auth, kind, campaignId!);
    } else if (query.territoryId) await this.scopes.require(auth, kind, query.territoryId);
    const table = this.table(kind);
    const resource = kind === 'campaign' ? campaigns : territories;
    const resourceColumn =
      kind === 'campaign' ? campaignMembers.campaignId : territoryAssignments.territoryId;
    const state = sql<string>`CASE WHEN ${table.revokedAt} IS NOT NULL THEN 'revoked'
      WHEN ${table.endsAt} <= CURRENT_TIMESTAMP THEN 'ended'
      WHEN ${table.startsAt} > CURRENT_TIMESTAMP THEN 'scheduled' ELSE 'active' END`;
    const rows = await this.db
      .select({ record: table, state })
      .from(table)
      .innerJoin(
        resource,
        and(eq(resource.tenantId, table.tenantId), eq(resource.id, resourceColumn)),
      )
      .where(
        and(
          this.scopes.predicate(auth, kind),
          kind === 'campaign'
            ? eq(campaignMembers.campaignId, campaignId!)
            : query.territoryId
              ? eq(territoryAssignments.territoryId, query.territoryId)
              : undefined,
          query.membershipId ? eq(table.membershipId, query.membershipId) : undefined,
          query.teamId ? eq(table.teamId, query.teamId) : undefined,
          query.cursor ? gt(table.id, query.cursor) : undefined,
          query.state === 'all' ? undefined : sql`${state} = ${query.state}`,
        ),
      )
      .orderBy(table.id)
      .limit(query.limit + 1);
    return {
      items: rows
        .slice(0, query.limit)
        .map(({ record, state }) => ({ ...record, state, etag: resourceETag(record) })),
      nextCursor: rows.length > query.limit ? rows[query.limit - 1]!.record.id : null,
    };
  }
  private async lock(auth: AuthenticatedPrincipal, tx: DatabaseExecutor) {
    /*
     * `no key update`, not `update`, and the difference is a deadlock.
     *
     * These routes are idempotent, so by the time the handler runs the
     * interceptor has already inserted an idempotency record — and that row's
     * foreign key to `tenants` takes a FOR KEY SHARE lock on this very tuple.
     * Asking for FOR UPDATE afterwards is a lock upgrade, and FOR UPDATE is the
     * one mode FOR KEY SHARE conflicts with: two concurrent requests each hold
     * KEY SHARE and each wait for the other to release it, which PostgreSQL
     * resolves as deadlock (40P01) rather than as the 409 the caller expects.
     *
     * FOR NO KEY UPDATE is compatible with FOR KEY SHARE, so the upgrade no
     * longer conflicts, while remaining exclusive against itself — which is all
     * this lock is for: serialising concurrent writers within one tenant.
     * assignment-batch, consents, reservation-rule and outcome-settings already
     * use this mode for the same reason.
     */
    await tx
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.id, auth.tenantId))
      .for('no key update');
  }
  private async subject(auth: AuthenticatedPrincipal, input: CreateInput, tx: DatabaseExecutor) {
    if (Boolean(input.membershipId) === Boolean(input.teamId))
      throw new BadRequestException('Exactly one membershipId or teamId is required');
    if (input.membershipId) {
      const [member] = await tx
        .select({ id: tenantMemberships.id })
        .from(tenantMemberships)
        .innerJoin(identities, eq(identities.id, tenantMemberships.identityId))
        .where(
          and(
            eq(tenantMemberships.tenantId, auth.tenantId),
            eq(tenantMemberships.id, input.membershipId),
            eq(tenantMemberships.status, 'active'),
            eq(identities.status, 'active'),
          ),
        )
        .for('share');
      if (!member) throw new NotFoundException('Active membership not found');
    } else {
      const [team] = await tx
        .select({ id: teams.id })
        .from(teams)
        .innerJoin(
          organizations,
          and(
            eq(organizations.tenantId, teams.tenantId),
            eq(organizations.id, teams.organizationId),
          ),
        )
        .where(
          and(
            eq(teams.tenantId, auth.tenantId),
            eq(teams.id, input.teamId!),
            eq(teams.status, 'active'),
            eq(organizations.status, 'active'),
          ),
        )
        .for('share');
      if (!team) throw new NotFoundException('Active team not found');
    }
  }
  private async available(
    auth: AuthenticatedPrincipal,
    kind: ResourceKind,
    id: string,
    tx: DatabaseExecutor,
  ) {
    await this.scopes.require(auth, kind, id, 'manage', tx);
    const table = kind === 'campaign' ? campaigns : territories;
    const [resource] = await tx
      .select({ status: table.status })
      .from(table)
      .where(and(eq(table.tenantId, auth.tenantId), eq(table.id, id)))
      .for('share');
    if (!resource || ['inactive', 'archived', 'completed'].includes(resource.status))
      throw new ConflictException('Resource is not accepting participation');
  }
  private dates(input: { startsAt?: string; endsAt?: string | null }, before?: RecordRow) {
    const startsAt =
      input.startsAt === undefined ? (before?.startsAt ?? new Date()) : new Date(input.startsAt);
    const endsAt =
      input.endsAt === undefined
        ? (before?.endsAt ?? null)
        : input.endsAt === null
          ? null
          : new Date(input.endsAt);
    if (
      !Number.isFinite(startsAt.getTime()) ||
      (endsAt && (!Number.isFinite(endsAt.getTime()) || endsAt <= startsAt))
    )
      throw new BadRequestException('endsAt must be after startsAt');
    return { startsAt, endsAt };
  }
  private async overlap(
    auth: AuthenticatedPrincipal,
    kind: ResourceKind,
    resourceId: string,
    subject: { membershipId?: string | null; teamId?: string | null },
    dates: { startsAt: Date; endsAt: Date | null },
    tx: DatabaseExecutor,
    except?: string,
  ) {
    const table = this.table(kind);
    const resourceColumn =
      kind === 'campaign' ? campaignMembers.campaignId : territoryAssignments.territoryId;
    const rows = await tx
      .select({ id: table.id })
      .from(table)
      .where(
        and(
          eq(table.tenantId, auth.tenantId),
          eq(resourceColumn, resourceId),
          subject.membershipId
            ? eq(table.membershipId, subject.membershipId)
            : eq(table.teamId, subject.teamId!),
          sql`${table.revokedAt} IS NULL`,
          except ? sql`${table.id} <> ${except}` : undefined,
          sql`tstzrange(${table.startsAt}, ${table.endsAt}, '[)') && tstzrange(${dates.startsAt.toISOString()}::timestamptz, ${dates.endsAt?.toISOString() ?? null}::timestamptz, '[)')`,
        ),
      )
      .limit(1);
    if (rows.length)
      throw new ConflictException('This participant already has an overlapping effective period');
  }
  private async transaction<T>(run: (tx: DatabaseExecutor) => Promise<T>) {
    try {
      return await this.db.transaction(run);
    } catch (error) {
      if (['23505', '23P01'].includes((error as { cause?: { code?: string } }).cause?.code ?? ''))
        throw new ConflictException('This participant already has an overlapping effective period');
      throw error;
    }
  }
  async create(
    auth: AuthenticatedPrincipal,
    kind: ResourceKind,
    resourceId: string,
    input: CreateInput,
  ) {
    return this.transaction(async (tx) => {
      await this.lock(auth, tx);
      await this.available(auth, kind, resourceId, tx);
      await this.subject(auth, input, tx);
      const dates = this.dates(input);
      await this.overlap(auth, kind, resourceId, input, dates, tx);
      const common = {
        tenantId: auth.tenantId,
        membershipId: input.membershipId ?? null,
        teamId: input.teamId ?? null,
        ...dates,
      };
      const [after] =
        kind === 'campaign'
          ? await tx
              .insert(campaignMembers)
              .values({
                ...common,
                campaignId: resourceId,
                campaignRole: (input as CreateCampaignMemberDto).campaignRole ?? 'member',
              })
              .returning()
          : await tx
              .insert(territoryAssignments)
              .values({
                ...common,
                territoryId: resourceId,
                priority: (input as CreateTerritoryAssignmentDto).priority ?? 100,
              })
              .returning();
      await this.audit(auth, kind, after!.id, 'created', { after }, tx);
      return after!;
    });
  }
  async update(
    auth: AuthenticatedPrincipal,
    kind: ResourceKind,
    id: string,
    input: UpdateInput | null,
    ifMatch?: string,
  ) {
    if (input && !Object.values(input).some((v) => v !== undefined))
      throw new BadRequestException('At least one field is required');
    return this.transaction(async (tx) => {
      await this.lock(auth, tx);
      const before = await this.requireMutation(auth, kind, id, tx);
      assertResourceMatches(ifMatch, before);
      if (before.revokedAt) {
        if (!input) return before;
        throw new ConflictException('Ended participation cannot be edited; create a new period');
      }
      let after: RecordRow;
      if (!input) {
        const table = this.table(kind);
        [after] = (await tx
          .update(table)
          .set({ revokedAt: sql`clock_timestamp()`, updatedAt: sql`clock_timestamp()` })
          .where(eq(table.id, id))
          .returning()) as [RecordRow];
      } else {
        if (before.endsAt && before.endsAt <= new Date())
          throw new ConflictException(
            'Expired participation cannot be reopened; create a new period',
          );
        const resourceId = this.resourceId(kind, before);
        await this.available(auth, kind, resourceId, tx);
        await this.subject(
          auth,
          { membershipId: before.membershipId ?? undefined, teamId: before.teamId ?? undefined },
          tx,
        );
        const dates = this.dates(input, before);
        await this.overlap(auth, kind, resourceId, before, dates, tx, id);
        const common = { ...dates, updatedAt: sql`clock_timestamp()` };
        [after] = (
          kind === 'campaign'
            ? await tx
                .update(campaignMembers)
                .set({ ...common, campaignRole: (input as UpdateCampaignMemberDto).campaignRole })
                .where(eq(campaignMembers.id, id))
                .returning()
            : await tx
                .update(territoryAssignments)
                .set({ ...common, priority: (input as UpdateTerritoryAssignmentDto).priority })
                .where(eq(territoryAssignments.id, id))
                .returning()
        ) as [RecordRow];
      }
      await this.audit(auth, kind, id, input ? 'updated' : 'ended', { before, after }, tx);
      return after;
    });
  }
  private async audit(
    auth: AuthenticatedPrincipal,
    kind: ResourceKind,
    id: string,
    action: string,
    metadata: Record<string, unknown>,
    tx: DatabaseExecutor,
  ) {
    const resourceType = kind === 'campaign' ? 'campaign_member' : 'territory_assignment';
    await tx.insert(auditEvents).values({
      tenantId: auth.tenantId,
      actorType: 'user',
      actorUserId: auth.membershipId,
      resourceType,
      resourceId: id,
      action: `${resourceType}.${action}`,
      metadata,
    });
  }
}
