import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import { NotificationRepository } from './notification.repository.js';

@Module({
  imports: [DatabaseModule],

  providers: [NotificationRepository],

  exports: [NotificationRepository],
})
export class NotificationRepositoryModule {}
