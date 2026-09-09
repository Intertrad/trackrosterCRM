import { Injectable } from '@nestjs/common';

import type { TrackRosterJobData, TrackRosterJobName } from '@trackroster/jobs';

import { JobQueueService } from './job-queue.service.js';

export interface EnqueueJobOptions {
  /*
   * Allows TR-021 to schedule delayed work
   * without exposing BullMQ JobsOptions to the
   * rest of the application.
   */
  delayMs?: number;
}

export interface EnqueuedJob {
  jobId: string;

  name: TrackRosterJobName;
}

@Injectable()
export class JobProducerService {
  constructor(private readonly jobQueueService: JobQueueService) {}

  async enqueue<TName extends TrackRosterJobName>(
    name: TName,

    data: TrackRosterJobData<TName>,

    options?: EnqueueJobOptions,
  ): Promise<EnqueuedJob> {
    await this.jobQueueService.add(name, data, options);

    return {
      jobId: data.jobId,

      name,
    };
  }
}
