import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { JobQueueModule } from '../jobs/job-queue.module.js';
import { NotificationController } from './notification.controller.js';
import { NotificationRepositoryModule } from './notification-repository.module.js';
import { NotificationService } from './notification.service.js';
import { NotificationEventService } from './notification-event.service.js';

@Module({
  imports: [AuthModule, DatabaseModule, JobQueueModule, NotificationRepositoryModule],

  controllers: [NotificationController],

  providers: [NotificationService, NotificationEventService],

  exports: [NotificationService, NotificationEventService],
})
export class NotificationModule {}
