import { RedisModule } from '../redis/redis.module.js';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { DatabaseModule } from '../database/database.module.js';
import {
  InvitationController,
  MembershipInvitationController,
  PlatformInvitationController,
} from './invitation.controller.js';
import { InvitationService } from './invitation.service.js';
import { SecurityPolicyController } from './security-policy.controller.js';
@Module({
  imports: [RedisModule, AuthModule, AuthorizationModule, DatabaseModule],
  controllers: [
    InvitationController,
    MembershipInvitationController,
    PlatformInvitationController,
    SecurityPolicyController,
  ],
  providers: [InvitationService],
  exports: [InvitationService],
})
export class SecurityAdministrationModule {}
