import { Injectable, Logger } from '@nestjs/common';

import type { FollowUpReminderJobData } from '@trackroster/jobs';

import { PermanentJobError } from '../job-errors.js';
import type { JobProcessingContext, JobProcessorResult } from '../job-processing.types.js';
import { FollowUpReminderRepository } from '../repositories/follow-up-reminder.repository.js';

@Injectable()
export class FollowUpReminderProcessor {
  private readonly logger = new Logger(FollowUpReminderProcessor.name);

  constructor(private readonly repository: FollowUpReminderRepository) {}

  async process(
    data: FollowUpReminderJobData,

    context: JobProcessingContext,
  ): Promise<JobProcessorResult> {
    const scheduledFor = this.requireValidPayload(data);

    const followUp = await this.repository.findContext(
      data.tenantId,

      data.campaignId,

      data.campaignProspectId,

      data.followUpId,
    );

    if (!followUp) {
      return {
        status: 'noop',

        reason: 'follow-up-not-found',
      };
    }

    if (followUp.status !== 'pending') {
      return {
        status: 'noop',

        reason: 'follow-up-not-pending',
      };
    }

    /*
     * This is what makes rescheduling safe.
     *
     * An older BullMQ job may remain in the queue,
     * but its scheduledFor value no longer matches
     * the authoritative PostgreSQL dueAt.
     */
    if (followUp.dueAt.getTime() !== scheduledFor.getTime()) {
      return {
        status: 'noop',

        reason: 'follow-up-rescheduled',
      };
    }

    /*
     * Reassignment invalidates the old workflow
     * item as actionable work.
     */
    if (followUp.assignmentEndedAt !== null) {
      return {
        status: 'noop',

        reason: 'follow-up-assignment-stale',
      };
    }

    if (followUp.campaignStatus !== 'active') {
      return {
        status: 'noop',

        reason: 'campaign-not-active',
      };
    }

    if (followUp.campaignProspectStatus !== 'active') {
      return {
        status: 'noop',

        reason: 'campaign-prospect-not-active',
      };
    }

    const recipientUserIds = await this.repository.findEligibleRecipientUserIds(followUp);

    if (recipientUserIds.length === 0) {
      return {
        status: 'noop',

        reason: 'no-eligible-recipients',
      };
    }

    const createdCount = await this.repository.createNotificationsIfAbsent(
      followUp,

      recipientUserIds,

      scheduledFor,
    );

    this.logger.log(
      [
        'Follow-up reminder processed',

        `jobId=${context.jobId}`,

        `followUpId=${followUp.id}`,

        `recipients=${recipientUserIds.length}`,

        `created=${createdCount}`,

        `attempt=${context.attempt}/${context.maxAttempts}`,
      ].join(' '),
    );

    /*
     * createdCount may legitimately be zero when a
     * previous attempt already performed the side
     * effect before being retried.
     *
     * That is still a successfully processed job.
     */
    return {
      status: 'processed',
    };
  }

  private requireValidPayload(data: FollowUpReminderJobData): Date {
    if (typeof data.jobId !== 'string' || data.jobId.length === 0) {
      throw new PermanentJobError('Invalid job payload: jobId is required');
    }

    if (typeof data.tenantId !== 'string' || data.tenantId.length === 0) {
      throw new PermanentJobError('Invalid job payload: tenantId is required');
    }

    if (typeof data.followUpId !== 'string' || data.followUpId.length === 0) {
      throw new PermanentJobError('Invalid job payload: followUpId is required');
    }

    if (typeof data.campaignId !== 'string' || data.campaignId.length === 0) {
      throw new PermanentJobError('Invalid job payload: campaignId is required');
    }

    if (typeof data.campaignProspectId !== 'string' || data.campaignProspectId.length === 0) {
      throw new PermanentJobError('Invalid job payload: campaignProspectId is required');
    }

    if (typeof data.requestedAt !== 'string' || Number.isNaN(Date.parse(data.requestedAt))) {
      throw new PermanentJobError('Invalid job payload: requestedAt must be a valid timestamp');
    }

    if (typeof data.scheduledFor !== 'string') {
      throw new PermanentJobError('Invalid job payload: scheduledFor must be a valid timestamp');
    }

    const scheduledFor = new Date(data.scheduledFor);

    if (Number.isNaN(scheduledFor.getTime())) {
      throw new PermanentJobError('Invalid job payload: scheduledFor must be a valid timestamp');
    }

    return scheduledFor;
  }
}
