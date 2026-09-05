import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { DatabaseModule } from '../database/database.module.js';
import { UserModule } from '../users/user.module.js';
import { AuthSessionRepository } from './auth-session.repository.js';
import { PasswordService } from './password.service.js';
import { TokenService } from './token.service.js';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';

@Module({
  imports: [DatabaseModule, UserModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthGuard, AuthSessionRepository, PasswordService, AuthService, TokenService],
  exports: [AuthGuard, AuthSessionRepository, PasswordService, AuthService, TokenService],
})
export class AuthModule {}
