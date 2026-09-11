import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';

import { ControlledExportRepository } from './controlled-export.repository.js';

@Module({
  imports: [DatabaseModule],

  providers: [ControlledExportRepository],

  exports: [ControlledExportRepository],
})
export class ExportRepositoryModule {}
