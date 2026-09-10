import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

import type { ProspectFollowUp } from '../database/schema/prospect-follow-ups.js';
import { ReservationService } from '../reservations/reservation.service.js';

import { FollowUpReminderSchedulerService } from './follow-up-reminder-scheduler.service.js';
import { ProspectFollowUpRepository } from './prospect-follow-up.repository.js';
import {
  toPublicProspectFollowUp,
  type PublicProspectFollowUp,
} from './prospect-follow-up.types.js';

export interface CreateProspectFollowUpInput {
  tenantId: string;

  userId: string;

  campaignId: string;

  campaignProspectId: string;

  dueAt: Date;

  assignedUserId?: string | null;
}

export interface FollowUpCommandInput {
  tenantId: string;

  userId: string;

  campaignId: string;

  campaignProspectId: string;

  followUpId: string;
}

export interface RescheduleProspectFollowUpInput extends FollowUpCommandInput {
  dueAt: Date;
}

@Injectable()
export class ProspectFollowUpService {
  constructor(
    private readonly followUpRepository: ProspectFollowUpRepository,

    private readonly reservationService: ReservationService,

    private readonly followUpReminderSchedulerService: FollowUpReminderSchedulerService,
  ) {}

  async create(input: CreateProspectFollowUpInput): Promise<PublicProspectFollowUp> {
    const { assignment, establishmentId } =
      await this.reservationService.requireReservationEligibility({
        tenantId: input.tenantId,

        userId: input.userId,

        campaignId: input.campaignId,

        campaignProspectId: input.campaignProspectId,
      });

    this.requireFutureDueAt(input.dueAt);

    const assignedUserId = input.assignedUserId === undefined ? input.userId : input.assignedUserId;

    if (assignedUserId !== null && assignedUserId !== input.userId) {
      throw new ForbiddenException('Prospector cannot assign follow-up to another user');
    }

    /*
     * Generate the identifier before persistence so
     * the reminder can be queued first.
     *
     * If BullMQ is unavailable, no follow-up is
     * created without its scheduled reminder.
     *
     * If persistence subsequently fails, the worker
     * will eventually find no matching follow-up and
     * treat the queued job as stale/no-op.
     */
    const followUpId = randomUUID();

    try {
      await this.followUpReminderSchedulerService.schedule({
        tenantId: input.tenantId,

        followUpId,

        campaignId: input.campaignId,

        campaignProspectId: input.campaignProspectId,

        dueAt: input.dueAt,
      });
    } catch {
      throw new ServiceUnavailableException('Follow-up service is unavailable');
    }

    let followUp: ProspectFollowUp;

    try {
      followUp = await this.followUpRepository.create({
        id: followUpId,

        tenantId: input.tenantId,

        campaignId: input.campaignId,

        campaignProspectId: input.campaignProspectId,

        establishmentId,

        assignmentId: assignment.id,

        assignedUserId,

        createdBy: input.userId,

        dueAt: input.dueAt,

        status: 'pending',

        completedAt: null,

        cancelledAt: null,
      });
    } catch {
      /*
       * The already queued job is harmless.
       *
       * Worker processing always reloads the source
       * follow-up from PostgreSQL before producing a
       * notification.
       */
      throw new ServiceUnavailableException('Follow-up service is unavailable');
    }

    return toPublicProspectFollowUp(followUp);
  }

  async reschedule(input: RescheduleProspectFollowUpInput): Promise<PublicProspectFollowUp> {
    this.requireFutureDueAt(input.dueAt);

    const followUp = await this.requireMutableFollowUp(input);

    /*
     * Queue the new schedule before modifying the
     * authoritative database value.
     *
     * If enqueue fails, dueAt remains unchanged.
     *
     * If the database update later loses a race or
     * fails, this queued job becomes stale because
     * scheduledFor will not equal the authoritative
     * dueAt when the worker executes.
     */
    try {
      await this.followUpReminderSchedulerService.schedule({
        tenantId: input.tenantId,

        followUpId: followUp.id,

        campaignId: input.campaignId,

        campaignProspectId: input.campaignProspectId,

        dueAt: input.dueAt,
      });
    } catch {
      throw new ServiceUnavailableException('Follow-up service is unavailable');
    }

    const now = new Date();

    let updated: ProspectFollowUp | null;

    try {
      updated = await this.followUpRepository.reschedulePending(
        input.tenantId,

        input.campaignId,

        input.campaignProspectId,

        followUp.id,

        input.dueAt,

        now,
      );
    } catch {
      throw new ServiceUnavailableException('Follow-up service is unavailable');
    }

    /*
     * Another request may have completed or
     * cancelled the row after our initial read.
     *
     * Repository status predicates make the
     * transition atomic.
     *
     * The already queued reminder is harmless
     * because worker processing will re-check the
     * current database state.
     */
    if (!updated) {
      throw new ConflictException('Follow-up is no longer pending');
    }

    return toPublicProspectFollowUp(updated);
  }

