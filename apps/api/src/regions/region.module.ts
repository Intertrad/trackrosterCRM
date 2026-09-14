import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { RegionController } from './region.controller.js';
import { RegionRepository } from './region.repository.js';
import { RegionService } from './region.service.js';

@Module({
  imports: [DatabaseModule, AuditModule, AuthModule, AuthorizationModule],

  controllers: [RegionController],

  providers: [RegionRepository, RegionService],

  exports: [RegionRepository, RegionService],
})
export class RegionModule {}
