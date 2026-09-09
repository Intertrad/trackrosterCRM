import { Module } from '@nestjs/common';

import { JobsQueueService } from './jobs-queue.service.js';

@Module({
  providers: [JobsQueueService],

  exports: [JobsQueueService],
})
export class JobsQueueModule {}
