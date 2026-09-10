import { Injectable } from '@nestjs/common';
import type { Job } from 'bullmq';

import {
  FOLLOW_UP_REMINDER_JOB,
  RESERVATION_EXPIRY_JOB,
  SYSTEM_HEALTH_CHECK_JOB,
  SYSTEM_RETRY_PROBE_JOB,
  type FollowUpReminderJobData,
  type ReservationExpiryJobData,
  type SystemHealthCheckJobData,
  type SystemRetryProbeJobData,
  type TrackRosterJobData,
  type TrackRosterJobName,
} from '@trackroster/jobs';

import type { JobProcessingContext, JobProcessorResult } from './job-processing.types.js';
import { FollowUpReminderProcessor } from './processors/follow-up-reminder.processor.js';
import { ReservationExpiryProcessor } from './processors/reservation-expiry.processor.js';
import { SystemHealthCheckProcessor } from './processors/system-health-check.processor.js';
import { SystemRetryProbeProcessor } from './processors/system-retry-probe.processor.js';

type AnyTrackRosterJobData = TrackRosterJobData<TrackRosterJobName>;

export type TrackRosterJob = Job<AnyTrackRosterJobData, unknown, TrackRosterJobName>;

@Injectable()
export class JobDispatcherService {
  constructor(
    private readonly systemHealthCheckProcessor: SystemHealthCheckProcessor,

    private readonly systemRetryProbeProcessor: SystemRetryProbeProcessor,

    private readonly followUpReminderProcessor: FollowUpReminderProcessor,

    private readonly reservationExpiryProcessor: ReservationExpiryProcessor,
  ) {}

  async dispatch(job: TrackRosterJob): Promise<JobProcessorResult> {
    const context: JobProcessingContext = {
      attempt: job.attemptsMade + 1,

      maxAttempts: job.opts.attempts ?? 1,

      jobId: job.data.jobId,
    };

    switch (job.name) {
      case FOLLOW_UP_REMINDER_JOB:
        return this.followUpReminderProcessor.process(
          job.data as FollowUpReminderJobData,

          context,
        );

      case RESERVATION_EXPIRY_JOB:
        return this.reservationExpiryProcessor.process(
          job.data as ReservationExpiryJobData,

          context,
        );

      case SYSTEM_RETRY_PROBE_JOB:
        return this.systemRetryProbeProcessor.process(
          job.data as SystemRetryProbeJobData,

          context,
        );

      case SYSTEM_HEALTH_CHECK_JOB:
        return this.systemHealthCheckProcessor.process(
          job.data as SystemHealthCheckJobData,

          context,
        );

      default:
        throw new Error(`Unsupported TrackRoster job: ${String(job.name)}`);
    }
  }
}
