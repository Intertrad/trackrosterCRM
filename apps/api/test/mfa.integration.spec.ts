import { TokenService } from '../src/auth/token.service.js';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { and, eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureHttpApplication } from '../src/config/http-application.js';
import { getSeedDatabase } from './support/seed.js';
import type { Database } from '../src/database/database.types.js';
import {
  identities,
  tenantMemberships,
  tenants,
  auditEvents,
  authSessions,
  authMfaFactors,
  authMfaChallenges,
  authMfaRecoveryCodes,
} from '../src/database/schema/index.js';
import { PasswordService } from '../src/auth/password.service.js';
import { openSecret, tokenHash, totp } from '../src/auth/mfa-crypto.js';

describe('Authenticator MFA', () => {
  let app: NestFastifyApplication, db: Database;
  const tenantId = randomUUID(),
    identityId = randomUUID(),
    memberId = randomUUID();
  const email = `mfa-${identityId}@example.test`,
    password = 'MfaPassword123!';
  let accessToken: string, secret: Buffer, recoveryCodes: string[];
  const request = (
    url: string,
    payload?: object,
    token?: string,
    method: 'GET' | 'POST' | 'DELETE' = 'POST',
  ) =>
    app.inject({
      method,
      url: `/api/v1${url}`,
      payload,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
  async function loginChallenge() {
    const response = await request('/auth/login', { email, password });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ mfaRequired: true, expiresIn: 300 });
    expect(response.json().accessToken).toBeUndefined();
    return response.json().challengeToken as string;
  }
  async function freshCode() {
    // Permit the current clock step in this test without sleeping 30 seconds.
    await db
      .update(authMfaFactors)
      .set({ lastUsedStep: -1 })
      .where(eq(authMfaFactors.identityId, identityId));
    return totp(secret, Math.floor(Date.now() / 30000));
  }
  beforeAll(async () => {
    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
      logger: false,
    });
    await configureHttpApplication(app);
    await app.init();
    db = getSeedDatabase();
    await db.insert(tenants).values({ id: tenantId, name: 'MFA test', slug: `mfa-${tenantId}` });
    await db.insert(identities).values({
      id: identityId,
      email,
      passwordHash: await app.get(PasswordService).hash(password),
    });
    await db.insert(tenantMemberships).values({
      id: memberId,
      identityId,
      tenantId,
      status: 'active',
      activatedAt: sql`CURRENT_TIMESTAMP`,
    });
    accessToken = (await request('/auth/login', { email, password })).json().accessToken;
  });
  afterAll(async () => {
    if (db) {
      await db.delete(auditEvents).where(eq(auditEvents.tenantId, tenantId));
      await db.delete(authSessions).where(eq(authSessions.identityId, identityId));
      await db.delete(tenantMemberships).where(eq(tenantMemberships.id, memberId));
      await db.delete(identities).where(eq(identities.id, identityId));
      await db.delete(tenants).where(eq(tenants.id, tenantId));
    }
    await app?.close();
  });
  it('requires password confirmation and enrollment verification; encrypts the secret', async () => {
    expect((await request('/auth/mfa/enroll', { password: 'wrong' }, accessToken)).statusCode).toBe(
      401,
    );
    const enrolled = await request('/auth/mfa/enroll', { password }, accessToken);
    expect(enrolled.statusCode).toBe(200);
    expect(enrolled.headers['cache-control']).toBe('no-store');
    const body = enrolled.json();
    expect(body.otpauthUri).toContain('otpauth://totp/');
    const [challenge] = await db
      .select()
      .from(authMfaChallenges)
      .where(eq(authMfaChallenges.tokenHash, tokenHash(body.challengeToken)));
    expect(challenge!.encryptedSecret).not.toContain(body.setupKey);
    secret = openSecret(
      challenge!.encryptedSecret!,
      Buffer.from(process.env.MFA_ENCRYPTION_KEY!, 'hex'),
      identityId,
    );
    expect(
      (await db.select().from(identities).where(eq(identities.id, identityId)))[0]!.mfaEnrolledAt,
    ).toBeNull();
    const verified = await request('/auth/mfa/verify', {
      challengeToken: body.challengeToken,
      code: totp(secret, Math.floor(Date.now() / 30000)),
    });
    expect(verified.statusCode).toBe(200);
    recoveryCodes = verified.json().recoveryCodes;
    expect(recoveryCodes).toHaveLength(10);
    expect((await request('/me', undefined, accessToken, 'GET')).statusCode).toBe(401);
    const stored = await db
      .select()
      .from(authMfaRecoveryCodes)
      .where(eq(authMfaRecoveryCodes.identityId, identityId));
    expect(stored.map((row) => row.codeHash)).not.toContain(recoveryCodes[0]);
  });
  it('allows exactly one concurrent TOTP verification and rejects code replay across challenges', async () => {
    const challengeToken = await loginChallenge(),
      code = await freshCode();
    const responses = await Promise.all([
      request('/auth/mfa/verify', { challengeToken, code }),
      request('/auth/mfa/verify', { challengeToken, code }),
    ]);
    expect(responses.map((r) => r.statusCode).sort()).toEqual([200, 401]);
    accessToken = responses.find((r) => r.statusCode === 200)!.json().accessToken;
    expect((await request('/me', undefined, accessToken, 'GET')).statusCode).toBe(200);
    expect(
      (await request('/auth/mfa/verify', { challengeToken: await loginChallenge(), code }))
        .statusCode,
    ).toBe(401);
  });
  it('locks a challenge after five failed codes, including across different requests', async () => {
    const challengeToken = await loginChallenge();
    const step = Math.floor(Date.now() / 30000);
    const valid = new Set([step - 1, step, step + 1].map((s) => totp(secret, s)));
    let wrong = '000000';
    while (valid.has(wrong)) wrong = String(Number(wrong) + 1).padStart(6, '0');
    for (let i = 0; i < 5; i++)
      expect((await request('/auth/mfa/verify', { challengeToken, code: wrong })).statusCode).toBe(
        401,
      );
    expect(
      (await request('/auth/mfa/verify', { challengeToken, code: await freshCode() })).statusCode,
    ).toBe(401);
    const [challenge] = await db
      .select()
      .from(authMfaChallenges)
      .where(eq(authMfaChallenges.tokenHash, tokenHash(challengeToken)));
    expect(challenge!.attempts).toBe(5);
  });
  it('consumes recovery codes once across independent challenges', async () => {
    const tokens = [await loginChallenge(), await loginChallenge()];
    const responses = await Promise.all(
      tokens.map((challengeToken) =>
        request('/auth/mfa/recovery', { challengeToken, code: recoveryCodes[0] }),
      ),
    );
    expect(responses.map((r) => r.statusCode).sort()).toEqual([200, 401]);
    accessToken = responses.find((r) => r.statusCode === 200)!.json().accessToken;
  });
  it('invalidates challenges when credentials change and rejects expired challenges', async () => {
    const challengeToken = await loginChallenge();
    await db
      .update(identities)
      .set({ credentialsUpdatedAt: sql`clock_timestamp()` })
      .where(eq(identities.id, identityId));
    expect(
      (await request('/auth/mfa/verify', { challengeToken, code: await freshCode() })).statusCode,
    ).toBe(401);
    const expired = await loginChallenge();
    await db
      .update(authMfaChallenges)
      .set({ expiresAt: sql`clock_timestamp() - interval '1 second'` })
      .where(eq(authMfaChallenges.tokenHash, tokenHash(expired)));
    expect(
      (await request('/auth/mfa/recovery', { challengeToken: expired, code: recoveryCodes[1] }))
        .statusCode,
    ).toBe(401);
  });
  it('replaces recovery codes only after password and TOTP; revokes sessions', async () => {
    accessToken = (
      await request('/auth/mfa/recovery', {
        challengeToken: await loginChallenge(),
        code: recoveryCodes[2],
      })
    ).json().accessToken;
    const response = await request(
      '/auth/mfa/recovery-codes/regenerate',
      { password, code: await freshCode() },
      accessToken,
    );
    expect(response.statusCode).toBe(200);
    expect(response.json().recoveryCodes).toHaveLength(10);
    expect((await request('/me', undefined, accessToken, 'GET')).statusCode).toBe(401);
    expect(
      (
        await request('/auth/mfa/recovery', {
          challengeToken: await loginChallenge(),
          code: recoveryCodes[1],
        })
      ).statusCode,
    ).toBe(401);
    recoveryCodes = response.json().recoveryCodes;
    accessToken = (
      await request('/auth/mfa/recovery', {
        challengeToken: await loginChallenge(),
        code: recoveryCodes[0],
      })
    ).json().accessToken;
  });
  it('requires step-up to disable MFA and audits the change', async () => {
    expect(
      (
        await request(
          '/auth/mfa',
          { password: 'wrong', code: await freshCode() },
          accessToken,
          'DELETE',
        )
      ).statusCode,
    ).toBe(401);
    const response = await request(
      '/auth/mfa',
      { password, code: await freshCode() },
      accessToken,
      'DELETE',
    );
    expect(response.statusCode).toBe(204);
    expect((await request('/me', undefined, accessToken, 'GET')).statusCode).toBe(401);
    expect((await request('/auth/login', { email, password })).json().accessToken).toBeTypeOf(
      'string',
    );
    expect(
      await db
        .select()
        .from(auditEvents)
        .where(and(eq(auditEvents.tenantId, tenantId), eq(auditEvents.action, 'mfa.disabled'))),
    ).toHaveLength(1);
  });
  it('serializes workspace switching with credential changes so no session escapes revocation', async () => {
    const token = (await request('/auth/login', { email, password })).json().accessToken;
    let release!: () => void, signal!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const entered = new Promise<void>((resolve) => {
      signal = resolve;
    });
    const tokens = app.get(TokenService);
    const original = tokens.createTokens.bind(tokens);
    const spy = vi.spyOn(tokens, 'createTokens').mockImplementationOnce(async (principal) => {
      signal();
      await gate;
      return original(principal);
    });
    try {
      const switching = request('/me/active-membership', { membershipId: memberId }, token).then(
        (result) => result,
      );
      await entered;
      const credentialChange = db
        .update(identities)
        .set({
          credentialsUpdatedAt: sql`greatest(clock_timestamp(), credentials_updated_at + interval '1 microsecond')`,
        })
        .where(eq(identities.id, identityId))
        .then((result) => result);
      // Allow the competing update to reach its database lock while token creation is paused.
      await new Promise((resolve) => setTimeout(resolve, 50));
      release();
      const [switched] = await Promise.all([switching, credentialChange]);
      expect(switched.statusCode).toBe(200);
      expect((await request('/me', undefined, switched.json().accessToken, 'GET')).statusCode).toBe(
        401,
      );
    } finally {
      release();
      spy.mockRestore();
    }
  });
});
