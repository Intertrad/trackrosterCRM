import { ResourceScopeModule } from '../resource-scopes/resource-scope.module.js';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { PermissionModule } from '../permissions/permission.module.js';
import {
  PermissionCatalogueController,
  RoleController,
} from '../permissions/permission.controller.js';
import { MembershipController, MembershipScopeController } from './membership.controller.js';
import { MembershipService } from './membership.service.js';
@Module({
  imports: [ResourceScopeModule, AuthModule, AuthorizationModule, DatabaseModule, PermissionModule],
  controllers: [
    MembershipController,
    MembershipScopeController,
    RoleController,
    PermissionCatalogueController,
  ],
  providers: [MembershipService],
})
export class MembershipModule {}
