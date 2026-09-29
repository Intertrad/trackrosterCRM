import { forwardRef, Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import { TenantModule } from '../tenants/tenant.module.js';
import { OrganizationRepository } from './organization.repository.js';
import { OrganizationService } from './organization.service.js';

@Module({
  /* Other half of the TenantModule <-> AuthorizationModule cycle. */
  imports: [DatabaseModule, forwardRef(() => TenantModule)],
  providers: [OrganizationRepository, OrganizationService],
  exports: [OrganizationRepository, OrganizationService],
})
export class OrganizationModule {}
