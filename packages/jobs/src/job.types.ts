import { SYSTEM_HEALTH_CHECK_JOB, SYSTEM_RETRY_PROBE_JOB } from './job.constants.js';

export interface BaseJobData {
  jobId: string;

  tenantId: string;

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

export interface TrackRosterJobMap {
  [SYSTEM_HEALTH_CHECK_JOB]: SystemHealthCheckJobData;

  [SYSTEM_RETRY_PROBE_JOB]: SystemRetryProbeJobData;
}

export type TrackRosterJobName = keyof TrackRosterJobMap;

export type TrackRosterJobData<TName extends TrackRosterJobName> = TrackRosterJobMap[TName];
