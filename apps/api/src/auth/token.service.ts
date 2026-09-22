import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';

import { AccessTokenPayload, AuthenticationTokens, RefreshTokenPayload } from './auth.types.js';

type JwtExpiresIn = NonNullable<JwtSignOptions['expiresIn']>;

const TENANT_TOKEN_ISSUER = 'trackroster-api';
const TENANT_ACCESS_AUDIENCE = 'trackroster-tenant-access';
const TENANT_REFRESH_AUDIENCE = 'trackroster-tenant-refresh';
const TENANT_KEY_ID = 'tenant-hs256-v2';
const TENANT_TOKEN_ALGORITHM = 'HS256';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface CreateAuthenticationTokensInput {
  identityId: string;

  membershipId: string;

  tenantId: string;

  sessionId: string;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async createTokens(input: CreateAuthenticationTokensInput): Promise<AuthenticationTokens> {
    const accessSecret = this.configService.get<string>('JWT_ACCESS_SECRET');

    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');

    const accessTtl = this.configService.getOrThrow<JwtExpiresIn>('JWT_ACCESS_TTL');

    const refreshTtl = this.configService.getOrThrow<JwtExpiresIn>('JWT_REFRESH_TTL');

    if (!accessSecret || !refreshSecret || !accessTtl || !refreshTtl) {
      throw new Error('JWT configuration is incomplete');
    }

    const accessPayload: AccessTokenPayload = {
      sub: input.identityId,
      membershipId: input.membershipId,
      tenantId: input.tenantId,
      sid: input.sessionId,
      jti: randomUUID(),
      ver: 2,
      type: 'access',
    };

    const refreshPayload: RefreshTokenPayload = {
      sub: input.identityId,
      membershipId: input.membershipId,
      tenantId: input.tenantId,
      sid: input.sessionId,
      jti: randomUUID(),
      ver: 2,
      type: 'refresh',
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: accessSecret,
        expiresIn: accessTtl,
        algorithm: TENANT_TOKEN_ALGORITHM,
        issuer: TENANT_TOKEN_ISSUER,
        audience: TENANT_ACCESS_AUDIENCE,
        keyid: TENANT_KEY_ID,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: refreshSecret,
        expiresIn: refreshTtl,
        algorithm: TENANT_TOKEN_ALGORITHM,
        issuer: TENANT_TOKEN_ISSUER,
        audience: TENANT_REFRESH_AUDIENCE,
        keyid: TENANT_KEY_ID,
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

    this.assertProtectedHeader(token);

    const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
      secret,
      algorithms: [TENANT_TOKEN_ALGORITHM],
      issuer: TENANT_TOKEN_ISSUER,
      audience: TENANT_ACCESS_AUDIENCE,
    });

    this.assertTenantPayload(payload, 'access');

    return payload;
  }

  async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    const secret = this.configService.get<string>('JWT_REFRESH_SECRET');

    if (!secret) {
      throw new Error('JWT_REFRESH_SECRET is required');
    }

    this.assertProtectedHeader(token);

    const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(token, {
      secret,
      algorithms: [TENANT_TOKEN_ALGORITHM],
      issuer: TENANT_TOKEN_ISSUER,
      audience: TENANT_REFRESH_AUDIENCE,
    });

    this.assertTenantPayload(payload, 'refresh');

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

  private assertProtectedHeader(token: string): void {
    const decoded = this.jwtService.decode(token, {
      complete: true,
    }) as {
      header?: {
        alg?: unknown;
        kid?: unknown;
      };
    } | null;

    if (
      !decoded?.header ||
      decoded.header.alg !== TENANT_TOKEN_ALGORITHM ||
      decoded.header.kid !== TENANT_KEY_ID
    ) {
      throw new Error('Invalid tenant token header');
    }
  }

  private assertTenantPayload(
    payload: AccessTokenPayload | RefreshTokenPayload,
    expectedType: AccessTokenPayload['type'] | RefreshTokenPayload['type'],
  ): void {
    if (
      payload.ver !== 2 ||
      payload.type !== expectedType ||
      !UUID_PATTERN.test(payload.sub) ||
      !UUID_PATTERN.test(payload.membershipId) ||
      !UUID_PATTERN.test(payload.tenantId) ||
      !UUID_PATTERN.test(payload.sid) ||
      !UUID_PATTERN.test(payload.jti)
    ) {
      throw new Error('Invalid tenant token claims');
    }
  }
}
