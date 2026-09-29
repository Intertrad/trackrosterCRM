import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { ResourceScopeModule } from '../resource-scopes/resource-scope.module.js';
import {
  CampaignMemberController,
  CampaignRosterController,
  TerritoryAssignmentController,
} from './participation.controller.js';
import { ParticipationGuard } from './participation.guard.js';
import { ParticipationService } from './participation.service.js';
@Module({
  imports: [AuthModule, DatabaseModule, ResourceScopeModule],
  controllers: [CampaignMemberController, CampaignRosterController, TerritoryAssignmentController],
  providers: [ParticipationService, ParticipationGuard],
})
export class ParticipationModule {}
