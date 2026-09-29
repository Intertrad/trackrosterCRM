/*
 * Queue names and job names form a contract between
 * producers and consumers.
 */

export const TRACKROSTER_JOB_QUEUE = 'trackroster-jobs' as const;

export const TRACKROSTER_JOB_PREFIX = 'trackroster' as const;

/*
 * TR-020 infrastructure/diagnostic jobs.
 */
export const SYSTEM_HEALTH_CHECK_JOB = 'system.health-check' as const;

export const SYSTEM_RETRY_PROBE_JOB = 'system.retry-probe' as const;

/*
 * TR-021 production jobs.
 */
export const FOLLOW_UP_REMINDER_JOB = 'follow_up.reminder' as const;

export const RESERVATION_EXPIRY_JOB = 'reservation.expire' as const;
export const WEBHOOK_DELIVERY_JOB = 'webhook.delivery' as const;
export const SCHEDULED_REPORT_JOB = 'scheduled-report.generate' as const;
export const COMPLIANCE_ARTIFACT_JOB = 'compliance.artifact' as const;

export const DEFAULT_JOB_ATTEMPTS = 3;

export const DEFAULT_JOB_BACKOFF_DELAY_MS = 5_000;

export const COMPLETED_JOB_RETENTION_COUNT = 1_000;

export const FAILED_JOB_RETENTION_COUNT = 5_000;
