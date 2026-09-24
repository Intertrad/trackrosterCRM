import { forwardRef, Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import { TenantRepository } from './tenant.repository.js';
import { TenantService } from './tenant.service.js';
import { PlatformTenantController } from './platform-tenant.controller.js';
import { PlatformUserController } from './platform-user.controller.js';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';

@Module({
  /*
   * AuthorizationModule -> OrganizationModule -> TenantModule -> Authorization
   * is a genuine cycle: the platform controllers here are guarded by
   * PlatformAdminGuard, which that module provides. forwardRef breaks the
   * scan-order deadlock without moving the guard.
   */
  imports: [
    DatabaseModule,
    AuditModule,
    /* The platform controllers are guarded by AuthGuard, which needs TokenService. */
    AuthModule,
    forwardRef(() => AuthorizationModule),
  ],
  controllers: [PlatformTenantController, PlatformUserController],
  providers: [TenantRepository, TenantService],
  exports: [TenantRepository, TenantService],
})
export class TenantModule {}
