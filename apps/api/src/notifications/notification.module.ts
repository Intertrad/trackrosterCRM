import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { NotificationController } from './notification.controller.js';
import { NotificationRepositoryModule } from './notification-repository.module.js';
import { NotificationService } from './notification.service.js';

@Module({
  imports: [AuthModule, NotificationRepositoryModule],

  controllers: [NotificationController],

  providers: [NotificationService],

  exports: [NotificationService],
})
export class NotificationModule {}
