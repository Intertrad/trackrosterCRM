import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { ImportPreviewModule } from '../imports/import-preview.module.js';
import { ImportExecutionModule } from '../imports/import-execution.module.js';
import { EstablishmentModule } from '../establishments/establishment.module.js';
import { EstablishmentContactModule } from '../establishment-contacts/establishment-contact.module.js';
import { ExportModule } from '../exports/export.module.js';
import { ExportRepositoryModule } from '../exports/export-repository.module.js';
import { ExportSerializationModule } from '../exports/export-serialization.module.js';
import { ReportingModule } from '../reporting/reporting.module.js';
import { NotificationModule } from '../notifications/notification.module.js';
import {
  ImportIssueController,
  ImportJobController,
  ImportJobGuard,
} from './import-job.controller.js';
import { ImportJobService } from './import-job.service.js';
import { ExportJobController, ExportJobGuard } from './export-job.controller.js';
import { ExportJobService } from './export-job.service.js';
@Module({
  imports: [
    AuthModule,
    DatabaseModule,
    ImportPreviewModule,
    ImportExecutionModule,
    EstablishmentModule,
    EstablishmentContactModule,
    ExportModule,
    ExportRepositoryModule,
    ExportSerializationModule,
    ReportingModule,
    NotificationModule,
  ],
  controllers: [ImportJobController, ImportIssueController, ExportJobController],
  providers: [ImportJobService, ImportJobGuard, ExportJobService, ExportJobGuard],
})
export class DataJobsModule {}