  async complete(input: FollowUpCommandInput): Promise<PublicProspectFollowUp> {
    const followUp = await this.requireMutableFollowUp(input);

    const completedAt = new Date();

    let updated: ProspectFollowUp | null;

    try {
      updated = await this.followUpRepository.completePending(
        input.tenantId,

        input.campaignId,

        input.campaignProspectId,

        followUp.id,

        completedAt,
      );
    } catch {
      throw new ServiceUnavailableException('Follow-up service is unavailable');
    }

    if (!updated) {
      throw new ConflictException('Follow-up is no longer pending');
    }

    /*
     * We intentionally do not remove the delayed
     * BullMQ job.
     *
     * When it eventually executes, the worker sees
     * status=completed and returns a business no-op.
     */
    return toPublicProspectFollowUp(updated);
  }

  async cancel(input: FollowUpCommandInput): Promise<PublicProspectFollowUp> {
    const followUp = await this.requireMutableFollowUp(input);

    const cancelledAt = new Date();

    let updated: ProspectFollowUp | null;

    try {
      updated = await this.followUpRepository.cancelPending(
        input.tenantId,

        input.campaignId,

        input.campaignProspectId,

        followUp.id,

        cancelledAt,
      );
    } catch {
      throw new ServiceUnavailableException('Follow-up service is unavailable');
    }

    if (!updated) {
      throw new ConflictException('Follow-up is no longer pending');
    }

    /*
     * As with completion, queue deletion is not part
     * of correctness. The worker performs the final
     * authoritative status check.
     */
    return toPublicProspectFollowUp(updated);
  }

  /*
   * Validate that the caller may mutate this exact
   * pending follow-up.
   *
   * Current assignment owns current workflow.
   * Historical/stale assignment follow-ups stay
   * stored but ordinary prospectors cannot change
   * them.
   */
  private async requireMutableFollowUp(input: FollowUpCommandInput): Promise<ProspectFollowUp> {
    const { assignment } = await this.reservationService.requireReservationEligibility({
      tenantId: input.tenantId,

      userId: input.userId,

      campaignId: input.campaignId,

      campaignProspectId: input.campaignProspectId,
    });

    let followUp: ProspectFollowUp | null;

    try {
      followUp = await this.followUpRepository.findById(
        input.tenantId,

        input.campaignId,

        input.campaignProspectId,

        input.followUpId,
      );
    } catch {
      throw new ServiceUnavailableException('Follow-up service is unavailable');
    }

    if (!followUp) {
      throw new NotFoundException('Follow-up not found');
    }

    if (followUp.status !== 'pending') {
      throw new ConflictException('Follow-up is no longer pending');
    }

    /*
     * Reassignment invalidates the old follow-up as
     * an actionable workflow item.
     *
     * The row remains stored as historical data.
     */
    if (followUp.assignmentId !== assignment.id) {
      throw new ConflictException('Follow-up does not belong to current assignment');
    }

    /*
     * Team-owned:
     * any eligible prospector for the current
     * assignment team may act on it.
     *
     * User-owned:
     * only that user may act on it.
     */
    if (followUp.assignedUserId !== null && followUp.assignedUserId !== input.userId) {
      throw new ForbiddenException('Follow-up belongs to another user');
    }

    return followUp;
  }

  private requireFutureDueAt(dueAt: Date): void {
    if (Number.isNaN(dueAt.getTime())) {
      throw new BadRequestException('Follow-up due date is invalid');
    }

    if (dueAt.getTime() <= Date.now()) {
      throw new BadRequestException('Follow-up due date must be in the future');
    }
  }
}
