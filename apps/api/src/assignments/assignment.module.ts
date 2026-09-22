import {
  AssignmentLifecycleController,
  AssignmentLifecycleGuard,
} from './assignment-lifecycle.controller.js';
import { AssignmentLifecycleService } from './assignment-lifecycle.service.js';
import { Module } from '@nestjs/common';
import {
  AssignmentBatchController,
  AssignmentRuleController,
  AssignmentBatchGuard,
  AssignmentRuleGuard,
} from './assignment-batch.controller.js';
import { AssignmentBatchService } from './assignment-batch.service.js';
import { AssignmentRuleService } from './assignment-rule.service.js';

import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { CampaignModule } from '../campaigns/campaign.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { TeamModule } from '../teams/team.module.js';
import { UserModule } from '../users/user.module.js';
import { CampaignProspectAssignmentController } from './campaign-prospect-assignment.controller.js';
import { CampaignProspectAssignmentRepository } from './campaign-prospect-assignment.repository.js';
import { CampaignProspectAssignmentService } from './campaign-prospect-assignment.service.js';

@Module({
  imports: [
    DatabaseModule,

    AuditModule,

    AuthModule,

    AuthorizationModule,

    CampaignModule,

    TeamModule,

    UserModule,
  ],

  controllers: [
    AssignmentLifecycleController,
    CampaignProspectAssignmentController,
    AssignmentBatchController,
    AssignmentRuleController,
  ],

  providers: [
    AssignmentLifecycleService,
    AssignmentLifecycleGuard,
    CampaignProspectAssignmentRepository,
    CampaignProspectAssignmentService,
    AssignmentBatchService,
    AssignmentRuleService,
    AssignmentBatchGuard,
    AssignmentRuleGuard,
  ],

  exports: [CampaignProspectAssignmentRepository, CampaignProspectAssignmentService],
})
export class AssignmentModule {}
