import { Injectable, Logger } from '@nestjs/common';

import type { TrackRosterJobName } from '@trackroster/jobs';

export interface JobLogMetadata {
  jobId: string;

  jobName: TrackRosterJobName;

  tenantId: string;

  attempt: number;

  maxAttempts: number;
}

@Injectable()
export class JobLoggingService {
  private readonly logger = new Logger('BackgroundJobs');

  started(metadata: JobLogMetadata): void {
    this.logger.log(
      JSON.stringify({
        event: 'job.started',

        ...metadata,
      }),
    );
  }

  processed(metadata: JobLogMetadata, durationMs: number): void {
    this.logger.log(
      JSON.stringify({
        event: 'job.processed',

        ...metadata,

        durationMs,

        outcome: 'processed',
      }),
    );
  }

  noop(metadata: JobLogMetadata, durationMs: number, reason: string): void {
    this.logger.log(
      JSON.stringify({
        event: 'job.noop',

        ...metadata,

        durationMs,

        outcome: 'noop',

        reason,
      }),
    );
  }

  failed(metadata: JobLogMetadata, durationMs: number, error: unknown): void {
    const normalizedError = error instanceof Error ? error : new Error(String(error));

    this.logger.error(
      JSON.stringify({
        event: 'job.failed',

        ...metadata,

        durationMs,

        outcome: 'failed',

        errorName: normalizedError.name,

        errorMessage: normalizedError.message,
      }),

      normalizedError.stack,
    );
  }

  workerError(error: unknown): void {
    const normalizedError = error instanceof Error ? error : new Error(String(error));

    this.logger.error(
      JSON.stringify({
        event: 'worker.error',

        errorName: normalizedError.name,

        errorMessage: normalizedError.message,
      }),

      normalizedError.stack,
    );
  }
}
