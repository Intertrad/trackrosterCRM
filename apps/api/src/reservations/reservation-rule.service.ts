import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { DATABASE } from '../database/database.constants.js';
import type { Database, DatabaseExecutor } from '../database/database.types.js';
import {
  auditEvents,
  campaigns,
  reservationRules,
  tenantMemberships,
  tenants,
  userAccessGrants,
} from '../database/schema/index.js';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { assertResourceMatches, resourceETag } from '../http/resource-etag.js';
import type {
  CreateReservationRuleDto,
  ReservationRulePatchDto,
  ReservationListDto,
} from './reservation-lifecycle.dto.js';
@Injectable()
export class ReservationRuleService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}
  async authorize(a: AuthenticatedPrincipal, tx: DatabaseExecutor = this.db) {
    const [actor] = await tx
      .select({ id: tenantMemberships.id })
      .from(tenantMemberships)
      .innerJoin(
        userAccessGrants,
        and(
          eq(userAccessGrants.tenantId, tenantMemberships.tenantId),
          eq(userAccessGrants.userId, tenantMemberships.id),
        ),
      )
      .where(
        and(
          eq(tenantMemberships.tenantId, a.tenantId),
          eq(tenantMemberships.id, a.membershipId),
          eq(tenantMemberships.status, 'active'),
          eq(userAccessGrants.scopeType, 'tenant'),
          eq(userAccessGrants.role, 'client_admin'),
        ),
      );
    if (!actor) throw new ForbiddenException('Tenant administrator required');
  }
  async row(a: AuthenticatedPrincipal, id: string, tx: DatabaseExecutor = this.db) {
    await this.authorize(a, tx);
    const [r] = await tx
      .select()
      .from(reservationRules)
      .where(and(eq(reservationRules.tenantId, a.tenantId), eq(reservationRules.id, id)));
    if (!r) throw new NotFoundException('Reservation rule not found');
    return r;
  }
  async detail(a: AuthenticatedPrincipal, id: string) {
    const r = await this.row(a, id);
    return { ...r, etag: resourceETag(r) };
  }
  async list(a: AuthenticatedPrincipal, q: ReservationListDto) {
    await this.authorize(a);
    const rows = await this.db
      .select()
      .from(reservationRules)
      .where(
        and(
          eq(reservationRules.tenantId, a.tenantId),
          q.campaignId ? eq(reservationRules.campaignId, q.campaignId) : undefined,
          q.cursor ? gt(reservationRules.id, q.cursor) : undefined,
        ),
      )
      .orderBy(reservationRules.id)
      .limit(q.limit + 1);
    return {
      items: rows.slice(0, q.limit).map((r) => ({ ...r, etag: resourceETag(r) })),
      nextCursor: rows.length > q.limit ? rows[q.limit - 1]!.id : null,
    };
  }
  async change(
    a: AuthenticatedPrincipal,
    op: 'create' | 'update' | 'deactivate',
    input: CreateReservationRuleDto | ReservationRulePatchDto,
    id?: string,
    version?: string,
  ) {
    if (Object.entries(input).some(([key, value]) => key !== 'campaignId' && value === null))
      throw new BadRequestException('Rule fields cannot be null');
    return this.db.transaction(async (tx) => {
      await tx
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.id, a.tenantId))
        .for('no key update');
      await this.authorize(a, tx);
      const old = id ? await this.row(a, id, tx) : null;
      if (old) assertResourceMatches(version, old);
      if (old && !old.isActive)
        throw new ConflictException('Rule is deactivated; create a replacement');
      const campaignId =
        old?.campaignId ?? ('campaignId' in input ? input.campaignId : null) ?? null;
      if (campaignId) {
        const [campaign] = await tx
          .select()
          .from(campaigns)
          .where(and(eq(campaigns.tenantId, a.tenantId), eq(campaigns.id, campaignId)));
        if (!campaign) throw new NotFoundException('Campaign not found');
      }
      const values = {
        durationMinutes: old?.durationMinutes ?? 20,
        cooldownMinutes: old?.cooldownMinutes ?? 60,
        maxHoldMinutes: old?.maxHoldMinutes ?? 120,
        allowHeartbeat: old?.allowHeartbeat ?? true,
        allowExtension: old?.allowExtension ?? true,
        allowManagerOverride: old?.allowManagerOverride ?? true,
        ...Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)),
      };
      if (values.maxHoldMinutes < values.durationMinutes)
        throw new BadRequestException('Maximum hold must cover initial duration');
      if (op === 'create') {
        const [duplicate] = await tx
          .select()
          .from(reservationRules)
          .where(
            and(
              eq(reservationRules.tenantId, a.tenantId),
              eq(reservationRules.isActive, true),
              campaignId
                ? eq(reservationRules.campaignId, campaignId)
                : isNull(reservationRules.campaignId),
            ),
          );
        if (duplicate) throw new ConflictException('An active rule already exists for this scope');
      }
      const [r] =
        op === 'create'
          ? await tx
              .insert(reservationRules)
              .values({ ...values, campaignId, tenantId: a.tenantId })
              .returning()
          : await tx
              .update(reservationRules)
              .set(
                op === 'deactivate'
                  ? { isActive: false, updatedAt: sql`clock_timestamp()` }
                  : { ...values, updatedAt: sql`clock_timestamp()` },
              )
              .where(and(eq(reservationRules.tenantId, a.tenantId), eq(reservationRules.id, id!)))
              .returning();
      await tx.insert(auditEvents).values({
        tenantId: a.tenantId,
        actorType: 'user',
        actorUserId: a.membershipId,
        action: `reservation_rule.${op}`,
        resourceType: 'reservation_rule',
        resourceId: r!.id,
        metadata: { before: old, after: r },
      });
      return { ...r!, etag: resourceETag(r!) };
    });
  }
}
