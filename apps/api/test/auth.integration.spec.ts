import { clearSessionEvidenceForUsers } from './support/session-evidence.js';
import { randomUUID } from 'node:crypto';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { desc, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { PasswordService } from '../src/auth/password.service.js';
import { AuthenticatedUser, AuthenticationTokens } from '../src/auth/auth.types.js';
import { TokenService } from '../src/auth/token.service.js';
import { Database } from '../src/database/database.types.js';
import { authSessions } from '../src/database/schema/auth-sessions.js';
import { tenants } from '../src/database/schema/tenants.js';
import { users } from '../src/database/schema/users.js';
import { TenantService } from '../src/tenants/tenant.service.js';
import { UserRepository } from '../src/users/user.repository.js';
import { getSeedDatabase, withSeedScope } from './support/seed.js';

describe('Authentication integration', () => {
  let app: NestFastifyApplication | undefined;
  let database: Database | undefined;
  let tokenService: TokenService;
  let userRepository: UserRepository;

  let tenantId: string | undefined;
  let userId: string | undefined;

  let userEmail = '';

  const password = 'IntegrationTestPassword123!';

  function getApp(): NestFastifyApplication {
    if (!app) {
      throw new Error('Test application has not been initialized');
    }

    return app;
  }

  function getDatabase(): Database {
    if (!database) {
      throw new Error('Test database has not been initialized');
    }

    return database;
  }

  function getIdentity(): {
    tenantId: string;
    userId: string;
  } {
    if (!tenantId || !userId) {
      throw new Error('Integration test identity has not been initialized');
    }

    return {
      tenantId,
      userId,
    };
  }

  async function login(): Promise<AuthenticationTokens> {
    const response = await getApp().inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: userEmail.toUpperCase(),
        password,
      },
    });

    expect(response.statusCode).toBe(200);

    return JSON.parse(response.payload) as AuthenticationTokens;
  }

  beforeAll(async () => {
    const application = await NestFactory.create<NestFastifyApplication>(
      AppModule,
      new FastifyAdapter(),
      {
        logger: false,
      },
    );

    application.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await application.init();

    app = application;

    database = getSeedDatabase();

    const tenantService = application.get(TenantService);

    userRepository = application.get(UserRepository);

    tokenService = application.get(TokenService);

    const passwordService = application.get(PasswordService);

    const suffix = randomUUID().replaceAll('-', '').slice(0, 12);

    const tenant = await tenantService.create({
      name: `Auth Integration ${suffix}`,
      slug: `auth-integration-${suffix}`,
    });

    tenantId = tenant.id;

    userEmail = `auth-${suffix}@trackroster.test`;

    const passwordHash = await passwordService.hash(password);

    const user = await userRepository.create({
      tenantId: tenant.id,
      email: userEmail,
      passwordHash,
      status: 'active',
    });

    userId = user.id;
  });

  afterAll(async () => {
    try {
      if (database && userId) {
        await clearSessionEvidenceForUsers(database, eq(users.id, userId));
        await database.delete(users).where(eq(users.id, userId));
      }

      if (database && tenantId) {
        await database.delete(tenants).where(eq(tenants.id, tenantId));
      }
    } finally {
      if (app) {
        await app.close();
      }
    }
  });

  it('rejects an unauthenticated protected request', async () => {
    const response = await getApp().inject({
      method: 'GET',
      url: '/auth/me',
    });

    expect(response.statusCode).toBe(401);
  });

  it('rejects invalid credentials', async () => {
    const response = await getApp().inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: userEmail,
        password: 'WrongPassword123!',
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it('logs in and establishes trusted user and tenant identity', async () => {
    const identity = getIdentity();

    const tokens = await login();

    expect(tokens.accessToken).toBeTruthy();
    expect(tokens.refreshToken).toBeTruthy();

    const accessClaims = await tokenService.verifyAccessToken(tokens.accessToken);
    const refreshClaims = await tokenService.verifyRefreshToken(tokens.refreshToken);

    expect(accessClaims).toMatchObject({
      sub: identity.userId,
      membershipId: identity.userId,
      tenantId: identity.tenantId,
      ver: 2,
      type: 'access',
    });
    expect(refreshClaims).toMatchObject({
      sub: identity.userId,
      membershipId: identity.userId,
      tenantId: identity.tenantId,
      sid: accessClaims.sid,
      ver: 2,
      type: 'refresh',
    });
    expect(accessClaims.jti).not.toBe(refreshClaims.jti);

    const meResponse = await getApp().inject({
      method: 'GET',
      url: '/auth/me',
      headers: {
        authorization: `Bearer ${tokens.accessToken}`,
      },
    });

    expect(meResponse.statusCode).toBe(200);

    const currentUser = JSON.parse(meResponse.payload) as AuthenticatedUser;

    expect(currentUser).toEqual({
      userId: identity.userId,
      tenantId: identity.tenantId,
    });

    const [session] = await getDatabase()
      .select()
      .from(authSessions)
      .where(eq(authSessions.userId, identity.userId))
      .orderBy(desc(authSessions.createdAt))
      .limit(1);

    expect(session).toBeDefined();

    if (!session) {
      throw new Error('Authentication session was not created');
    }

    expect(session.refreshTokenHash).toHaveLength(64);

    expect(session.refreshTokenHash).not.toBe(tokens.refreshToken);

    expect(session).toMatchObject({
      id: accessClaims.sid,
      userId: identity.userId,
      identityId: identity.userId,
      membershipId: identity.userId,
      tenantId: identity.tenantId,
      revokedAt: null,
      revokedReason: null,
    });

    expect(session.absoluteExpiresAt).toEqual(session.expiresAt);

    expect(session.revokedAt).toBeNull();
  });

  it('rejects an access token immediately after its database session is revoked', async () => {
    const tokens = await login();
    const claims = await tokenService.verifyAccessToken(tokens.accessToken);
    const revokedAt = new Date();

    await getDatabase()
      .update(authSessions)
      .set({
        revokedAt,
        revokedReason: 'integration_manual_revoke',
        updatedAt: revokedAt,
      })
      .where(eq(authSessions.id, claims.sid));

    const response = await getApp().inject({
      method: 'GET',
      url: '/auth/me',
      headers: {
        authorization: `Bearer ${tokens.accessToken}`,
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it('rejects a validly signed token whose tenant context does not match the session', async () => {
    const identity = getIdentity();
    const tokens = await login();
    const claims = await tokenService.verifyAccessToken(tokens.accessToken);
    const mismatchedTokens = await tokenService.createTokens({
      identityId: identity.userId,
      membershipId: identity.userId,
      tenantId: randomUUID(),
      sessionId: claims.sid,
    });

    const response = await getApp().inject({
      method: 'GET',
      url: '/auth/me',
      headers: {
        authorization: `Bearer ${mismatchedTokens.accessToken}`,
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it('revokes active sessions when the legacy compatibility user is suspended', async () => {
    const identity = getIdentity();
    const tokens = await login();

    await withSeedScope(() =>
      userRepository.updateStatus(identity.tenantId, identity.userId, 'suspended'),
    );

    try {
      const protectedResponse = await getApp().inject({
        method: 'GET',
        url: '/auth/me',
        headers: {
          authorization: `Bearer ${tokens.accessToken}`,
        },
      });

      expect(protectedResponse.statusCode).toBe(401);

      const loginResponse = await getApp().inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: userEmail,
          password,
        },
      });

      expect(loginResponse.statusCode).toBe(401);
    } finally {
      await withSeedScope(() =>
        userRepository.updateStatus(identity.tenantId, identity.userId, 'active'),
      );
    }

    const reactivatedOldTokenResponse = await getApp().inject({
      method: 'GET',
      url: '/auth/me',
      headers: {
        authorization: `Bearer ${tokens.accessToken}`,
      },
    });

    expect(reactivatedOldTokenResponse.statusCode).toBe(401);
    await expect(login()).resolves.toMatchObject({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
    });
  });

  it('rotates a refresh token and rejects replay of the previous token', async () => {
    const originalTokens = await login();

    const refreshResponse = await getApp().inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: {
        refreshToken: originalTokens.refreshToken,
      },
    });

    expect(refreshResponse.statusCode).toBe(200);

    const rotatedTokens = JSON.parse(refreshResponse.payload) as AuthenticationTokens;

    expect(rotatedTokens.refreshToken).not.toBe(originalTokens.refreshToken);

    const replayResponse = await getApp().inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: {
        refreshToken: originalTokens.refreshToken,
      },
    });

    expect(replayResponse.statusCode).toBe(401);

    const logoutResponse = await getApp().inject({
      method: 'POST',
      url: '/auth/logout',
      payload: {
        refreshToken: rotatedTokens.refreshToken,
      },
    });

    expect(logoutResponse.statusCode).toBe(204);

    const accessAfterLogoutResponse = await getApp().inject({
      method: 'GET',
      url: '/auth/me',
      headers: {
        authorization: `Bearer ${rotatedTokens.accessToken}`,
      },
    });

    expect(accessAfterLogoutResponse.statusCode).toBe(401);

    const afterLogoutResponse = await getApp().inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: {
        refreshToken: rotatedTokens.refreshToken,
      },
    });

    expect(afterLogoutResponse.statusCode).toBe(401);
  });

  it('allows only one concurrent refresh of the same token', async () => {
    const tokens = await login();

    const [first, second] = await Promise.all([
      getApp().inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: {
          refreshToken: tokens.refreshToken,
        },
      }),

      getApp().inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: {
          refreshToken: tokens.refreshToken,
        },
      }),
    ]);

    const statusCodes = [first.statusCode, second.statusCode].sort((a, b) => a - b);

    expect(statusCodes).toEqual([200, 401]);
  });
});
