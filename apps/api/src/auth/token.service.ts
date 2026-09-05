import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';

import { AccessTokenPayload, AuthenticationTokens, RefreshTokenPayload } from './auth.types.js';

type JwtExpiresIn = NonNullable<JwtSignOptions['expiresIn']>;
@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async createTokens(
    userId: string,
    tenantId: string,
    sessionId: string,
  ): Promise<AuthenticationTokens> {
    const accessSecret = this.configService.get<string>('JWT_ACCESS_SECRET');

    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');

    const accessTtl = this.configService.getOrThrow<JwtExpiresIn>('JWT_ACCESS_TTL');

    const refreshTtl = this.configService.getOrThrow<JwtExpiresIn>('JWT_REFRESH_TTL');

    if (!accessSecret || !refreshSecret || !accessTtl || !refreshTtl) {
      throw new Error('JWT configuration is incomplete');
    }

    const accessPayload: AccessTokenPayload = {
      sub: userId,
      tenantId,
      type: 'access',
    };

    const refreshPayload: RefreshTokenPayload = {
      sub: userId,
      tenantId,
      sid: sessionId,
      jti: randomUUID(),
      type: 'refresh',
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: accessSecret,
        expiresIn: accessTtl,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: refreshSecret,
        expiresIn: refreshTtl,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  hashRefreshToken(refreshToken: string): string {
    return createHash('sha256').update(refreshToken).digest('hex');
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    const secret = this.configService.get<string>('JWT_ACCESS_SECRET');

    if (!secret) {
      throw new Error('JWT_ACCESS_SECRET is required');
    }

    const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
      secret,
    });

    if (payload.type !== 'access') {
      throw new Error('Invalid access token type');
    }

    return payload;
  }

  async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    const secret = this.configService.get<string>('JWT_REFRESH_SECRET');

    if (!secret) {
      throw new Error('JWT_REFRESH_SECRET is required');
    }

    const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(token, {
      secret,
    });

    if (payload.type !== 'refresh') {
      throw new Error('Invalid refresh token type');
    }

    return payload;
  }
  matchesRefreshToken(refreshToken: string, storedHash: string): boolean {
    const providedHash = this.hashRefreshToken(refreshToken);

    const providedBuffer = Buffer.from(providedHash, 'hex');
    const storedBuffer = Buffer.from(storedHash, 'hex');

    if (providedBuffer.length !== storedBuffer.length) {
      return false;
    }

    return timingSafeEqual(providedBuffer, storedBuffer);
  }

  getExpiration(token: string): Date {
    const payload = this.jwtService.decode<{
      exp?: number;
    }>(token);

    if (!payload?.exp) {
      throw new Error('Token expiration is missing');
    }

    return new Date(payload.exp * 1000);
  }
}
