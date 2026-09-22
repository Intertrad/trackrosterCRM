import { ConfigService } from '@nestjs/config';
import { AuthRateLimitGuard } from '../src/auth/auth-rate-limit.guard.js';
import { RedisService } from '../src/redis/redis.service.js';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { eq, inArray, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { PasswordService } from '../src/auth/password.service.js';
import type { AuthenticationTokens, WorkspaceSelectionChallenge } from '../src/auth/auth.types.js';
import { configureHttpApplication } from '../src/config/http-application.js';
import { DATABASE } from '../src/database/database.constants.js';
import type { Database } from '../src/database/database.types.js';
import { accountSettings } from '../src/database/schema/account-settings.js';
import { auditEvents } from '../src/database/schema/audit-events.js';
import { authSessions } from '../src/database/schema/auth-sessions.js';
import { authWorkspaceChallenges } from '../src/database/schema/auth-workspace-challenges.js';
import { identities } from '../src/database/schema/identities.js';
import { idempotencyRecords } from '../src/database/schema/idempotency-records.js';
import { tenantMemberships } from '../src/database/schema/tenant-memberships.js';
import { tenants } from '../src/database/schema/tenants.js';
import { userAccessGrants } from '../src/database/schema/user-access-grants.js';
import { UserRepository } from '../src/users/user.repository.js';

describe('Account and native workspace authentication', () => {
  let app: NestFastifyApplication;
  let database: Database;
  const tenantA = randomUUID(),
    tenantB = randomUUID();
  const identityId = randomUUID(),
    outsiderIdentityId = randomUUID();
  const memberA = randomUUID(),
    memberB = randomUUID(),
    outsiderMembership = randomUUID();
  const email = `workspaces-${identityId}@example.test`;
  const password = 'WorkspacePassword123!';
  const tenantIds = [tenantA, tenantB];

  beforeAll(async () => {
    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
      logger: false,
    });
    await configureHttpApplication(app);
    await app.init();
    database = app.get(DATABASE);
    await database
      .insert(tenants)
      .values(tenantIds.map((id) => ({ id, name: `Workspace ${id}`, slug: `workspace-${id}` })));
    const passwordHash = await app.get(PasswordService).hash(password);
    await database.insert(identities).values([
      { id: identityId, email, passwordHash },
      { id: outsiderIdentityId, email: `outsider-${identityId}@example.test`, passwordHash },
    ]);
    await database.insert(tenantMemberships).values([
      {
        id: memberA,
        tenantId: tenantA,
        identityId,
        status: 'active',
        activatedAt: sql`CURRENT_TIMESTAMP`,
        displayName: 'Member A',
      },
      {
        id: memberB,
        tenantId: tenantB,
        identityId,
        status: 'active',
        activatedAt: sql`CURRENT_TIMESTAMP`,
        displayName: 'Member B',
      },
      {
        id: outsiderMembership,
        tenantId: tenantB,
        identityId: outsiderIdentityId,
        status: 'active',
        activatedAt: sql`CURRENT_TIMESTAMP`,
      },
    ]);
    await database.insert(userAccessGrants).values([
      { tenantId: tenantA, userId: memberA, role: 'observer', scopeType: 'tenant' },
      { tenantId: tenantB, userId: memberB, role: 'observer', scopeType: 'tenant' },
    ]);
  });

  afterAll(async () => {
    if (database) {
      await database
        .delete(idempotencyRecords)
        .where(inArray(idempotencyRecords.tenantId, tenantIds));
      await database.delete(auditEvents).where(inArray(auditEvents.tenantId, tenantIds));
      await database.delete(accountSettings).where(inArray(accountSettings.tenantId, tenantIds));
      await database.delete(authSessions).where(inArray(authSessions.tenantId, tenantIds));
      await database
        .delete(authWorkspaceChallenges)
        .where(inArray(authWorkspaceChallenges.identityId, [identityId, outsiderIdentityId]));
      await database.delete(userAccessGrants).where(inArray(userAccessGrants.tenantId, tenantIds));
      await database
        .delete(tenantMemberships)
        .where(inArray(tenantMemberships.tenantId, tenantIds));
      await database
        .delete(identities)
        .where(inArray(identities.id, [identityId, outsiderIdentityId]));
      await database.delete(tenants).where(inArray(tenants.id, tenantIds));
    }
    await app?.close();
  });

  async function challenge() {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json<WorkspaceSelectionChallenge>();
    expect(body.workspaceRequired).toBe(true);
    return body;
  }

  async function login(membershipId = memberA) {
    const { selectionToken } = await challenge();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/select-tenant',
      payload: { selectionToken, membershipId },
    });
    expect(response.statusCode).toBe(200);
    return response.json<AuthenticationTokens>();
  }

  function headers(tokens: AuthenticationTokens) {
    return { authorization: `Bearer ${tokens.accessToken}`, 'idempotency-key': randomUUID() };
  }

  it('keeps legacy routes and only exposes the authenticated identity memberships', async () => {
    const tokens = await login();
    const [versioned, legacy, memberships] = await Promise.all([
      app.inject({ method: 'GET', url: '/api/v1/me', headers: headers(tokens) }),
      app.inject({ method: 'GET', url: '/auth/me', headers: headers(tokens) }),
      app.inject({ method: 'GET', url: '/api/v1/me/memberships', headers: headers(tokens) }),
    ]);
    expect(versioned.statusCode).toBe(200);
    expect(versioned.json()).toMatchObject({
      identityId,
      membershipId: memberA,
      tenantId: tenantA,
      email,
    });
    expect(versioned.payload).not.toContain('password');
    expect(legacy.json()).toEqual({ userId: memberA, tenantId: tenantA });
    expect(
      memberships
        .json()
        .map((row: { membershipId: string }) => row.membershipId)
        .sort(),
    ).toEqual([memberA, memberB].sort());
  });

  it('denies an unrelated membership and does not consume a valid challenge on rejection', async () => {
    const { selectionToken } = await challenge();
    const denied = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/select-tenant',
      payload: { selectionToken, membershipId: outsiderMembership },
    });
    expect(denied.statusCode).toBe(401);
    const allowed = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/select-tenant',
      payload: { selectionToken, membershipId: memberA },
    });
    expect(allowed.statusCode).toBe(200);
  });

  it('permits exactly one concurrent use of a selection challenge', async () => {
    const { selectionToken } = await challenge();
    const responses = await Promise.all(
      [memberA, memberB].map((membershipId) =>
        app.inject({
          method: 'POST',
          url: '/api/v1/auth/select-tenant',
          payload: { selectionToken, membershipId },
        }),
      ),
    );
    expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 401]);
  });

  it('rejects challenges invalidated by credential changes', async () => {
    const { selectionToken } = await challenge();
    await database
      .update(identities)
      .set({ credentialsUpdatedAt: sql`clock_timestamp()`, updatedAt: sql`clock_timestamp()` })
      .where(eq(identities.id, identityId));
    const result = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/select-tenant',
      payload: { selectionToken, membershipId: memberA },
    });
    expect(result.statusCode).toBe(401);
  });

  it('switches workspace atomically, rejects replay and returns destination permissions', async () => {
    const tokens = await login();
    const switched = await app.inject({
      method: 'POST',
      url: '/api/v1/me/active-membership',
      headers: headers(tokens),
      payload: { membershipId: memberB },
    });
    expect(switched.statusCode).toBe(200);
    expect(
      (await app.inject({ method: 'GET', url: '/api/v1/me', headers: headers(tokens) })).statusCode,
    ).toBe(401);
    const destination = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: headers(switched.json()),
    });
    expect(destination.json()).toMatchObject({
      membershipId: memberB,
      tenantId: tenantB,
      grants: [{ role: 'auditor' }],
    });
  });

  it('does not revoke the source session when an unauthorized switch fails', async () => {
    const tokens = await login();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/me/active-membership',
      headers: headers(tokens),
      payload: { membershipId: outsiderMembership },
    });
    expect(response.statusCode).toBe(401);
    expect(
      (await app.inject({ method: 'GET', url: '/api/v1/me', headers: headers(tokens) })).statusCode,
    ).toBe(200);
  });

  it('isolates profile and preferences between memberships and validates input', async () => {
    const tokens = await login();
    const result = await app.inject({
      method: 'PATCH',
      url: '/api/v1/me',
      headers: headers(tokens),
      payload: {
        displayName: '  Updated A  ',
        locale: 'fr',
        timezone: 'Europe/Paris',
        phone: '+33123456789',
      },
    });
    expect(result.statusCode).toBe(200);
    expect(result.json()).toMatchObject({
      displayName: 'Updated A',
      timezone: 'Europe/Paris',
      locale: 'fr',
    });
    for (const payload of [
      { tenantId: tenantB },
      { timezone: 'Not/AZone' },
      { displayName: '   ' },
      { locale: null },
    ]) {
      expect(
        (
          await app.inject({
            method: 'PATCH',
            url: '/api/v1/me',
            headers: headers(tokens),
            payload,
          })
        ).statusCode,
      ).toBe(400);
    }
    const h = headers(tokens);
    const preference = await app.inject({
      method: 'PATCH',
      url: '/api/v1/me/preferences',
      headers: h,
      payload: { theme: 'dark' },
    });
    expect(preference.json()).toMatchObject({ theme: 'dark' });
    const replay = await app.inject({
      method: 'PATCH',
      url: '/api/v1/me/preferences',
      headers: h,
      payload: { theme: 'dark' },
    });
    expect(replay.headers['idempotency-replayed']).toBe('true');
    const other = await login(memberB);
    expect(
      (
        await app.inject({ method: 'GET', url: '/api/v1/me/preferences', headers: headers(other) })
      ).json(),
    ).toMatchObject({ theme: 'system' });
  });

  it('revokes only the caller workspace sessions without leaking hashes', async () => {
    const kept = await login(),
      revoked = await login(),
      other = await login(memberB);
    const inbox = await app.inject({
      method: 'GET',
      url: '/api/v1/me/sessions?limit=1',
      headers: headers(kept),
    });
    expect(inbox.statusCode).toBe(200);
    expect(inbox.json().items).toHaveLength(1);
    expect(inbox.payload).not.toContain('refreshTokenHash');
    const otherSessions = await app.inject({
      method: 'GET',
      url: '/api/v1/me/sessions',
      headers: headers(other),
    });
    const otherId = otherSessions.json().items[0].id;
    expect(
      (
        await app.inject({
          method: 'DELETE',
          url: `/api/v1/me/sessions/${otherId}`,
          headers: headers(kept),
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await app.inject({
          method: 'DELETE',
          url: '/api/v1/me/sessions/others',
          headers: headers(kept),
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await app.inject({ method: 'GET', url: '/api/v1/me', headers: headers(revoked) }))
        .statusCode,
    ).toBe(401);
    expect(
      (await app.inject({ method: 'GET', url: '/api/v1/me', headers: headers(other) })).statusCode,
    ).toBe(200);
    expect(
      (await app.inject({ method: 'GET', url: '/api/v1/me', headers: headers(kept) })).statusCode,
    ).toBe(200);
  });

  it('enforces the authentication limiter atomically in Redis', async () => {
    const limiter = new AuthRateLimitGuard(
      app.get(RedisService),
      new ConfigService({ AUTH_RATE_LIMIT_IP: 1, AUTH_RATE_LIMIT_ACCOUNT: 1 }),
    );
    const ip = `test-${randomUUID()}`;
    const context = {
      getHandler: () => function login() {},
      switchToHttp: () => ({
        getRequest: () => ({ ip, body: { email: `${randomUUID()}@example.test` } }),
        getResponse: () => ({ header: () => undefined }),
      }),
    } as never;
    const outcomes = await Promise.allSettled([
      limiter.canActivate(context),
      limiter.canActivate(context),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === 'rejected')).toHaveLength(1);
  });

  it('rejects stale account edits without changing the stored profile', async () => {
    const tokens = await login();
    const before = await app.inject({ method: 'GET', url: '/api/v1/me', headers: headers(tokens) });
    const changed = await app.inject({
      method: 'PATCH',
      url: '/api/v1/me',
      headers: { ...headers(tokens), 'if-match': String(before.headers.etag) },
      payload: { displayName: 'Current name' },
    });
    expect(changed.statusCode).toBe(200);
    const stale = await app.inject({
      method: 'PATCH',
      url: '/api/v1/me',
      headers: { ...headers(tokens), 'if-match': String(before.headers.etag) },
      payload: { displayName: 'Stale name' },
    });
    expect(stale.statusCode).toBe(412);
    expect(
      (await app.inject({ method: 'GET', url: '/api/v1/me', headers: headers(tokens) })).json()
        .displayName,
    ).toBe('Current name');
  });

  it('suspends one native membership without suspending other workspaces', async () => {
    const a = await login(),
      b = await login(memberB);
    await app.get(UserRepository).updateStatus(tenantA, memberA, 'suspended');
    expect(
      (await app.inject({ method: 'GET', url: '/api/v1/me', headers: headers(a) })).statusCode,
    ).toBe(401);
    expect(
      (await app.inject({ method: 'GET', url: '/api/v1/me', headers: headers(b) })).statusCode,
    ).toBe(200);
    await app.get(UserRepository).updateStatus(tenantA, memberA, 'active');
  });
});
