import { Inject, Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { DATABASE } from '../database/database.constants.js';
import { discoverSweepWork, sweepByTenant } from '../database/tenant-sweep.js';
import type { Database, DatabaseExecutor } from '../database/database.types.js';
import {
  currentTenantExecutor,
  runWithoutTenantExecutor,
} from '../database/request-tenant-executor.js';
import { setTenantContext } from '../database/tenant-context.js';
import {
  reservationEvents,
  reservationIntents,
  reservationRecords,
} from '../database/schema/index.js';
import { RedisService } from '../redis/redis.service.js';
import type { ProspectReservation } from './reservation.types.js';

export class ReservationClaimConflictError extends Error {
  readonly code = 'RESERVATION_CLAIM_CONFLICT';
}
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
  async prepare(
    lease: ProspectReservation,
    rule: Record<string, unknown>,
    blockingOrganizationIds: string[] = [],
  ) {
    /*
     * The request transaction may hold campaign, establishment or assignment
     * locks while Redis is contacted. Do not insert reservation_records here:
     * its guard trigger takes locks that can deadlock with that request. The
     * intent log has only the tenant FK and commits on an independent
     * connection before the external lease is acquired.
     */
    void blockingOrganizationIds;
    await runWithoutTenantExecutor(() =>
      this.db.transaction(async (tx) => {
        await setTenantContext(tx, lease.tenantId);
        await tx
          .insert(reservationIntents)
          .values({
            id: lease.reservationId,
            tenantId: lease.tenantId,
            campaignId: lease.campaignId,
            campaignProspectId: lease.campaignProspectId,
            establishmentId: lease.establishmentId,
            ownerMembershipId: lease.userId,
            lease,
            ruleSnapshot: rule,
          })
          .onConflictDoNothing();
      }),
    );
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
  async persistPending(lease: ProspectReservation, rule: Record<string, unknown>) {
    await runWithoutTenantExecutor(() =>
      this.db.transaction(async (tx) => {
        await setTenantContext(tx, lease.tenantId);
        const [intent] = await tx
          .select()
          .from(reservationIntents)
          .where(
            and(
              eq(reservationIntents.tenantId, lease.tenantId),
              eq(reservationIntents.id, lease.reservationId),
            ),
          );
        if (!intent) {
          await tx
            .insert(reservationIntents)
            .values({
              id: lease.reservationId,
              tenantId: lease.tenantId,
              campaignId: lease.campaignId,
              campaignProspectId: lease.campaignProspectId,
              establishmentId: lease.establishmentId,
              ownerMembershipId: lease.userId,
              lease,
              ruleSnapshot: rule,
            })
            .onConflictDoNothing();
        }
        const [existing] = await tx
          .select({ id: reservationRecords.id })
          .from(reservationRecords)
          .where(
            and(
              eq(reservationRecords.tenantId, lease.tenantId),
              eq(reservationRecords.id, lease.reservationId),
            ),
          );
        await this.materializeIntent(tx, lease.tenantId, lease.reservationId, 'pending');
        if (!existing) await this.event(tx, lease.tenantId, lease.reservationId, 'claim_requested');
      }),
    );
  }
  async confirm(lease: ProspectReservation, type = 'claimed') {
    const confirmWith = async (tx: DatabaseExecutor) => {
      await setTenantContext(tx, lease.tenantId);
      const [existing] = await tx
        .select({ id: reservationRecords.id })
        .from(reservationRecords)
        .where(
          and(
            eq(reservationRecords.tenantId, lease.tenantId),
            eq(reservationRecords.id, lease.reservationId),
          ),
        );
      const row = await this.materializeIntent(tx, lease.tenantId, lease.reservationId, 'active');
      if (!row) return; // Reservations made before the intent log have no invented history.
      if (!existing) {
        await this.event(tx, lease.tenantId, lease.reservationId, type, {
          expiresAt: lease.expiresAt,
        });
        return;
      }
      if (row.status === 'active' && row.expiresAt.toISOString() === lease.expiresAt) return;
      if (['released', 'expired', 'lost', 'failed'].includes(row.status)) return;
      await tx
        .update(reservationRecords)
        .set({
          lease,
          status: 'active',
          expiresAt: new Date(lease.expiresAt),
          updatedAt: sql`clock_timestamp()`,
        })
        .where(
          and(
            eq(reservationRecords.tenantId, lease.tenantId),
            eq(reservationRecords.id, lease.reservationId),
          ),
        );
      await this.event(tx, lease.tenantId, lease.reservationId, type, {
        expiresAt: lease.expiresAt,
      });
    };
    /*
     * A legacy claim already materializes its record in the active request
     * transaction before calling confirm. Reusing that executor avoids a
     * self-deadlock where an independent confirmation waits on the
     * uncommitted record while the request waits for confirmation. Background
     * reconciliation and external-lease paths have no active executor, so
     * they retain the independent tenant-scoped transaction boundary.
     */
    const active = currentTenantExecutor();
    if (active) await confirmWith(active);
    else await runWithoutTenantExecutor(() => this.db.transaction(confirmWith));
  }
  async recordAttempt(
    tenantId: string,
    id: string,
    type: string,
    data: Record<string, unknown> = {},
  ) {
    await this.event(this.db, tenantId, id, `${type}_requested`, data);
  }

  private async materializeIntent(
    tx: DatabaseExecutor,
    tenantId: string,
    id: string,
    status: 'pending' | 'active' | 'released' | 'failed' | 'expired' | 'lost',
  ) {
    const [existing] = await tx
      .select()
      .from(reservationRecords)
      .where(and(eq(reservationRecords.tenantId, tenantId), eq(reservationRecords.id, id)))
      .for('update');
    if (existing) return existing;

    // Intent rows are immutable and the runtime role is intentionally denied
    // UPDATE/DELETE. The reservation record lock above is the mutable
    // serialization point; locking the intent would require UPDATE privilege
    // and makes restricted-runtime reconciliation fail with 42501.
    const [intent] = await tx
      .select()
      .from(reservationIntents)
      .where(and(eq(reservationIntents.tenantId, tenantId), eq(reservationIntents.id, id)));
    if (!intent) return null;

    const [inserted] = await tx
      .insert(reservationRecords)
      .values({
        id: intent.id,
        tenantId: intent.tenantId,
        campaignId: intent.campaignId,
        campaignProspectId: intent.campaignProspectId,
        establishmentId: intent.establishmentId,
        ownerMembershipId: intent.ownerMembershipId,
        lease: intent.lease,
        ruleSnapshot: intent.ruleSnapshot,
        status,
        expiresAt: intent.lease.expiresAt ? new Date(intent.lease.expiresAt) : intent.createdAt,
      })
      .onConflictDoNothing()
      .returning();
    return inserted ?? null;
  }
  async close(tenantId: string, id: string, status: 'released' | 'failed', reason: string) {
    const closeWith = async (tx: DatabaseExecutor) => {
      await setTenantContext(tx, tenantId);
      const [existing] = await tx
        .select({ status: reservationRecords.status })
        .from(reservationRecords)
        .where(and(eq(reservationRecords.tenantId, tenantId), eq(reservationRecords.id, id)));
      const row = await this.materializeIntent(tx, tenantId, id, status);
      if (!row) return;
      if (!existing) {
        await this.event(tx, tenantId, id, status, { reason });
        return;
      }
      if (row.status === status) return;
      if (['released', 'expired', 'lost'].includes(row.status)) return;
      await tx
        .update(reservationRecords)
        .set({ status, updatedAt: sql`clock_timestamp()` })
        .where(and(eq(reservationRecords.tenantId, tenantId), eq(reservationRecords.id, id)));
      await this.event(tx, tenantId, id, status, { reason });
    };
    const active = currentTenantExecutor();
    if (active) await closeWith(active);
    else await runWithoutTenantExecutor(() => this.db.transaction(closeWith));
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
  private async reconcileIntent(tx: DatabaseExecutor, tenantId: string, id: string): Promise<void> {
    // Immutable intent rows do not need a row lock. The record lock and the
    // tenant-scoped transaction serialize materialization/reconciliation.
    const [intent] = await tx
      .select()
      .from(reservationIntents)
      .where(and(eq(reservationIntents.tenantId, tenantId), eq(reservationIntents.id, id)));
    if (!intent) return;

    const [exact, paired] = await this.redis
      .getClient()
      .mGet([
        ['trackroster', 'reservation', tenantId, intent.campaignId, intent.campaignProspectId].join(
          ':',
        ),
        [
          'trackroster',
          'collision',
          tenantId,
          intent.lease.organizationId,
          intent.establishmentId,
        ].join(':'),
      ]);
    const live = exact ? (JSON.parse(exact) as ProspectReservation) : null;
    const collision = paired ? (JSON.parse(paired) as ProspectReservation) : null;
    const leaseIsLive =
      live?.reservationId === id &&
      collision?.reservationId === id &&
      live.expiresAt === intent.lease.expiresAt &&
      collision.expiresAt === intent.lease.expiresAt;

    const [existing] = await tx
      .select()
      .from(reservationRecords)
      .where(and(eq(reservationRecords.tenantId, tenantId), eq(reservationRecords.id, id)))
      .for('update');

    if (leaseIsLive) {
      if (existing?.status === 'active') return;
      const row = await this.materializeIntent(tx, tenantId, id, 'active');
      if (!row) return;
      await tx
        .update(reservationRecords)
        .set({
          lease: live,
          status: 'active',
          expiresAt: new Date(live.expiresAt),
          updatedAt: sql`clock_timestamp()`,
        })
        .where(and(eq(reservationRecords.tenantId, tenantId), eq(reservationRecords.id, id)));
      await this.event(tx, tenantId, id, 'reconciled_active', { expiresAt: live.expiresAt });
      return;
    }

    if (existing) return;
    const terminalStatus =
      intent.lease.expiresAt <= new Date().toISOString() ? 'expired' : 'failed';
    const row = await this.materializeIntent(tx, tenantId, id, terminalStatus);
    if (row) {
      await this.event(tx, tenantId, id, terminalStatus, {
        reason: 'intent_without_live_lease',
      });
    }
  }
  async reconcile() {
    if (this.busy) return;
    this.busy = true;
    try {
      /*
       * This sweep runs on a timer, so it has no tenant scope, and the backlog
       * it reconciles is shared across tenants. A context-free read of
       * reservation_records returns nothing once the policies apply, so
       * reconciliation stopped happening at all — and unlike the export sweep
       * nothing here is covered by a test, so it would have stopped in silence.
       * Discovery is privileged and returns identifiers only; the refresh and
       * the rotation both run under the record's own tenant. See
       * tenant-sweep.ts and migration 0078.
       */
      const rows = await discoverSweepWork(
        this.db,
        sql`SELECT id, tenant_id FROM trackroster_reconcilable_reservations(100)`,
      );

      await sweepByTenant(this.db, rows, async (row) => {
        let failure: unknown;

        try {
          await this.refresh(row.tenant_id, row.id);
        } catch (error) {
          failure = error;
        }

        // Rotate inspected rows even on a malformed Redis value so one record cannot starve others.
        await this.db
          .update(reservationRecords)
          .set({ updatedAt: sql`clock_timestamp()` })
          .where(eq(reservationRecords.id, row.id));

        if (failure) throw failure;
      });

      const intents = await discoverSweepWork(
        this.db,
        sql`SELECT id, tenant_id FROM trackroster_reconcilable_reservation_intents(100)`,
      );
      await sweepByTenant(this.db, intents, async (row, tx) => {
        await this.reconcileIntent(tx, row.tenant_id, row.id);
      });
    } finally {
      this.busy = false;
    }
  }
}
