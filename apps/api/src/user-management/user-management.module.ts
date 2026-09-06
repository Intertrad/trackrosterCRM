import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { UserModule } from '../users/user.module.js';
import { UserManagementController } from './user-management.controller.js';
import { UserManagementService } from './user-management.service.js';

@Module({
  imports: [AuthModule, AuthorizationModule, UserModule],

  controllers: [UserManagementController],

  providers: [UserManagementService],

  exports: [UserManagementService],
})
export class UserManagementModule {}
