import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { DatabaseModule } from '../database/database.module.js';
import {
  OrganizationAdministrationController,
  TeamAdministrationController,
  TenantSettingsController,
} from './workspace-administration.controller.js';
import { WorkspaceAdministrationService } from './workspace-administration.service.js';
import { TeamManagementGuard } from './team-management.guard.js';

@Module({
  imports: [AuthModule, AuthorizationModule, AuditModule, DatabaseModule],
  controllers: [
    TenantSettingsController,
    OrganizationAdministrationController,
    TeamAdministrationController,
  ],
  providers: [WorkspaceAdministrationService, TeamManagementGuard],
})
export class WorkspaceAdministrationModule {}
