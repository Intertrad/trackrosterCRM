import { Injectable, Logger } from '@nestjs/common';

import type { SystemHealthCheckJobData } from '@trackroster/jobs';

import { PermanentJobError } from '../job-errors.js';
import type { JobProcessingContext, JobProcessorResult } from '../job-processing.types.js';

export type SystemHealthCheckResult = Extract<
  JobProcessorResult,
  {
    status: 'processed';
  }
> & {
  jobId: string;

  processedAt: string;
};

@Injectable()
export class SystemHealthCheckProcessor {
  private readonly logger = new Logger(SystemHealthCheckProcessor.name);

  async process(
    data: SystemHealthCheckJobData,
    context: JobProcessingContext,
  ): Promise<SystemHealthCheckResult> {
    this.requireValidPayload(data);

    this.logger.log(
      `System health-check processed jobId=${context.jobId} attempt=${context.attempt}/${context.maxAttempts}`,
    );

    return {
      status: 'processed',

      jobId: data.jobId,

      processedAt: new Date().toISOString(),
    };
  }

  private requireValidPayload(data: SystemHealthCheckJobData): void {
    if (typeof data.jobId !== 'string' || data.jobId.length === 0) {
      throw new PermanentJobError('Invalid job payload: jobId is required');
    }

    if (typeof data.tenantId !== 'string' || data.tenantId.length === 0) {
      throw new PermanentJobError('Invalid job payload: tenantId is required');
    }

    if (typeof data.requestedAt !== 'string' || Number.isNaN(Date.parse(data.requestedAt))) {
      throw new PermanentJobError('Invalid job payload: requestedAt must be a valid timestamp');
    }

    if (data.message !== undefined && typeof data.message !== 'string') {
      throw new PermanentJobError('Invalid job payload: message must be a string');
    }
  }
}
