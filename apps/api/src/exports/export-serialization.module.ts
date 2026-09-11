import { Module } from '@nestjs/common';

import { ControlledExportSerializerService } from './controlled-export-serializer.service.js';

@Module({
  providers: [ControlledExportSerializerService],

  exports: [ControlledExportSerializerService],
})
export class ExportSerializationModule {}
