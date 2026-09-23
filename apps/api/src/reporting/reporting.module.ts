import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { CampaignModule } from '../campaigns/campaign.module.js';
import { OrganizationModule } from '../organizations/organization.module.js';
import { TeamModule } from '../teams/team.module.js';
import { UserModule } from '../users/user.module.js';
import { ManagerDashboardController } from './manager-dashboard.controller.js';
import { ManagerDashboardScopeService } from './manager-dashboard-scope.service.js';
import { ManagerDashboardService } from './manager-dashboard.service.js';
import { ReportingRepositoryModule } from './reporting-repository.module.js';
import { ReportController } from './report.controller.js';
import { DatabaseModule } from '../database/database.module.js';
import { ReportQueryRepository } from './report-query.repository.js';
import { ReportQueryService } from './report-query.service.js';

@Module({
  imports: [
    AuthModule,

    AuthorizationModule,

    OrganizationModule,

    TeamModule,

    UserModule,

    CampaignModule,

    ReportingRepositoryModule,

    /* ReportQueryRepository injects DATABASE directly. */
    DatabaseModule,
  ],

  controllers: [ManagerDashboardController, ReportController],

  providers: [
    ManagerDashboardScopeService,
    ManagerDashboardService,
    ReportQueryRepository,
    ReportQueryService,
  ],

  exports: [ManagerDashboardService, ManagerDashboardScopeService],
})
export class ReportingModule {}
