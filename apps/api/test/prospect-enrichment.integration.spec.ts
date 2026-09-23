import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { inArray, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureHttpApplication } from '../src/config/http-application.js';
import { DATABASE } from '../src/database/database.constants.js';
import type { Database } from '../src/database/database.types.js';
import {
  prospectDuplicates,
  prospectMerges,
  prospectTagLinks,
  prospectTags,
  customFieldValues,
  customFieldDefinitions,
  contactConsents,
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
describe('Prospect enrichment APIs', () => {
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
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT',
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
    db = app.get(DATABASE);
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
        prospectDuplicates,
        prospectMerges,
        prospectTagLinks,
        prospectTags,
        customFieldValues,
        customFieldDefinitions,
        contactConsents,
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

  it('creates, updates, assigns, removes and deletes tenant-safe tags', async () => {
    const r = await call('POST', '/tags', { name: 'VIP', color: '#123abc' });
    expect(r.statusCode, r.body).toBe(201);
    const id = r.json().id;
    expect((await call('POST', '/tags', { name: 'vip' })).statusCode).toBe(409);
    expect((await call('PATCH', `/tags/${id}`, { name: 'Priority' }, foreign)).statusCode).toBe(
      404,
    );
    expect((await call('PATCH', `/tags/${id}`, { name: 'Priority' })).statusCode).toBe(200);
    expect((await call('POST', `/prospects/${places[0]}/tags/${id}`)).statusCode).toBe(200);
    expect((await call('GET', `/prospects/${places[0]}`)).json().tags[0].name).toBe('Priority');
    expect((await call('DELETE', `/tags/${id}`)).statusCode).toBe(409);
    expect((await call('DELETE', `/prospects/${places[0]}/tags/${id}`)).statusCode).toBe(204);
    expect((await call('DELETE', `/tags/${id}`)).statusCode).toBe(204);
  });
  it('validates typed fields, preserves data and enforces visibility and atomic batches', async () => {
    const r = await call('POST', '/custom-fields', {
      fieldKey: 'score',
      label: 'Score',
      dataType: 'number',
      validation: { min: 0, max: 10 },
      visibility: { roles: ['tenant_admin'] },
    });
    expect(r.statusCode, r.body).toBe(201);
    const id = r.json().id;
    expect(
      (await call('PUT', `/prospects/${places[0]}/custom-fields`, { values: { score: 5 } }))
        .statusCode,
    ).toBe(200);
    expect((await call('GET', `/prospects/${places[0]}`)).json().customFields.score).toBe(5);
    expect(
      (await call('GET', `/prospects/${places[0]}`, undefined, member)).json().customFields.score,
    ).toBeUndefined();
    expect((await call('GET', '/custom-fields', undefined, member)).json().items).toHaveLength(0);
    expect(
      (
        await call('PUT', `/prospects/${places[0]}/custom-fields`, {
          values: { score: 8, unknown: 'bad' },
        })
      ).statusCode,
    ).toBe(400);
    expect((await call('GET', `/prospects/${places[0]}`)).json().customFields.score).toBe(5);
    expect(
      (await call('PUT', `/prospects/${places[0]}/custom-fields`, { values: { score: '5' } }))
        .statusCode,
    ).toBe(400);
    expect(
      (await call('PATCH', `/custom-fields/${id}`, { validation: { max: 3 } })).statusCode,
    ).toBe(409);
    expect((await call('PATCH', `/custom-fields/${id}`, { label: 'Rating' })).statusCode).toBe(200);
    expect((await call('DELETE', `/custom-fields/${id}`)).statusCode).toBe(204);
  });
  it('detects candidates and merges without losing source history or opposition', async () => {
    const input = { name: randomUUID(), countryCode: 'FR', city: 'Paris' };
    const left = (await call('POST', '/prospects', input)).json().id;
    const right = (await call('POST', '/prospects', input)).json().id;
    const candidates = await call('GET', '/prospect-duplicates');
    expect(candidates.statusCode, candidates.body).toBe(200);
    const d = candidates
      .json()
      .items.find((x: { leftProspectId: string; rightProspectId: string }) =>
        [x.leftProspectId, x.rightProspectId].includes(left),
      );
    expect(d).toBeTruthy();
    expect((await call('GET', `/prospect-duplicates/${d.id}`, undefined, foreign)).statusCode).toBe(
      404,
    );
    const consent = await call('POST', `/prospects/${left}/consents`, {
      channel: 'email',
      status: 'blocked',
      reason: 'Opposition evidence',
    });
    expect(consent.statusCode, consent.body).toBe(201);
    const result = await call('POST', `/prospect-duplicates/${d.id}/resolve`, {
      resolution: 'merged',
      targetId: right,
    });
    expect(result.statusCode, result.body).toBe(200);
    expect((await call('GET', `/prospects/${left}`)).json().mergedIntoId).toBe(right);
    expect((await call('GET', `/prospects/${right}`)).json().mergedSourceIds).toContain(left);
    expect((await call('POST', `/prospects/${left}/restore`)).statusCode).toBe(409);
    const blocked = await db.execute(
      sql`SELECT trackroster_consent_blocked(${tenant}::uuid,${right}::uuid,'email') AS blocked`,
    );
    expect(blocked.rows[0]?.blocked).toBe(true);
    expect((await call('GET', '/data-quality/overview')).statusCode).toBe(200);
  });
  it('rejects duplicate candidates without changing source data and denies non-admin mutations', async () => {
    const input = { name: randomUUID(), countryCode: 'FR', postalCode: '75001' };
    const left = (await call('POST', '/prospects', input)).json().id;
    await call('POST', '/prospects', input);
    const d = (await call('GET', '/prospect-duplicates'))
      .json()
      .items.find((x: { leftProspectId: string; rightProspectId: string }) =>
        [x.leftProspectId, x.rightProspectId].includes(left),
      );
    expect(
      (
        await call(
          'POST',
          `/prospect-duplicates/${d.id}/resolve`,
          { resolution: 'not_duplicate' },
          member,
        )
      ).statusCode,
    ).toBe(403);
    expect(
      (await call('POST', `/prospect-duplicates/${d.id}/resolve`, { resolution: 'not_duplicate' }))
        .statusCode,
    ).toBe(200);
    expect((await call('GET', `/prospects/${left}`)).json().status).toBe('active');
    expect((await call('POST', '/tags', { name: 'no' }, member)).statusCode).toBe(403);
  });
});
