import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { AuditRepository } from './audit.repository.js';
import { AuditService } from './audit.service.js';
import { AuditController } from './audit.controller.js';

@Module({
  /* AuditController is guarded by AuthGuard, which needs TokenService. */
  imports: [DatabaseModule, AuthModule],

  providers: [AuditRepository, AuditService],
  controllers: [AuditController],

  exports: [AuditRepository, AuditService],
})
export class AuditModule {}
