import {
  FOLLOW_UP_REMINDER_JOB,
  RESERVATION_EXPIRY_JOB,
  WEBHOOK_DELIVERY_JOB,
  SCHEDULED_REPORT_JOB,
  COMPLIANCE_ARTIFACT_JOB,
  PROSPECT_GEOCODE_JOB,
  SYSTEM_HEALTH_CHECK_JOB,
  SYSTEM_RETRY_PROBE_JOB,
} from './job.constants.js';

export interface BaseJobData {
  /*
   * Application-level queue identity.
   */
  jobId: string;

  /*
   * Every background job remains tenant-scoped.
   */
  tenantId: string;

  /*
   * Timestamp at which the enqueue request was
   * generated.
   */
  requestedAt: string;
}

export interface SystemHealthCheckJobData extends BaseJobData {
  message?: string;
}

export interface SystemRetryProbeJobData extends BaseJobData {
  /*
   * Fail through this one-based attempt number.
   *
   * Example:
   * failThroughAttempt = 2
   *
   * attempt 1 → fail
   * attempt 2 → fail
   * attempt 3 → succeed
   */
  failThroughAttempt: number;

  permanentFailure?: boolean;
}

/*
 * Follow-up reminder.
 *
 * The worker receives identifiers rather than a
 * snapshot of prospect/customer data.
 *
 * PostgreSQL remains authoritative when the job
 * eventually executes.
 */
export interface FollowUpReminderJobData extends BaseJobData {
  followUpId: string;

  campaignId: string;

  campaignProspectId: string;

  /*
   * dueAt value that caused this specific job to
   * be scheduled.
   *
   * If the follow-up is later rescheduled, the
   * worker compares this value with the current
   * database dueAt and treats the stale job as a
   * successful business no-op.
   */
  scheduledFor: string;
}

/*
 * Reservation expiry.
 *
 * Redis TTL remains the authoritative expiry
 * mechanism. This background job is secondary
 * processing/safety infrastructure.
 */
export interface ReservationExpiryJobData extends BaseJobData {
  reservationId: string;

  organizationId: string;

  campaignId: string;

  campaignProspectId: string;

  establishmentId: string;

  /*
   * Expiry timestamp belonging to this exact
   * reservation generation.
   */
  expiresAt: string;
}
export interface WebhookDeliveryJobData extends BaseJobData {
  deliveryId: string;
  webhookId: string;
  event: string;
  payload: Record<string, unknown>;
}
export interface ScheduledReportJobData extends BaseJobData {
  scheduleId: string;
  deliveryId: string;
}
export interface ComplianceArtifactJobData extends BaseJobData {
  exportId: string;
}
export interface ProspectGeocodeJobData extends BaseJobData {
  prospectId: string;
}

export interface TrackRosterJobMap {
  [SYSTEM_HEALTH_CHECK_JOB]: SystemHealthCheckJobData;

  [SYSTEM_RETRY_PROBE_JOB]: SystemRetryProbeJobData;

  [FOLLOW_UP_REMINDER_JOB]: FollowUpReminderJobData;

  [RESERVATION_EXPIRY_JOB]: ReservationExpiryJobData;
  [WEBHOOK_DELIVERY_JOB]: WebhookDeliveryJobData;
  [SCHEDULED_REPORT_JOB]: ScheduledReportJobData;
  [COMPLIANCE_ARTIFACT_JOB]: ComplianceArtifactJobData;
  [PROSPECT_GEOCODE_JOB]: ProspectGeocodeJobData;
}

export type TrackRosterJobName = keyof TrackRosterJobMap;

export type TrackRosterJobData<TName extends TrackRosterJobName> = TrackRosterJobMap[TName];
