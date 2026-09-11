import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module.js';

import { AuthModule } from '../auth/auth.module.js';

import { ReportingModule } from '../reporting/reporting.module.js';

import { ControlledExportController } from './controlled-export.controller.js';

import { ControlledExportService } from './controlled-export.service.js';

import { ExportRepositoryModule } from './export-repository.module.js';

import { ExportSerializationModule } from './export-serialization.module.js';

@Module({
  imports: [
    AuthModule,

    AuditModule,

    ReportingModule,

    ExportRepositoryModule,

    ExportSerializationModule,
  ],

  controllers: [ControlledExportController],

  providers: [ControlledExportService],

  exports: [ControlledExportService],
})
export class ExportModule {}
