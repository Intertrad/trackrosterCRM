import { randomUUID } from 'node:crypto';

import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';

import { UserRepository } from '../users/user.repository.js';
import { AuthSessionRepository } from './auth-session.repository.js';
import { AuthenticationTokens } from './auth.types.js';
import { PasswordService } from './password.service.js';
import { TokenService } from './token.service.js';

export interface LoginInput {
  email: string;
  password: string;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(UserRepository)
    private readonly userRepository: UserRepository,

    @Inject(PasswordService)
    private readonly passwordService: PasswordService,

    @Inject(TokenService)
    private readonly tokenService: TokenService,

    @Inject(AuthSessionRepository)
    private readonly authSessionRepository: AuthSessionRepository,
  ) {}

  async login(input: LoginInput): Promise<AuthenticationTokens> {
    const email = input.email.trim().toLowerCase();

    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await this.passwordService.verify(user.passwordHash, input.password);

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const sessionId = randomUUID();

    const tokens = await this.tokenService.createTokens(user.id, user.tenantId, sessionId);

    const refreshTokenHash = this.tokenService.hashRefreshToken(tokens.refreshToken);

    const expiresAt = this.tokenService.getExpiration(tokens.refreshToken);

    await this.authSessionRepository.create({
      id: sessionId,
      userId: user.id,
      refreshTokenHash,
      expiresAt,
    });

    return tokens;
  }

  async refresh(refreshToken: string): Promise<AuthenticationTokens> {
    try {
      const payload = await this.tokenService.verifyRefreshToken(refreshToken);

      const user = await this.userRepository.findById(payload.tenantId, payload.sub);

      if (!user || user.status !== 'active') {
        throw new UnauthorizedException();
      }

      const session = await this.authSessionRepository.findActiveById(payload.sid, user.id);

      if (!session) {
        throw new UnauthorizedException();
      }

      if (session.expiresAt <= new Date()) {
        throw new UnauthorizedException();
      }

      const refreshTokenMatches = this.tokenService.matchesRefreshToken(
        refreshToken,
        session.refreshTokenHash,
      );

      if (!refreshTokenMatches) {
        throw new UnauthorizedException();
      }

      const currentRefreshTokenHash = this.tokenService.hashRefreshToken(refreshToken);

      const tokens = await this.tokenService.createTokens(user.id, user.tenantId, session.id);

      const newRefreshTokenHash = this.tokenService.hashRefreshToken(tokens.refreshToken);

      const newExpiresAt = this.tokenService.getExpiration(tokens.refreshToken);

      const rotatedSession = await this.authSessionRepository.rotate(
        session.id,
        user.id,
        currentRefreshTokenHash,
        newRefreshTokenHash,
        newExpiresAt,
      );

      if (!rotatedSession) {
        throw new UnauthorizedException();
      }

      return tokens;
    } catch (error: unknown) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async logout(refreshToken: string): Promise<void> {
    try {
      const payload = await this.tokenService.verifyRefreshToken(refreshToken);

      await this.authSessionRepository.revoke(payload.sid, payload.sub);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
