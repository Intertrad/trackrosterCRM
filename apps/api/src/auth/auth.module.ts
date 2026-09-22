import { PermissionModule } from '../permissions/permission.module.js';
import { SecurityPolicyService } from './security-policy.service.js';
import { AuthMailService } from './auth-mail.service.js';
import { PasswordRecoveryService } from './password-recovery.service.js';
import { PasswordRecoveryController } from './password-recovery.controller.js';
import { MfaService } from './mfa.service.js';
import { MfaController } from './mfa.controller.js';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { DatabaseModule } from '../database/database.module.js';
import { AuthSessionRepository } from './auth-session.repository.js';
import { PasswordService } from './password.service.js';
import { TokenService } from './token.service.js';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthenticationIdentityRepository } from './authentication-identity.repository.js';
import { AuthRateLimitGuard } from './auth-rate-limit.guard.js';
import { RedisModule } from '../redis/redis.module.js';

@Module({
  imports: [PermissionModule, DatabaseModule, RedisModule, JwtModule.register({})],
  controllers: [AuthController, MfaController, PasswordRecoveryController],
  providers: [
    SecurityPolicyService,
    AuthMailService,
    PasswordRecoveryService,
    MfaService,
    AuthGuard,
    AuthRateLimitGuard,
    AuthSessionRepository,
    AuthenticationIdentityRepository,
    PasswordService,
    AuthService,
    TokenService,
  ],
  exports: [
    PermissionModule,
    MfaService,
    SecurityPolicyService,
    AuthMailService,
    AuthRateLimitGuard,
    AuthGuard,
    AuthSessionRepository,
    PasswordService,
    AuthService,
    TokenService,
  ],
})
export class AuthModule {}
