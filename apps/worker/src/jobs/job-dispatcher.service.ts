import { Injectable } from '@nestjs/common';
import type { Job } from 'bullmq';

import {
  FOLLOW_UP_REMINDER_JOB,
  RESERVATION_EXPIRY_JOB,
  WEBHOOK_DELIVERY_JOB,
  SCHEDULED_REPORT_JOB,
  COMPLIANCE_ARTIFACT_JOB,
  PROSPECT_GEOCODE_JOB,
  SYSTEM_HEALTH_CHECK_JOB,
  SYSTEM_RETRY_PROBE_JOB,
  type FollowUpReminderJobData,
  type ReservationExpiryJobData,
  type WebhookDeliveryJobData,
  type ScheduledReportJobData,
  type ComplianceArtifactJobData,
  type ProspectGeocodeJobData,
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
import { WebhookDeliveryProcessor } from './processors/webhook-delivery.processor.js';
import { ScheduledReportProcessor } from './processors/scheduled-report.processor.js';
import { ComplianceArtifactProcessor } from './processors/compliance-artifact.processor.js';
import { ProspectGeocodeProcessor } from './processors/prospect-geocode.processor.js';

type AnyTrackRosterJobData = TrackRosterJobData<TrackRosterJobName>;

export type TrackRosterJob = Job<AnyTrackRosterJobData, unknown, TrackRosterJobName>;

@Injectable()
export class JobDispatcherService {
  constructor(
    private readonly systemHealthCheckProcessor: SystemHealthCheckProcessor,

    private readonly systemRetryProbeProcessor: SystemRetryProbeProcessor,

    private readonly followUpReminderProcessor: FollowUpReminderProcessor,

    private readonly reservationExpiryProcessor: ReservationExpiryProcessor,
    private readonly webhookDeliveryProcessor?: WebhookDeliveryProcessor,
    private readonly scheduledReportProcessor?: ScheduledReportProcessor,
    private readonly complianceArtifactProcessor?: ComplianceArtifactProcessor,
    private readonly prospectGeocodeProcessor?: ProspectGeocodeProcessor,
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
      case WEBHOOK_DELIVERY_JOB:
        if (!this.webhookDeliveryProcessor)
          throw new Error('Webhook delivery processor unavailable');
        return this.webhookDeliveryProcessor.process(job.data as WebhookDeliveryJobData, context);
      case SCHEDULED_REPORT_JOB:
        if (!this.scheduledReportProcessor)
          throw new Error('Scheduled report processor unavailable');
        return this.scheduledReportProcessor.process(job.data as ScheduledReportJobData);
      case COMPLIANCE_ARTIFACT_JOB:
        if (!this.complianceArtifactProcessor)
          throw new Error('Compliance artifact processor unavailable');
        return this.complianceArtifactProcessor.process(job.data as ComplianceArtifactJobData);
      case PROSPECT_GEOCODE_JOB:
        if (!this.prospectGeocodeProcessor)
          throw new Error('Prospect geocode processor unavailable');
        return this.prospectGeocodeProcessor.process(job.data as ProspectGeocodeJobData);

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
