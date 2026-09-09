import { Module } from '@nestjs/common';

import { JobProducerService } from './job-producer.service.js';
import { JobQueueService } from './job-queue.service.js';

@Module({
  providers: [JobQueueService, JobProducerService],

  exports: [
    /*
     * Domain modules receive only the typed
     * producer abstraction.
     *
     * JobQueueService intentionally remains
     * private infrastructure.
     */
    JobProducerService,
  ],
})
export class JobQueueModule {}
