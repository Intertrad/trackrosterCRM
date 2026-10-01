import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { EstablishmentContactModule } from '../establishment-contacts/establishment-contact.module.js';
import { EstablishmentModule } from '../establishments/establishment.module.js';
import { ImportDeduplicationService } from './import-deduplication.service.js';
import { ImportExecutionController } from './import-execution.controller.js';
import { ImportExecutionService } from './import-execution.service.js';
import { ImportPreviewModule } from './import-preview.module.js';
import { JobQueueModule } from '../jobs/job-queue.module.js';
import { NotificationModule } from '../notifications/notification.module.js';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    AuthorizationModule,
    ImportPreviewModule,
    EstablishmentModule,
    EstablishmentContactModule,
    JobQueueModule,
    NotificationModule,
  ],

  controllers: [ImportExecutionController],

  providers: [ImportDeduplicationService, ImportExecutionService],

  exports: [ImportDeduplicationService, ImportExecutionService],
})
export class ImportExecutionModule {}
