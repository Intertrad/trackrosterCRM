import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { ResourceScopeModule } from '../resource-scopes/resource-scope.module.js';
import {
  CampaignOrganizationController,
  CampaignOrganizationGuard,
} from './campaign-organization.controller.js';
import { CampaignOrganizationService } from './campaign-organization.service.js';
@Module({
  imports: [AuthModule, DatabaseModule, ResourceScopeModule],
  controllers: [CampaignOrganizationController],
  providers: [CampaignOrganizationService, CampaignOrganizationGuard],
})
export class CampaignOrganizationModule {}
