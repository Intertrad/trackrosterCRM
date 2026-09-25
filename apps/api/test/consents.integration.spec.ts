import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureHttpApplication } from '../src/config/http-application.js';
import { getSeedDatabase } from './support/seed.js';
import type { Database } from '../src/database/database.types.js';
import {
  auditEvents,
  authSessions,
  campaignProspectAssignments,
  campaignProspects,
  campaigns,
  contactConsents,
  establishments,
  establishmentContacts,
  identities,
  idempotencyRecords,
  organizations,
  prospectActivities,
  prospectFollowUps,
  teams,
  tenantMemberships,
  tenants,
  userAccessGrants,
} from '../src/database/schema/index.js';
import { PasswordService } from '../src/auth/password.service.js';
describe('Prospect consent and opposition', () => {
  let app: NestFastifyApplication, db: Database;
  const tenantId = randomUUID(),
    foreignTenantId = randomUUID(),
    admin = randomUUID(),
    member = randomUUID(),
    outsider = randomUUID(),
    foreign = randomUUID();
  const org = randomUUID(),
    foreignOrg = randomUUID(),
    team = randomUUID(),
    campaign = randomUUID(),
    otherCampaign = randomUUID(),
    establishment = randomUUID(),
    otherEstablishment = randomUUID(),
    prospect = randomUUID(),
    otherProspect = randomUUID(),
    assignment = randomUUID(),
    contact = randomUUID(),
    otherContact = randomUUID();
  const actors = [admin, member, outsider, foreign],
    tokens = new Map<string, string>();
  const path = `/prospects/${establishment}/consents`;
  const call = (
    method: 'GET' | 'POST',
    url: string,
    body?: object,
    actor = admin,
    key: string = randomUUID(),
  ) =>
    app.inject({
      method,
      url: `/api/v1${url}`,
      payload: body,
      headers: { authorization: `Bearer ${tokens.get(actor)}`, 'idempotency-key': key },
    });
  const append = (body: object = {}, actor = admin, key: string = randomUUID()) =>
    call(
      'POST',
      path,
      { channel: 'all', status: 'blocked', reason: 'Requested no further contact', ...body },
      actor,
      key,
    );
  const blocked = async (channel: string | null = 'phone') =>
    (
      await db.execute<{ blocked: boolean }>(
        sql`SELECT trackroster_consent_blocked(${tenantId}::uuid,${establishment}::uuid,${channel}) AS blocked`,
      )
    ).rows[0]!.blocked;
  const activity = () =>
    db.insert(prospectActivities).values({
      tenantId,
      campaignId: campaign,
      campaignProspectId: prospect,
      establishmentId: establishment,
      assignmentId: assignment,
      userId: member,
      reservationId: randomUUID(),
      type: 'call',
    });
  beforeAll(async () => {
    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
      logger: false,
      abortOnError: false,
    });
    await configureHttpApplication(app);
    await app.init();
    db = getSeedDatabase();
    await db
      .insert(tenants)
      .values([tenantId, foreignTenantId].map((id) => ({ id, name: id, slug: id })));
    await db.insert(organizations).values([
      { id: org, tenantId, name: org, slug: org },
      { id: foreignOrg, tenantId: foreignTenantId, name: foreignOrg, slug: foreignOrg },
    ]);
    await db
      .insert(teams)
      .values({ id: team, tenantId, organizationId: org, name: team, slug: team });
    const password = 'ConsentWorkflow123!';
    const passwordHash = await app.get(PasswordService).hash(password);
    await db
      .insert(identities)
      .values(actors.map((id) => ({ id, email: `${id}@example.test`, passwordHash })));
    await db.insert(tenantMemberships).values(
      actors.map((id) => ({
        id,
        identityId: id,
        tenantId: id === foreign ? foreignTenantId : tenantId,
        status: 'active' as const,
        activatedAt: sql`now()`,
      })),
    );
    await db.insert(userAccessGrants).values([
      { tenantId, userId: admin, role: 'client_admin', scopeType: 'tenant' },
      { tenantId: foreignTenantId, userId: foreign, role: 'client_admin', scopeType: 'tenant' },
      {
        tenantId,
        userId: member,
        role: 'prospector',
        scopeType: 'team',
        organizationId: org,
        teamId: team,
      },
    ]);
    await db.insert(campaigns).values(
      [campaign, otherCampaign].map((id) => ({
        id,
        tenantId,
        organizationId: org,
        name: id,
        status: 'active' as const,
      })),
    );
    await db.insert(establishments).values(
      [establishment, otherEstablishment].map((id) => ({
        id,
        tenantId,
        name: id,
        normalizedName: id,
        countryCode: 'FR',
      })),
    );
    await db.insert(establishmentContacts).values([
      { id: contact, tenantId, establishmentId: establishment, name: 'Contact' },
      { id: otherContact, tenantId, establishmentId: otherEstablishment, name: 'Other' },
    ]);
    await db.insert(campaignProspects).values([
      { id: prospect, tenantId, campaignId: campaign, establishmentId: establishment },
      { id: otherProspect, tenantId, campaignId: otherCampaign, establishmentId: establishment },
    ]);
    await db.insert(campaignProspectAssignments).values({
      id: assignment,
      tenantId,
      campaignId: campaign,
      campaignProspectId: prospect,
      organizationId: org,
      teamId: team,
      assignedUserId: member,
    });
    for (const id of actors) {
      const r = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: `${id}@example.test`, password },
      });
      expect(r.statusCode, r.body).toBe(200);
      tokens.set(id, r.json().accessToken);
    }
  });
  afterEach(async () => {
    for (const t of [contactConsents, prospectActivities, prospectFollowUps])
      await db.delete(t).where(eq(t.tenantId, tenantId));
  });
  afterAll(async () => {
    if (db) {
      const ids = [tenantId, foreignTenantId];
      for (const t of [
        contactConsents,
        prospectActivities,
        prospectFollowUps,
        idempotencyRecords,
        auditEvents,
        campaignProspectAssignments,
        campaignProspects,
        establishmentContacts,
        establishments,
        campaigns,
        authSessions,
        userAccessGrants,
        tenantMemberships,
        teams,
        organizations,
      ])
        await db.delete(t).where(inArray(t.tenantId, ids));
      await db.delete(identities).where(inArray(identities.id, actors));
      await db.delete(tenants).where(inArray(tenants.id, ids));
    }
    await app?.close();
  });
  it('allows scoped evidence recording but masks other tenants and unassigned readers', async () => {
    expect((await append({}, member)).statusCode).toBe(201);
    expect((await call('GET', path, undefined, member)).statusCode).toBe(200);
    expect((await call('GET', path, undefined, outsider)).statusCode).toBe(404);
    expect((await append({}, foreign)).statusCode).toBe(404);
    expect((await append({ contactId: otherContact })).statusCode).toBe(404);
    expect((await append({ contactId: contact })).statusCode).toBe(201);
  });
  it('keeps append-only history, pagination, audit and idempotent evidence', async () => {
    const key = randomUUID();
    const first = await append({}, admin, key);
    expect(first.statusCode, first.body).toBe(201);
    expect((await append({}, admin, key)).json().id).toBe(first.json().id);
    await append({ status: 'allowed', reason: 'New permission evidence' });
    const page = (await call('GET', `${path}?limit=1`)).json();
    expect(page.nextCursor).toBeTruthy();
    expect(
      (await call('GET', `${path}?limit=1&cursor=${page.nextCursor}`)).json().items,
    ).toHaveLength(1);
    expect(await blocked()).toBe(false);
    await expect(
      db
        .update(contactConsents)
        .set({ reason: 'Rewrite' })
        .where(eq(contactConsents.id, first.json().id)),
    ).rejects.toMatchObject({ cause: { code: '23514' } });
    expect(
      await db
        .select()
        .from(auditEvents)
        .where(
          and(
            eq(auditEvents.resourceId, establishment),
            eq(auditEvents.action, 'prospect.consent_recorded'),
            sql`${auditEvents.metadata}->'after'->>'id' = ${first.json().id}`,
          ),
        ),
    ).toHaveLength(1);
  });
  it('resolves global and contact/channel blocks conservatively without treating unknown as allowed', async () => {
    await append({ channel: 'phone' });
    expect(await blocked('phone')).toBe(true);
    expect(await blocked('email')).toBe(false);
    await append({ channel: 'phone', status: 'allowed', contactId: contact });
    expect(await blocked('phone')).toBe(true);
    await append({ channel: 'phone', status: 'unknown' });
    expect(await blocked('phone')).toBe(false);
    await append({ contactId: contact, channel: 'email' });
    expect(await blocked('email')).toBe(true);
    expect(await blocked(null)).toBe(true);
    await append({ status: 'blocked', channel: 'all' });
    await append({ status: 'allowed', channel: 'phone' });
    expect(await blocked('phone')).toBe(true);
  });
  it('handles scheduled, backdated and expired evidence without reviving an older block', async () => {
    const iso = (hours: number) => new Date(Date.now() + hours * 3600000).toISOString();
    await append({ effectiveAt: iso(1) });
    expect(await blocked()).toBe(false);
    await append({ effectiveAt: iso(-3) });
    expect(await blocked()).toBe(true);
    await append({ effectiveAt: iso(-2), expiresAt: iso(-1) });
    expect(await blocked()).toBe(false);
    expect((await append({ effectiveAt: iso(1), expiresAt: iso(-1) })).statusCode).toBe(400);
    expect((await append({ reason: '   ' })).statusCode).toBe(400);
    expect((await append({ evidence: { invalid: 123 } })).statusCode).toBe(400);
  });
  it('enforces database contact binding and blocks activity writes across campaign contexts', async () => {
    await expect(
      db.insert(contactConsents).values({
        tenantId,
        prospectId: establishment,
        contactId: otherContact,
        recordedBy: admin,
        channel: 'phone',
        status: 'blocked',
        reason: 'Bad binding',
      }),
    ).rejects.toMatchObject({ cause: { code: '23503' } });
    await append({ channel: 'phone' });
    await expect(activity()).rejects.toMatchObject({ cause: { code: 'PCC01' } });
    const r = await call(
      'POST',
      `/campaigns/${campaign}/prospects/${prospect}/activities`,
      { type: 'call' },
      member,
    );
    expect(r.statusCode, r.body).toBe(409);
    expect(r.json().code).toBe('CONTACT_BLOCKED');
    expect(
      (await call('POST', `/campaigns/${campaign}/prospects/${prospect}/reservation`, {}, member))
        .statusCode,
    ).toBe(409);
    // The same canonical establishment appears in another campaign.
    expect(
      (
        await db.execute<{ blocked: boolean }>(
          sql`SELECT trackroster_consent_blocked(tenant_id,establishment_id,'phone') AS blocked FROM campaign_prospects WHERE id=${otherProspect}`,
        )
      ).rows[0]!.blocked,
    ).toBe(true);
  });
  it('blocks pending follow-up persistence while leaving cancellation available', async () => {
    const [f] = await db
      .insert(prospectFollowUps)
      .values({
        tenantId,
        campaignId: campaign,
        campaignProspectId: prospect,
        establishmentId: establishment,
        assignmentId: assignment,
        createdBy: member,
        assignedUserId: member,
        dueAt: new Date(Date.now() + 3600000),
        channel: 'call',
      })
      .returning();
    await append({ channel: 'phone' });
    await expect(
      db
        .update(prospectFollowUps)
        .set({ dueAt: new Date(Date.now() + 7200000) })
        .where(eq(prospectFollowUps.id, f!.id)),
    ).rejects.toMatchObject({ cause: { code: 'PCC01' } });
    await db
      .update(prospectFollowUps)
      .set({ status: 'cancelled', cancelledAt: new Date() })
      .where(eq(prospectFollowUps.id, f!.id));
    expect(
      (
        await call(
          'POST',
          `/campaigns/${campaign}/prospects/${prospect}/follow-ups`,
          { dueAt: new Date(Date.now() + 3600000).toISOString(), channel: 'call' },
          member,
        )
      ).statusCode,
    ).toBe(409);
  });
  it('rechecks opposition before replaying an earlier successful activity', async () => {
    const base = `/campaigns/${campaign}/prospects/${prospect}`;
    const reservation = await call('POST', `${base}/reservation`, {}, member);
    expect(reservation.statusCode, reservation.body).toBe(201);
    const key = randomUUID();
    const first = await call('POST', `${base}/activities`, { type: 'call' }, member, key);
    expect(first.statusCode, first.body).toBe(201);
    await append({ channel: 'phone' });
    const replay = await call('POST', `${base}/activities`, { type: 'call' }, member, key);
    expect(replay.statusCode, replay.body).toBe(409);
    expect(replay.json().code).toBe('CONTACT_BLOCKED');
  });
  it('serializes an activity behind concurrent opposition so it cannot bypass the new block', async () => {
    let pending!: Promise<unknown>;
    await db.transaction(async (tx) => {
      await tx
        .select()
        .from(establishments)
        .where(eq(establishments.id, establishment))
        .for('update');
      pending = Promise.resolve(activity()).then(
        () => ({ ok: true }),
        (error) => error,
      );
      await tx.execute(sql`SELECT pg_sleep(0.05)`);
      await tx.insert(contactConsents).values({
        tenantId,
        prospectId: establishment,
        recordedBy: admin,
        channel: 'phone',
        status: 'blocked',
        reason: 'Concurrent opposition',
        effectiveAt: sql`clock_timestamp()`,
      });
    });
    expect(await pending).toMatchObject({ cause: { code: 'PCC01' } });
  });
});
