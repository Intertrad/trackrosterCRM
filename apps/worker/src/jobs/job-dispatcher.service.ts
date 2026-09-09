import { Injectable } from '@nestjs/common';
import type { Job } from 'bullmq';
import {
  SYSTEM_HEALTH_CHECK_JOB,
  SYSTEM_RETRY_PROBE_JOB,
  type SystemHealthCheckJobData,
  type SystemRetryProbeJobData,
  type TrackRosterJobData,
  type TrackRosterJobName,
} from '@trackroster/jobs';

import type { JobProcessorResult } from './job-processing.types.js';

import { SystemRetryProbeProcessor } from './processors/system-retry-probe.processor.js';

import type { JobProcessingContext } from './job-processing.types.js';
import { SystemHealthCheckProcessor } from './processors/system-health-check.processor.js';

type AnyTrackRosterJobData = TrackRosterJobData<TrackRosterJobName>;

export type TrackRosterJob = Job<AnyTrackRosterJobData, unknown, TrackRosterJobName>;

@Injectable()
export class JobDispatcherService {
  constructor(
    private readonly systemHealthCheckProcessor: SystemHealthCheckProcessor,

    private readonly systemRetryProbeProcessor: SystemRetryProbeProcessor,
  ) {}

  async dispatch(job: TrackRosterJob): Promise<JobProcessorResult> {
    const context: JobProcessingContext = {
      /*
       * BullMQ attemptsMade is zero-based before
       * the first normal processor failure.
       *
       * Expose one-based attempts to our domain
       * processors.
       */
      attempt: job.attemptsMade + 1,

      maxAttempts: job.opts.attempts ?? 1,

      jobId: job.data.jobId,
    };

    switch (job.name) {
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
