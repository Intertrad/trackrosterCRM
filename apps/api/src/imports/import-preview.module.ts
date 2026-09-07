import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { ImportPreviewController } from './import-preview.controller.js';
import { ImportPreviewService } from './import-preview.service.js';

@Module({
  imports: [AuthModule, AuthorizationModule],

  controllers: [ImportPreviewController],

  providers: [ImportPreviewService],

  exports: [ImportPreviewService],
})
export class ImportPreviewModule {}
