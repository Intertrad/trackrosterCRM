import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import { AuditRepository } from './audit.repository.js';
import { AuditService } from './audit.service.js';
import { AuditController } from './audit.controller.js';

@Module({
  imports: [DatabaseModule],

  providers: [AuditRepository, AuditService],
  controllers: [AuditController],

  exports: [AuditRepository, AuditService],
})
export class AuditModule {}
