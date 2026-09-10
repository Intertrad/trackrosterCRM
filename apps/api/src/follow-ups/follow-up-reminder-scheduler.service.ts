import { Injectable } from '@nestjs/common';

import { FOLLOW_UP_REMINDER_JOB, buildFollowUpReminderJobId } from '@trackroster/jobs';

import { JobProducerService } from '../jobs/job-producer.service.js';

export interface ScheduleFollowUpReminderInput {
  tenantId: string;

  followUpId: string;

  campaignId: string;

  campaignProspectId: string;

  dueAt: Date;
}

@Injectable()
export class FollowUpReminderSchedulerService {
  constructor(private readonly jobProducerService: JobProducerService) {}

  async schedule(input: ScheduleFollowUpReminderInput): Promise<void> {
    const requestedAt = new Date();

    const scheduledFor = input.dueAt.toISOString();

    const jobId = buildFollowUpReminderJobId(input.followUpId, scheduledFor);

    /*
     * dueAt has already been validated by the
     * follow-up service.
     *
     * Math.max remains defensive in case the clock
     * advances between validation and enqueue.
     */
    const delayMs = Math.max(0, input.dueAt.getTime() - requestedAt.getTime());

    await this.jobProducerService.enqueue(
      FOLLOW_UP_REMINDER_JOB,
      {
        jobId,

        tenantId: input.tenantId,

        requestedAt: requestedAt.toISOString(),

        followUpId: input.followUpId,

        campaignId: input.campaignId,

        campaignProspectId: input.campaignProspectId,

        scheduledFor,
      },
      {
        delayMs,
      },
    );
  }
}
