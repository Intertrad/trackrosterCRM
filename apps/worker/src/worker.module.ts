import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { validateWorkerEnvironment } from './config/environment.validation.js';
import { JobsQueueModule } from './queue/jobs-queue.module.js';
import { WorkerLifecycleService } from './worker-lifecycle.service.js';
import { JobsModule } from './jobs/jobs.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,

      cache: true,

      envFilePath: ['../../.env', '.env'],

      validate: validateWorkerEnvironment,
    }),

    JobsQueueModule,
    JobsModule,
  ],

  providers: [WorkerLifecycleService],
})
export class WorkerModule {}
