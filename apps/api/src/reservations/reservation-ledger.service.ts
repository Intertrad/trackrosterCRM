import { Inject, Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { DATABASE } from '../database/database.constants.js';
import type { Database, DatabaseExecutor } from '../database/database.types.js';
import { reservationRecords, reservationEvents } from '../database/schema/index.js';
import { RedisService } from '../redis/redis.service.js';
import type { ProspectReservation } from './reservation.types.js';
@Injectable()
export class ReservationLedgerService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private busy = false;
  private readonly logger = new Logger(ReservationLedgerService.name);
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly redis: RedisService,
  ) {}
  onModuleInit() {
    if (process.env.RESERVATION_RECONCILIATION === 'off') return;
    this.timer = setInterval(() => {
      void this.reconcile().catch(() =>
        this.logger.warn('Reservation evidence reconciliation will retry'),
      );
    }, 5000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  async event(
    tx: DatabaseExecutor,
    tenantId: string,
    id: string,
    type: string,
    data: Record<string, unknown> = {},
  ) {
    await tx.insert(reservationEvents).values({ tenantId, reservationId: id, type, data });
  }
  async prepare(lease: ProspectReservation, rule: Record<string, unknown>) {
    await this.db.transaction(async (tx) => {
      await tx.insert(reservationRecords).values({
        id: lease.reservationId,
        tenantId: lease.tenantId,
        campaignId: lease.campaignId,
        campaignProspectId: lease.campaignProspectId,
        establishmentId: lease.establishmentId,
        ownerMembershipId: lease.userId,
        lease,
        ruleSnapshot: rule,
        expiresAt: new Date(lease.expiresAt),
      });
      await this.event(tx, lease.tenantId, lease.reservationId, 'claim_requested');
    });
  }
  async observeLegacy(lease: ProspectReservation, rule: Record<string, unknown>) {
    await this.db.transaction(async (tx) => {
      const [added] = await tx
        .insert(reservationRecords)
        .values({
          id: lease.reservationId,
          tenantId: lease.tenantId,
          campaignId: lease.campaignId,
          campaignProspectId: lease.campaignProspectId,
          establishmentId: lease.establishmentId,
          ownerMembershipId: lease.userId,
          lease,
          ruleSnapshot: rule,
          status: 'active',
          expiresAt: new Date(lease.expiresAt),
        })
        .onConflictDoNothing()
        .returning();
      if (added)
        await this.event(tx, lease.tenantId, lease.reservationId, 'legacy_lease_observed', {
          expiresAt: lease.expiresAt,
        });
    });
  }
  async confirm(lease: ProspectReservation, type = 'claimed') {
    await this.db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(reservationRecords)
        .where(
          and(
            eq(reservationRecords.tenantId, lease.tenantId),
            eq(reservationRecords.id, lease.reservationId),
          ),
        )
        .for('update');
      if (!row) return; // Reservations made before registry deployment have no invented history.
      if (row.status === 'active' && row.expiresAt.toISOString() === lease.expiresAt) return;
      await tx
        .update(reservationRecords)
        .set({
          lease,
          status: 'active',
          expiresAt: new Date(lease.expiresAt),
          updatedAt: sql`clock_timestamp()`,
        })
        .where(eq(reservationRecords.id, row.id));
      await this.event(tx, row.tenantId, row.id, type, { expiresAt: lease.expiresAt });
    });
  }
  async recordAttempt(
    tenantId: string,
    id: string,
    type: string,
    data: Record<string, unknown> = {},
  ) {
    await this.event(this.db, tenantId, id, `${type}_requested`, data);
  }
  async close(tenantId: string, id: string, status: 'released' | 'failed', reason: string) {
    await this.db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(reservationRecords)
        .where(and(eq(reservationRecords.tenantId, tenantId), eq(reservationRecords.id, id)))
        .for('update');
      if (!row || row.status === status) return;
      await tx
        .update(reservationRecords)
        .set({ status, updatedAt: sql`clock_timestamp()` })
        .where(eq(reservationRecords.id, id));
      await this.event(tx, tenantId, id, status, { reason });
    });
  }
  async refresh(tenantId: string, id: string) {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(reservationRecords)
        .where(and(eq(reservationRecords.tenantId, tenantId), eq(reservationRecords.id, id)))
        .for('update');
      if (!row) return null;
      const [raw, paired, legacy] = await this.redis
        .getClient()
        .mGet([
          ['trackroster', 'reservation', tenantId, row.campaignId, row.campaignProspectId].join(
            ':',
          ),
          [
            'trackroster',
            'collision',
            tenantId,
            row.lease.organizationId,
            row.establishmentId,
          ].join(':'),
          ['trackroster', 'collision', tenantId, row.establishmentId].join(':'),
        ]);
      const live = raw ? (JSON.parse(raw) as ProspectReservation) : null;
      const pair = paired ? (JSON.parse(paired) as ProspectReservation) : null;
      const old = legacy ? (JSON.parse(legacy) as ProspectReservation) : null;
      const pairValid =
        (pair?.reservationId === id && pair.expiresAt === live?.expiresAt) ||
        (old?.reservationId === id && old.expiresAt === live?.expiresAt);
      if (live?.reservationId === id && live.userId === row.ownerMembershipId && pairValid) {
        if (row.status !== 'active' || row.expiresAt.toISOString() !== live.expiresAt) {
          const [updated] = await tx
            .update(reservationRecords)
            .set({
              lease: live,
              status: 'active',
              expiresAt: new Date(live.expiresAt),
              updatedAt: sql`clock_timestamp()`,
            })
            .where(eq(reservationRecords.id, id))
            .returning();
          await this.event(tx, tenantId, id, 'live_state_observed', { expiresAt: live.expiresAt });
          return updated!;
        }
        return row;
      }
      if (['released', 'expired', 'failed', 'lost'].includes(row.status)) return row;
      // A claim may still be in flight. Do not invent a failure while its lease window is open.
      if (row.status === 'pending' && row.expiresAt.getTime() > Date.now()) return row;
      const expired = row.expiresAt.getTime() <= Date.now();
      const status = expired ? 'expired' : 'lost';
      const [updated] = await tx
        .update(reservationRecords)
        .set({ status, updatedAt: sql`clock_timestamp()` })
        .where(eq(reservationRecords.id, id))
        .returning();
      await this.event(tx, tenantId, id, expired ? 'expiry_observed' : 'absence_observed', {
        scheduledExpiresAt: row.expiresAt.toISOString(),
        previousStatus: row.status,
        reason: live ? 'replaced_or_inconsistent_lock_pair' : 'absent',
      });
      return updated!;
    });
  }
  async reconcile() {
    if (this.busy) return;
    this.busy = true;
    try {
      const rows = await this.db
        .select({ id: reservationRecords.id, tenantId: reservationRecords.tenantId })
        .from(reservationRecords)
        .where(inArray(reservationRecords.status, ['pending', 'active']))
        .orderBy(reservationRecords.updatedAt, reservationRecords.id)
        .limit(100);
      let failure: unknown;
      for (const row of rows) {
        try {
          await this.refresh(row.tenantId, row.id);
        } catch (error) {
          failure = error;
        }
        // Rotate inspected rows even on a malformed Redis value so one record cannot starve others.
        await this.db
          .update(reservationRecords)
          .set({ updatedAt: sql`clock_timestamp()` })
          .where(eq(reservationRecords.id, row.id));
      }
      if (failure) throw failure;
    } finally {
      this.busy = false;
    }
  }
}
