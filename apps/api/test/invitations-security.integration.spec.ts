import { TokenService } from '../src/auth/token.service.js';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { eq, inArray, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureHttpApplication } from '../src/config/http-application.js';
import { getSeedDatabase } from './support/seed.js';
import type { Database } from '../src/database/database.types.js';
import {
  identities,
  tenantMemberships,
  tenants,
  userAccessGrants,
  auditEvents,
  authSessions,
  idempotencyRecords,
  membershipInvitations,
  authMfaChallenges,
  authMfaFactors,
  tenantSecurityPolicies,
} from '../src/database/schema/index.js';
import { PasswordService } from '../src/auth/password.service.js';
import { AuthMailService } from '../src/auth/auth-mail.service.js';
import { openSecret, tokenHash, totp } from '../src/auth/mfa-crypto.js';

describe('Invitations and tenant security settings', () => {
  let app: NestFastifyApplication, db: Database, mail: AuthMailService;
  const tenantId = randomUUID(),
    otherTenantId = randomUUID(),
    adminId = randomUUID(),
    memberId = randomUUID(),
    otherId = randomUUID();
  const identityIds: string[] = [adminId, otherId];
  const password = 'SecurityPassword123!';
  const adminEmail = `admin-${adminId}@example.test`,
    otherEmail = `other-${otherId}@example.test`;
  const newEmail = `new-${randomUUID()}@example.test`;
  let adminToken: string,
    otherToken: string,
    invitationToken: string,
    newMemberId: string,
    newIdentityId: string;
  const messageIds: string[] = [];
  const request = (
    url: string,
    payload?: object,
    token?: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'POST',
    key = randomUUID(),
  ) =>
    app.inject({
      method,
      url: `/api/v1${url}`,
      payload,
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'idempotency-key': key },
    });
  async function emailedToken(email: string) {
    // Deliver all currently queued messages (other tests can run concurrently).
    let id: string | undefined;
    for (let i = 0; i < 20; i++) {
      await mail.dispatchPending();
      const result = (await (
        await fetch(
          `${process.env.MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
        )
      ).json()) as { messages: { ID: string }[] };
      id = result.messages.find((row) => !messageIds.includes(row.ID))?.ID;
      if (id) break;
    }
    expect(id).toBeDefined();
    messageIds.push(id!);
    const detail = (await (
      await fetch(`${process.env.MAILPIT_URL}/api/v1/message/${id}`)
    ).json()) as { Text: string };
    return /#token=([A-Za-z0-9_-]{43})/.exec(detail.Text)![1]!;
  }
  async function enableMfa(email: string, access: string) {
    const enrollment = await request('/auth/mfa/enroll', { password }, access);
    expect(enrollment.statusCode).toBe(200);
    const challengeToken = enrollment.json().challengeToken as string;
    const [challenge] = await db
      .select()
      .from(authMfaChallenges)
      .where(eq(authMfaChallenges.tokenHash, tokenHash(challengeToken)));
    const secret = openSecret(
      challenge!.encryptedSecret!,
      Buffer.from(process.env.MFA_ENCRYPTION_KEY!, 'hex'),
      challenge!.identityId,
    );
    const verified = await request('/auth/mfa/verify', {
      challengeToken,
      code: totp(secret, Math.floor(Date.now() / 30000)),
    });
    expect(verified.statusCode).toBe(200);
    const login = await request('/auth/login', { email, password });
    const result = await request('/auth/mfa/recovery', {
      challengeToken: login.json().challengeToken,
      code: verified.json().recoveryCodes[0],
    });
    expect(result.statusCode).toBe(200);
    return { token: result.json().accessToken as string, secret };
  }
  beforeAll(async () => {
    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
      logger: false,
      abortOnError: false,
    });
    await configureHttpApplication(app);
    await app.init();
    db = getSeedDatabase();
    mail = app.get(AuthMailService);
    await mail.onModuleDestroy();
    await db.insert(tenants).values(
      [tenantId, otherTenantId].map((id) => ({
        id,
        name: `Security ${id}`,
        slug: `security-${id}`,
      })),
    );
    const passwordHash = await app.get(PasswordService).hash(password);
    await db.insert(identities).values([
      { id: adminId, email: adminEmail, passwordHash },
      { id: otherId, email: otherEmail, passwordHash },
    ]);
    await db.insert(tenantMemberships).values([
      {
        id: memberId,
        identityId: adminId,
        tenantId,
        status: 'active',
        activatedAt: sql`CURRENT_TIMESTAMP`,
      },
      {
        id: otherId,
        identityId: otherId,
        tenantId: otherTenantId,
        status: 'active',
        activatedAt: sql`CURRENT_TIMESTAMP`,
      },
    ]);
    await db
      .insert(userAccessGrants)
      .values({ tenantId, userId: memberId, role: 'client_admin', scopeType: 'tenant' });
    adminToken = (await request('/auth/login', { email: adminEmail, password })).json().accessToken;
    otherToken = (await request('/auth/login', { email: otherEmail, password })).json().accessToken;
  });
  afterAll(async () => {
    if (db) {
      const tenantIds = [tenantId, otherTenantId];
      await db.delete(idempotencyRecords).where(inArray(idempotencyRecords.tenantId, tenantIds));
      await db.delete(auditEvents).where(inArray(auditEvents.tenantId, tenantIds));
      await db.delete(authSessions).where(inArray(authSessions.tenantId, tenantIds));
      await db.delete(userAccessGrants).where(inArray(userAccessGrants.tenantId, tenantIds));
      await db.delete(tenantMemberships).where(inArray(tenantMemberships.tenantId, tenantIds));
      await db.delete(identities).where(inArray(identities.id, identityIds));
      await db.delete(tenants).where(inArray(tenants.id, tenantIds));
    }
    if (messageIds.length)
      await fetch(`${process.env.MAILPIT_URL}/api/v1/messages`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ IDs: messageIds }),
      });
    await app?.close();
  });
  it('restricts invitation creation and validates role/scope without creating an identity', async () => {
    expect(
      (await request('/memberships', { email: newEmail, role: 'auditor' }, otherToken)).statusCode,
    ).toBe(403);
    expect(
      (await request('/memberships', { email: newEmail, role: 'prospector' }, adminToken))
        .statusCode,
    ).toBe(400);
    expect(await db.select().from(identities).where(eq(identities.email, newEmail))).toHaveLength(
      0,
    );
  });
  it('creates one pending membership on idempotent retries and delivers a safe invitation', async () => {
    const key = randomUUID(),
      input = { email: newEmail, role: 'auditor' };
    const result = await request('/memberships', input, adminToken, 'POST', key);
    expect(result.statusCode).toBe(201);
    expect((await request('/memberships', input, adminToken, 'POST', key)).json()).toEqual(
      result.json(),
    );
    newMemberId = result.json().membershipId;
    const [row] = await db
      .select()
      .from(tenantMemberships)
      .where(eq(tenantMemberships.id, newMemberId));
    newIdentityId = row!.identityId;
    identityIds.push(newIdentityId);
    invitationToken = await emailedToken(newEmail);
    const preview = await request(`/invitations/${invitationToken}`, undefined, undefined, 'GET');
    expect(preview.statusCode).toBe(200);
    expect(preview.json().emailHint).not.toBe(newEmail);
    expect(preview.json().existingAccount).toBe(false);
    expect((await request('/auth/login', { email: newEmail, password })).statusCode).toBe(401);
  });
  it('replaces a resent invitation and prevents replay or concurrent acceptance', async () => {
    expect(
      (await request(`/memberships/${newMemberId}/resend-invite`, {}, adminToken)).statusCode,
    ).toBe(409);
    await db
      .update(membershipInvitations)
      .set({ createdAt: sql`clock_timestamp() - interval '2 minutes'` })
      .where(eq(membershipInvitations.membershipId, newMemberId));
    expect(
      (await request(`/memberships/${newMemberId}/resend-invite`, {}, adminToken)).statusCode,
    ).toBe(200);
    expect((await request(`/invitations/${invitationToken}/accept`, { password })).statusCode).toBe(
      400,
    );
    invitationToken = await emailedToken(newEmail);
    const responses = await Promise.all([
      request(`/invitations/${invitationToken}/accept`, { password }),
      request(`/invitations/${invitationToken}/accept`, { password }),
    ]);
    expect(responses.filter((row) => row.statusCode === 200)).toHaveLength(1);
    expect((await request('/auth/login', { email: newEmail, password })).statusCode).toBe(200);
    expect(
      (await request(`/invitations/${invitationToken}`, undefined, undefined, 'GET')).statusCode,
    ).toBe(404);
  });
  it('requires an existing identity password and MFA without replacing its password', async () => {
    const enrollment = await enableMfa(otherEmail, otherToken);
    otherToken = enrollment.token;
    const invited = await request(
      '/memberships',
      { email: otherEmail, role: 'auditor' },
      adminToken,
    );
    expect(invited.statusCode).toBe(201);
    const token = await emailedToken(otherEmail);
    expect(
      (await request(`/invitations/${token}/accept`, { password: 'NewPasswordInjection!' }))
        .statusCode,
    ).toBe(401);
    expect((await request(`/invitations/${token}/accept`, { password })).statusCode).toBe(401);
    await db
      .update(authMfaFactors)
      .set({ lastUsedStep: -1 })
      .where(eq(authMfaFactors.identityId, otherId));
    expect(
      (
        await request(`/invitations/${token}/accept`, {
          password,
          mfaCode: totp(enrollment.secret, Math.floor(Date.now() / 30000)),
        })
      ).statusCode,
    ).toBe(200);
    const [identity] = await db.select().from(identities).where(eq(identities.id, otherId));
    expect(await app.get(PasswordService).verify(identity!.passwordHash!, password)).toBe(true);
    const login = await request('/auth/login', { email: otherEmail, password });
    expect(login.json().mfaRequired).toBe(true);
    expect(login.json().memberships).toBeUndefined();
    await db
      .update(authMfaFactors)
      .set({ lastUsedStep: -1 })
      .where(eq(authMfaFactors.identityId, otherId));
    const verified = await request('/auth/mfa/verify', {
      challengeToken: login.json().challengeToken,
      code: totp(enrollment.secret, Math.floor(Date.now() / 30000)),
    });
    expect(verified.statusCode).toBe(200);
    expect(verified.json().workspaceRequired).toBe(true);
    expect(verified.json().memberships).toHaveLength(2);
    const selected = await request('/auth/select-tenant', {
      selectionToken: verified.json().selectionToken,
      membershipId: invited.json().membershipId,
    });
    expect(selected.statusCode).toBe(200);
    expect(selected.json().accessToken).toBeTypeOf('string');
  });
  it('restricts policy changes, protects against admin lockout, and rejects unsupported SSO fields', async () => {
    const observerToken = (await request('/auth/login', { email: newEmail, password })).json()
      .accessToken;
    expect((await request('/settings/security', undefined, observerToken, 'GET')).statusCode).toBe(
      403,
    );
    expect(
      (await request('/settings/security', { requireMfa: true }, adminToken, 'PATCH')).statusCode,
    ).toBe(409);
    expect(
      (await request('/settings/security', { ssoRequired: true }, adminToken, 'PATCH')).statusCode,
    ).toBe(400);
    const enrollment = await enableMfa(adminEmail, adminToken);
    adminToken = enrollment.token;
    const result = await request(
      '/settings/security',
      { requireMfa: true, passwordMinLength: 20, sessionMaxHours: 2 },
      adminToken,
      'PATCH',
    );
    expect(result.statusCode).toBe(200);
    expect(result.json()).toMatchObject({
      requireMfa: true,
      passwordMinLength: 20,
      sessionMaxHours: 2,
    });
    await db
      .update(authMfaFactors)
      .set({ lastUsedStep: -1 })
      .where(eq(authMfaFactors.identityId, adminId));
    expect(
      (
        await request(
          '/auth/mfa',
          { password, code: totp(enrollment.secret, Math.floor(Date.now() / 30000)) },
          adminToken,
          'DELETE',
        )
      ).statusCode,
    ).toBe(409);
  });
  it('offers required enrollment instead of tokens to members without MFA', async () => {
    const result = await request('/auth/login', { email: newEmail, password });
    expect(result.statusCode).toBe(200);
    expect(result.json().mfaEnrollmentRequired).toBe(true);
    expect(result.json().accessToken).toBeUndefined();
    const [challenge] = await db
      .select()
      .from(authMfaChallenges)
      .where(eq(authMfaChallenges.tokenHash, tokenHash(result.json().challengeToken)));
    const secret = openSecret(
      challenge!.encryptedSecret!,
      Buffer.from(process.env.MFA_ENCRYPTION_KEY!, 'hex'),
      newIdentityId,
    );
    expect(
      (
        await request('/auth/mfa/verify', {
          challengeToken: result.json().challengeToken,
          code: totp(secret, Math.floor(Date.now() / 30000)),
        })
      ).statusCode,
    ).toBe(200);
    expect((await request('/auth/login', { email: newEmail, password })).json().mfaRequired).toBe(
      true,
    );
  });
  it('enforces tenant password policy during recovery without removing MFA', async () => {
    expect((await request('/auth/password/forgot', { email: newEmail })).statusCode).toBe(202);
    const resetToken = await emailedToken(newEmail);
    expect(
      (await request('/auth/password/reset', { token: resetToken, password: 'ShorterThan20!' }))
        .statusCode,
    ).toBe(400);
    const newPassword = 'NewLongPasswordForSecurity123!';
    expect(
      (await request('/auth/password/reset', { token: resetToken, password: newPassword }))
        .statusCode,
    ).toBe(204);
    expect(
      (await request('/auth/login', { email: newEmail, password: newPassword })).json().mfaRequired,
    ).toBe(true);
  });

  it('does not let a pending invitation impose account-wide security policy', async () => {
    const id = randomUUID(),
      pendingEmail = `pending-${id}@example.test`;
    identityIds.push(id);
    await db.insert(identities).values({
      id,
      email: pendingEmail,
      passwordHash: await app.get(PasswordService).hash(password),
    });
    await db.insert(tenantMemberships).values([
      {
        identityId: id,
        tenantId: otherTenantId,
        status: 'active',
        activatedAt: sql`clock_timestamp()`,
      },
      { identityId: id, tenantId, status: 'invited', invitedAt: sql`clock_timestamp()` },
    ]);
    const result = await request('/auth/login', { email: pendingEmail, password });
    expect(result.statusCode).toBe(200);
    expect(result.json().accessToken).toBeTypeOf('string');
    expect(result.json().mfaEnrollmentRequired).toBeUndefined();
  });

  it('applies the accepting workspace password policy to a new identity', async () => {
    const invitedEmail = `policy-invite-${randomUUID()}@example.test`;
    const invited = await request(
      '/memberships',
      { email: invitedEmail, role: 'auditor' },
      adminToken,
    );
    expect(invited.statusCode).toBe(201);
    const [identity] = await db.select().from(identities).where(eq(identities.email, invitedEmail));
    identityIds.push(identity!.id);
    const inviteToken = await emailedToken(invitedEmail);
    expect(
      (await request(`/invitations/${inviteToken}/accept`, { password: 'ShortPassword123!' }))
        .statusCode,
    ).toBe(400);
    expect(
      (
        await request(`/invitations/${inviteToken}/accept`, {
          password: 'PolicyCompliantPassword123!',
        })
      ).statusCode,
    ).toBe(200);
  });

  it('enforces reduced session lifetime on existing sessions', async () => {
    const sessionId = randomUUID();
    const tokens = await app
      .get(TokenService)
      .createTokens({ identityId: adminId, membershipId: memberId, tenantId, sessionId });
    await db.insert(authSessions).values({
      id: sessionId,
      identityId: adminId,
      membershipId: memberId,
      tenantId,
      refreshTokenHash: app.get(TokenService).hashRefreshToken(tokens.refreshToken),
      createdAt: new Date(Date.now() - 90 * 60000),
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + 3600000),
      absoluteExpiresAt: new Date(Date.now() + 3600000),
    });
    expect(
      (await request('/settings/security', undefined, tokens.accessToken, 'GET')).statusCode,
    ).toBe(200);
    // Shorten the limit for an already existing session.
    await db
      .update(tenantSecurityPolicies)
      .set({ sessionMaxHours: 1 })
      .where(eq(tenantSecurityPolicies.tenantId, tenantId));
    expect(
      (await request('/settings/security', undefined, tokens.accessToken, 'GET')).statusCode,
    ).toBe(401);
  });
});
