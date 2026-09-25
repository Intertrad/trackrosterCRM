import { randomBytes, randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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
  authPasswordResets,
  authMailOutbox,
} from '../src/database/schema/index.js';
import { PasswordService } from '../src/auth/password.service.js';
import { AuthMailService } from '../src/auth/auth-mail.service.js';
import { tokenHash } from '../src/auth/mfa-crypto.js';

describe('Password recovery with a local mailbox', () => {
  let app: NestFastifyApplication, db: Database, mail: AuthMailService;
  const tenantId = randomUUID(),
    identityId = randomUUID(),
    memberId = randomUUID();
  const email = `reset-${identityId}@example.test`,
    password = 'OriginalPassword123!';
  let token: string, accessToken: string;
  const messageIds: string[] = [];
  const request = (url: string, payload?: object, method: 'GET' | 'POST' = 'POST') =>
    app.inject({ method, url: `/api/v1${url}`, payload });
  beforeAll(async () => {
    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
      logger: false,
    });
    await configureHttpApplication(app);
    await app.init();
    db = getSeedDatabase();
    mail = app.get(AuthMailService);
    await mail.onModuleDestroy(); // Deterministic manual dispatch; still exercises real HTTP delivery.
    await db
      .insert(tenants)
      .values({ id: tenantId, name: 'Recovery test', slug: `recovery-${tenantId}` });
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
    // Remove only messages created by this suite from the disposable mailbox.
    if (messageIds.length)
      await fetch(`${process.env.MAILPIT_URL}/api/v1/messages`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ IDs: messageIds }),
      });
    await app?.close();
  });
  it('returns the same acknowledgement for unknown accounts and queues delivery without leaking a token', async () => {
    const known = await request('/auth/password/forgot', { email });
    const unknown = await request('/auth/password/forgot', { email: `missing-${email}` });
    expect(known.statusCode).toBe(202);
    expect(unknown.statusCode).toBe(202);
    expect(known.json()).toEqual(unknown.json());
    expect(known.json().token).toBeUndefined();
    await mail.dispatchPending();
    const search = await fetch(
      `${process.env.MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
    );
    const messages = (await search.json()) as { messages: { ID: string }[] };
    expect(messages.messages).toHaveLength(1);
    messageIds.push(messages.messages[0]!.ID);
    const detail = (await (
      await fetch(`${process.env.MAILPIT_URL}/api/v1/message/${messageIds[0]}`)
    ).json()) as { Text: string };
    token = /#token=([A-Za-z0-9_-]{43})/.exec(detail.Text)![1]!;
    const rows = await db
      .select()
      .from(authPasswordResets)
      .where(eq(authPasswordResets.identityId, identityId));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tokenHash).toBe(tokenHash(token));
    expect(JSON.stringify(rows)).not.toContain(token);
  });
  it('does not resend within the cooldown and checks tokens without consuming them', async () => {
    expect((await request('/auth/password/forgot', { email })).statusCode).toBe(202);
    expect(
      await db
        .select()
        .from(authPasswordResets)
        .where(eq(authPasswordResets.identityId, identityId)),
    ).toHaveLength(1);
    for (let i = 0; i < 2; i++)
      expect(
        (await request(`/auth/password-reset/${token}/status`, undefined, 'GET')).json(),
      ).toEqual({ valid: true });
    expect(
      (
        await request(
          `/auth/password-reset/${randomBytes(32).toString('base64url')}/status`,
          undefined,
          'GET',
        )
      ).json(),
    ).toEqual({ valid: false });
  });
  it('enforces minimum password length and atomically allows one reset while revoking sessions', async () => {
    expect((await request('/auth/password/reset', { token, password: 'short' })).statusCode).toBe(
      400,
    );
    const changed = 'UpdatedPassword456!';
    const responses = await Promise.all([
      request('/auth/password/reset', { token, password: changed }),
      request('/auth/password/reset', { token, password: changed }),
    ]);
    expect(responses.map((r) => r.statusCode).sort()).toEqual([204, 400]);
    expect(
      (await request(`/auth/password-reset/${token}/status`, undefined, 'GET')).json(),
    ).toEqual({ valid: false });
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/api/v1/me',
          headers: { authorization: `Bearer ${accessToken}` },
        })
      ).statusCode,
    ).toBe(401);
    expect((await request('/auth/login', { email, password })).statusCode).toBe(401);
    expect((await request('/auth/login', { email, password: changed })).statusCode).toBe(200);
  });
  it('never accepts an expired token', async () => {
    const expired = randomBytes(32).toString('base64url');
    await db.execute(sql`INSERT INTO auth_password_resets (token_hash, identity_id, credentials_updated_at, security_state_updated_at, expires_at)
      SELECT ${tokenHash(expired)}, id, credentials_updated_at, security_state_updated_at, clock_timestamp() - interval '1 second' FROM identities WHERE id = ${identityId}`);
    expect((await request('/auth/password/reset', { token: expired, password })).statusCode).toBe(
      400,
    );
  });
  it('scrubs expired queued secrets without attempting delivery', async () => {
    const id = randomUUID();
    await db
      .insert(authMailOutbox)
      .values({ id, encryptedPayload: 'expired-secret', expiresAt: new Date(Date.now() - 1000) });
    await mail.dispatchPending();
    const [row] = await db.select().from(authMailOutbox).where(eq(authMailOutbox.id, id));
    expect(row!.encryptedPayload).toBeNull();
    expect(row!.failedAt).not.toBeNull();
    expect(row!.attempts).toBe(0);
    await db.delete(authMailOutbox).where(eq(authMailOutbox.id, id));
  });
});
