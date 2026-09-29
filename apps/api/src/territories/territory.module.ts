import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { ResourceScopeModule } from '../resource-scopes/resource-scope.module.js';
import { TerritoryController, CampaignTerritoryController } from './territory.controller.js';
import { TerritoryService } from './territory.service.js';
@Module({
  imports: [AuthModule, AuthorizationModule, DatabaseModule, ResourceScopeModule],
  controllers: [TerritoryController, CampaignTerritoryController],
  providers: [TerritoryService],
})
export class TerritoryModule {}
