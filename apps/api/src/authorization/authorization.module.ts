import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { OrganizationModule } from '../organizations/organization.module.js';
import { TeamModule } from '../teams/team.module.js';
import { UserModule } from '../users/user.module.js';
import { AccessGrantController } from './access-grant.controller.js';
import { AccessGrantService } from './access-grant.service.js';
import { AuthorizationService } from './authorization.service.js';
import { ClientAdminGuard } from './client-admin.guard.js';
import { UserAccessGrantRepository } from './user-access-grant.repository.js';

@Module({
  imports: [AuthModule, DatabaseModule, OrganizationModule, TeamModule, UserModule],

  controllers: [AccessGrantController],

  providers: [
    AccessGrantService,
    AuthorizationService,
    ClientAdminGuard,
    UserAccessGrantRepository,
  ],

  exports: [AccessGrantService, AuthorizationService, ClientAdminGuard, UserAccessGrantRepository],
})
export class AuthorizationModule {}
