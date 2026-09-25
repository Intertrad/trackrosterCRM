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
  prospectAddresses,
  establishmentContacts,
  actions,
  auditEvents,
  authSessions,
  campaignProspectAssignments,
  campaignProspects,
  campaigns,
  establishments,
  identities,
  idempotencyRecords,
  membershipResourceScopes,
  membershipScopeDenials,
  organizations,
  teams,
  tenantMemberships,
  tenantRolePermissions,
  tenants,
  territories,
  userAccessGrants,
} from '../src/database/schema/index.js';
import { PasswordService } from '../src/auth/password.service.js';
describe('Prospect master APIs', () => {
  let app: NestFastifyApplication, db: Database;
  const tenant = randomUUID(),
    foreignTenant = randomUUID(),
    admin = randomUUID(),
    member = randomUUID(),
    outsider = randomUUID(),
    foreign = randomUUID();
  const org = randomUUID(),
    foreignOrg = randomUUID(),
    team = randomUUID(),
    campaign = randomUUID(),
    duplicateCampaign = randomUUID(),
    foreignCampaign = randomUUID(),
    territory = randomUUID();
  const places = Array.from({ length: 5 }, () => randomUUID()),
    prospects = Array.from({ length: 6 }, () => randomUUID()),
    assignments = Array.from({ length: 4 }, () => randomUUID());
  const actors = [admin, member, outsider, foreign],
    tokens = new Map<string, string>();
  const call = (
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    url: string,
    payload?: object,
    actor = admin,
    extra: Record<string, string> = {},
  ) =>
    app.inject({
      method,
      url: `/api/v1${url}`,
      payload,
      headers: {
        authorization: `Bearer ${tokens.get(actor)}`,
        'idempotency-key': randomUUID(),
        ...extra,
      },
    });
  beforeAll(async () => {
    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
      logger: false,
    });
    await configureHttpApplication(app);
    await app.init();
    db = getSeedDatabase();
    await db
      .insert(tenants)
      .values([tenant, foreignTenant].map((id) => ({ id, name: id, slug: id })));
    await db.insert(organizations).values([
      { id: org, tenantId: tenant, name: org, slug: org },
      { id: foreignOrg, tenantId: foreignTenant, name: foreignOrg, slug: foreignOrg },
    ]);
    await db
      .insert(teams)
      .values({ id: team, tenantId: tenant, organizationId: org, name: team, slug: team });
    const password = 'MapTestingPassword123!',
      passwordHash = await app.get(PasswordService).hash(password);
    await db
      .insert(identities)
      .values(actors.map((id) => ({ id, email: `${id}@example.test`, passwordHash })));
    await db.insert(tenantMemberships).values(
      actors.map((id) => ({
        id,
        identityId: id,
        tenantId: id === foreign ? foreignTenant : tenant,
        status: 'active' as const,
        activatedAt: sql`now()`,
      })),
    );
    await db.insert(userAccessGrants).values([
      { tenantId: tenant, userId: admin, role: 'client_admin', scopeType: 'tenant' },
      { tenantId: foreignTenant, userId: foreign, role: 'client_admin', scopeType: 'tenant' },
      {
        tenantId: tenant,
        userId: member,
        role: 'prospector',
        scopeType: 'team',
        organizationId: org,
        teamId: team,
      },
    ]);
    await db.insert(campaigns).values(
      [campaign, duplicateCampaign, foreignCampaign].map((id) => ({
        id,
        tenantId: id === foreignCampaign ? foreignTenant : tenant,
        organizationId: id === foreignCampaign ? foreignOrg : org,
        name: id,
        status: 'active' as const,
      })),
    );
    await db.insert(establishments).values(
      places.map((id, i) => ({
        id,
        tenantId: i === 4 ? foreignTenant : tenant,
        name: `Map ${i}`,
        normalizedName: `map ${i}`,
        countryCode: 'FR',
        longitude: i === 2 ? null : i === 3 ? 179.9 : 2.35 + i * 0.001,
        latitude: i === 2 ? null : i === 3 ? 0 : 48.85 + i * 0.001,
      })),
    );
    await db.insert(campaignProspects).values(
      prospects.map((id, i) => ({
        id,
        tenantId: i === 4 ? foreignTenant : tenant,
        campaignId: i === 4 ? foreignCampaign : i === 5 ? duplicateCampaign : campaign,
        establishmentId: places[i === 5 ? 0 : i]!,
        lifecycleStage: i === 1 ? ('converted' as const) : ('to_contact' as const),
      })),
    );
    await db.insert(campaignProspectAssignments).values(
      assignments.map((id, i) => ({
        id,
        tenantId: tenant,
        campaignId: campaign,
        campaignProspectId: prospects[i]!,
        organizationId: org,
        teamId: team,
        assignedUserId: i === 1 ? outsider : member,
      })),
    );
    await db.execute(
      sql`INSERT INTO territories(id,tenant_id,name,boundary) VALUES(${territory},${tenant},'Paris test',ST_Multi(ST_MakeEnvelope(2.35,48.85,2.36,48.86,4326)))`,
    );
    await db.insert(actions).values({
      tenantId: tenant,
      campaignId: campaign,
      campaignProspectId: prospects[0]!,
      establishmentId: places[0]!,
      assignmentId: assignments[0]!,
      assigneeMembershipId: member,
      createdBy: member,
      type: 'call',
      status: 'completed',
      subject: 'Map completed contact',
      completedAt: new Date(),
    });
    for (const id of actors) {
      const r = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: `${id}@example.test`, password },
      });
      expect(r.statusCode).toBe(200);
      tokens.set(id, r.json().accessToken);
    }
  });
  afterAll(async () => {
    if (db) {
      const ids = [tenant, foreignTenant];
      for (const t of [
        prospectAddresses,
        establishmentContacts,
        actions,
        idempotencyRecords,
        auditEvents,
        membershipResourceScopes,
        membershipScopeDenials,
        tenantRolePermissions,
        campaignProspectAssignments,
        campaignProspects,
        establishments,
        campaigns,
        territories,
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
  }, 60_000);

  it('scopes reads, paginates and rejects foreign cursors and edits', async () => {
    const r = await call('GET', '/prospects?limit=1');
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().nextCursor).toBeTruthy();
    const own = await call('GET', '/prospects', undefined, member);
    expect(own.json().items.every((x: { id: string }) => x.id !== places[1])).toBe(true);
    expect((await call('GET', `/prospects/${places[0]}`, undefined, foreign)).statusCode).toBe(404);
    expect(
      (await call('PATCH', `/prospects/${places[0]}`, { name: 'bad' }, outsider)).statusCode,
    ).toBe(404);
    expect((await call('GET', `/prospects?cursor=${randomUUID()}`)).statusCode).toBe(400);
  });
  it('creates idempotently and enforces validation and optimistic concurrency', async () => {
    const key = randomUUID(),
      input = { name: ' New prospect ', countryCode: 'fr' };
    const r = await call('POST', '/prospects', input, admin, { 'idempotency-key': key });
    expect(r.statusCode, r.body).toBe(201);
    const id = r.json().id;
    expect(
      (await call('POST', '/prospects', input, admin, { 'idempotency-key': key })).json().id,
    ).toBe(id);
    const updated = await call('PATCH', `/prospects/${id}`, { name: 'Updated' }, admin, {
      'if-match': String(r.headers.etag),
    });
    expect(updated.statusCode, updated.body).toBe(200);
    expect(
      (
        await call('PATCH', `/prospects/${id}`, { name: 'Stale' }, admin, {
          'if-match': String(r.headers.etag),
        })
      ).statusCode,
    ).toBe(412);
    for (const data of [
      { name: null },
      { countryCode: null },
      { latitude: 1 },
      { status: 'archived' },
      {},
    ])
      expect((await call('PATCH', `/prospects/${id}`, data)).statusCode).toBe(400);
    expect((await call('POST', '/prospects', input, member)).statusCode).toBe(403);
  });
  it('maintains primary addresses, map coordinates, tenant-safe edits and soft deletion', async () => {
    const id = (
      await call('POST', '/prospects', { name: 'Address test', countryCode: 'FR' })
    ).json().id;
    const r = await call('POST', `/prospects/${id}/addresses`, {
      line1: '1 Street',
      countryCode: 'FR',
      latitude: 48,
      longitude: 2,
      isPrimary: true,
    });
    expect(r.statusCode, r.body).toBe(201);
    const address = r.json().id;
    expect((await call('GET', `/prospects/${id}`)).json().latitude).toBe(48);
    expect(
      (await call('PATCH', `/prospect-addresses/${address}`, { city: 'Paris' }, foreign))
        .statusCode,
    ).toBe(404);
    expect(
      (await call('PATCH', `/prospect-addresses/${address}`, { city: 'Paris' })).statusCode,
    ).toBe(200);
    const second = await call('POST', `/prospects/${id}/addresses`, {
      line1: '2 Street',
      countryCode: 'FR',
      isPrimary: true,
    });
    expect(second.statusCode, second.body).toBe(201);
    const list = (await call('GET', `/prospects/${id}/addresses`)).json().items;
    expect(list.filter((x: { isPrimary: boolean }) => x.isPrimary)).toHaveLength(1);
    expect((await call('DELETE', `/prospect-addresses/${second.json().id}`)).statusCode).toBe(204);
    expect((await call('GET', `/prospects/${id}`)).json().latitude).toBeNull();
  });
  it('normalizes contacts, preserves primary uniqueness and archives without erasing history', async () => {
    const id = (
      await call('POST', '/prospects', { name: 'Contact test', countryCode: 'FR' })
    ).json().id;
    const r = await call('POST', `/prospects/${id}/contacts`, {
      name: 'First',
      email: 'First@Example.com',
      isPrimary: true,
    });
    expect(r.statusCode, r.body).toBe(201);
    const contact = r.json().id;
    expect(r.json().email).toBe('first@example.com');
    expect(
      (await call('POST', `/prospects/${id}/contacts`, { email: 'first@example.com' })).statusCode,
    ).toBe(409);
    expect(
      (await call('PATCH', `/prospect-contacts/${contact}`, { phone: '123' })).statusCode,
    ).toBe(200);
    expect(
      (await call('POST', `/prospects/${id}/contacts`, { name: 'Second', isPrimary: true }))
        .statusCode,
    ).toBe(201);
    expect(
      (await call('GET', `/prospects/${id}/contacts`))
        .json()
        .items.filter((x: { isPrimary: boolean }) => x.isPrimary),
    ).toHaveLength(1);
    expect((await call('DELETE', `/prospect-contacts/${contact}`)).statusCode).toBe(204);
    expect(
      (
        await db.select().from(establishmentContacts).where(eq(establishmentContacts.id, contact))
      )[0]?.status,
    ).toBe('archived');
  });
  it('blocks archival with open work, archives empty prospects and restores', async () => {
    expect((await call('DELETE', `/prospects/${places[0]}`)).statusCode).toBe(409);
    const id = (
      await call('POST', '/prospects', { name: 'Archive test', countryCode: 'FR' })
    ).json().id;
    expect((await call('DELETE', `/prospects/${id}`)).statusCode).toBe(204);
    expect((await call('PATCH', `/prospects/${id}`, { name: 'bad' })).statusCode).toBe(409);
    expect(
      (await call('GET', '/prospects?status=archived'))
        .json()
        .items.some((x: { id: string }) => x.id === id),
    ).toBe(true);
    expect((await call('POST', `/prospects/${id}/restore`)).statusCode).toBe(200);
  });
});
