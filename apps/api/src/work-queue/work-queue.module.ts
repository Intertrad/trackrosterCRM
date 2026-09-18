import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { DatabaseModule } from '../database/database.module.js';

import { WorkQueueController } from './work-queue.controller.js';
import { WorkQueueRepository } from './work-queue.repository.js';
import { WorkQueueService } from './work-queue.service.js';

@Module({
  imports: [AuthModule, AuthorizationModule, DatabaseModule],

  controllers: [WorkQueueController],

  providers: [WorkQueueRepository, WorkQueueService],

  exports: [WorkQueueRepository, WorkQueueService],
})
export class WorkQueueModule {}
