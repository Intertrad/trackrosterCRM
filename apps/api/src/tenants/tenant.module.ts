import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import { TenantRepository } from './tenant.repository.js';
import { TenantService } from './tenant.service.js';
import { PlatformTenantController } from './platform-tenant.controller.js';
import { PlatformUserController } from './platform-user.controller.js';
import { AuditModule } from '../audit/audit.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';

@Module({
  imports: [DatabaseModule, AuditModule, AuthorizationModule],
  controllers: [PlatformTenantController, PlatformUserController],
  providers: [TenantRepository, TenantService],
  exports: [TenantRepository, TenantService],
})
export class TenantModule {}
