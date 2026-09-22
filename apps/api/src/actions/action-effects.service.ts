import { ReservationLedgerService } from '../reservations/reservation-ledger.service.js';
import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { DATABASE } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import { actionEffects } from '../database/schema/index.js';
import { ReservationRepository } from '../reservations/reservation.repository.js';
import { FollowUpReminderSchedulerService } from '../follow-ups/follow-up-reminder-scheduler.service.js';
@Injectable()
export class ActionEffectsService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private busy = false;
  private readonly logger = new Logger(ActionEffectsService.name);
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly reservations: ReservationRepository,
    private readonly scheduler: FollowUpReminderSchedulerService,
    private readonly ledger: ReservationLedgerService,
  ) {}
  onModuleInit() {
    if (process.env.ACTION_EFFECTS_POLLING === 'off') return;
    this.timer = setInterval(() => {
      void this.drain().catch(() => this.logger.warn('Action effects delivery will retry'));
    }, 5000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  async drain() {
    if (this.busy) return;
    this.busy = true;
    try {
      const pending = await this.db
        .select({ id: actionEffects.id })
        .from(actionEffects)
        .where(sql`${actionEffects.deliveredAt} IS NULL`)
        .orderBy(actionEffects.createdAt, actionEffects.id)
        .limit(25);
      let failure: unknown;
      for (const item of pending) {
        try {
          await this.db.transaction(async (tx) => {
            const [effect] = await tx
              .select()
              .from(actionEffects)
              .where(and(eq(actionEffects.id, item.id), sql`${actionEffects.deliveredAt} IS NULL`))
              .for('update', { skipLocked: true });
            if (!effect) return;
            const p = effect.payload as Record<string, string>;
            if (effect.type === 'schedule_follow_up')
              await this.scheduler.schedule({
                tenantId: effect.tenantId,
                followUpId: p.followUpId!,
                campaignId: p.campaignId!,
                campaignProspectId: p.campaignProspectId!,
                dueAt: new Date(p.dueAt!),
              });
            else {
              const legacy = await this.reservations.findCurrentByEstablishment(
                effect.tenantId,
                p.establishmentId!,
              );
              let released: boolean;
              if (legacy?.reservationId === p.reservationId)
                released = await this.reservations.release(
                  effect.tenantId,
                  p.campaignId!,
                  p.campaignProspectId!,
                  p.establishmentId!,
                  p.reservationId!,
                );
              else
                released = await this.reservations.releaseOrganizationScoped(
                  effect.tenantId,
                  p.campaignId!,
                  p.campaignProspectId!,
                  p.organizationId!,
                  p.establishmentId!,
                  p.reservationId!,
                );
              if (released)
                await this.ledger.close(
                  effect.tenantId,
                  p.reservationId!,
                  'released',
                  'Action requested release',
                );
              else await this.ledger.refresh(effect.tenantId, p.reservationId!);
            }
            await tx
              .update(actionEffects)
              .set({ deliveredAt: sql`clock_timestamp()` })
              .where(eq(actionEffects.id, effect.id));
          });
        } catch (error) {
          failure = error;
        }
      }
      if (failure) throw failure;
    } finally {
      this.busy = false;
    }
  }
}
