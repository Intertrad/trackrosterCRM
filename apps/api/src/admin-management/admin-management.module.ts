import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { OrganizationModule } from '../organizations/organization.module.js';
import { TeamModule } from '../teams/team.module.js';
import { OrganizationManagementController } from './organization-management.controller.js';
import { TeamManagementController } from './team-management.controller.js';

@Module({
  imports: [AuthModule, AuthorizationModule, OrganizationModule, TeamModule],

  controllers: [OrganizationManagementController, TeamManagementController],
})
export class AdminManagementModule {}
