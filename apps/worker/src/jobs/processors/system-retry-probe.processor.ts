import { Injectable, Logger } from '@nestjs/common';

import type { SystemRetryProbeJobData } from '@trackroster/jobs';

import { PermanentJobError } from '../job-errors.js';
import type { JobProcessingContext, JobProcessorResult } from '../job-processing.types.js';

@Injectable()
export class SystemRetryProbeProcessor {
  private readonly logger = new Logger(SystemRetryProbeProcessor.name);

  async process(
    data: SystemRetryProbeJobData,

    context: JobProcessingContext,
  ): Promise<JobProcessorResult> {
    if (!Number.isInteger(data.failThroughAttempt) || data.failThroughAttempt < 0) {
      throw new PermanentJobError('Invalid retry probe payload');
    }

    this.logger.log(
      `Retry probe jobId=${context.jobId} attempt=${context.attempt}/${context.maxAttempts}`,
    );

    if (data.permanentFailure) {
      throw new PermanentJobError('Intentional permanent retry probe failure');
    }

    if (context.attempt <= data.failThroughAttempt) {
      /*
       * Ordinary Error means retryable failure.
       */
      throw new Error(`Intentional retryable failure on attempt ${context.attempt}`);
    }

    return {
      status: 'processed',
    };
  }
}
