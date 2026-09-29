import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { ResourceScopeService } from './resource-scope.service.js';
import { ResourceAccessGuard } from './resource-access.guard.js';
@Module({
  imports: [DatabaseModule],
  providers: [ResourceScopeService, ResourceAccessGuard],
  exports: [ResourceScopeService, ResourceAccessGuard],
})
export class ResourceScopeModule {}
