import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import { TenantRepository } from './tenant.repository.js';
import { TenantService } from './tenant.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [TenantRepository, TenantService],
  exports: [TenantRepository, TenantService],
})
export class TenantModule {}
