import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { eq, inArray, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureHttpApplication } from '../src/config/http-application.js';
import { DATABASE } from '../src/database/database.constants.js';
import type { Database } from '../src/database/database.types.js';
import {
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
describe('Scoped prospect maps', () => {
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
  const call = (url: string, actor = admin) =>
    app.inject({
      method: 'GET',
      url: `/api/v1${url}`,
      headers: { authorization: `Bearer ${tokens.get(actor)}` },
    });
  const bbox = '2,48,3,49';
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
  });
  it('requires authentication and validates spatial and temporal bounds', async () => {
    expect(
      (await app.inject({ method: 'GET', url: `/api/v1/prospects/map?bbox=${bbox}` })).statusCode,
    ).toBe(401);
    for (const url of [
      '/prospects/map',
      '/prospects/map?bbox=0,0,181,1',
      '/prospects/map?bbox=0,1,1,0',
      '/prospects/map?bbox=0,,1,2',
      `/prospects/map?bbox=${bbox}&zoom=99`,
      '/prospects/nearby?latitude=91&longitude=0',
      `/map/heatmap?bbox=${bbox}&from=2020-01-01&to=2026-01-01`,
    ])
      expect((await call(url)).statusCode, url).toBe(400);
  });
  it('deduplicates establishments and hides unowned or unscoped campaign memberships', async () => {
    const all = await call(`/prospects/map?bbox=${bbox}&zoom=0`);
    expect(all.statusCode, all.body).toBe(200);
    expect(all.json().summary).toMatchObject({
      prospects: 2,
      campaignMemberships: 3,
      byLifecycleStage: { to_contact: 2, converted: 1 },
    });
    expect(all.json().features).toHaveLength(1);
    expect(all.json().features[0].properties).toMatchObject({ cluster: true, count: 2 });
    const own = await call(`/prospects/map?bbox=${bbox}&zoom=20`, member);
    expect(own.json().summary).toMatchObject({ prospects: 1, campaignMemberships: 1 });
    expect(own.json().features[0].properties.establishmentId).toBe(places[0]);
    expect(own.body).not.toContain(places[1]);
    expect((await call(`/prospects/map?bbox=${bbox}`, outsider)).json().features).toEqual([]);
    expect(
      (await call(`/prospects/map?bbox=${bbox}&campaignId=${foreignCampaign}`)).json().features,
    ).toEqual([]);
  });
  it('does not turn metadata-only campaign grants into prospect map access', async () => {
    await db.insert(membershipResourceScopes).values({
      tenantId: tenant,
      userId: outsider,
      role: 'observer',
      scopeType: 'campaign',
      campaignId: campaign,
      accessLevel: 'read',
    });
    expect((await call(`/campaigns/${campaign}`, outsider)).statusCode).toBe(200);
    expect((await call(`/prospects/map?bbox=${bbox}`, outsider)).json().features).toEqual([]);
  });
  it('supports dateline-crossing viewports and excludes records without coordinates', async () => {
    const result = await call('/prospects/map?bbox=179,-1,-179,1');
    expect(result.statusCode, result.body).toBe(200);
    expect(result.json().summary.prospects).toBe(1);
    expect(result.json().features[0].properties.establishmentId).toBe(places[3]);
  });
  it('filters lifecycle, campaign, territory and literal search without widening scope', async () => {
    expect(
      (await call(`/prospects/map?bbox=${bbox}&lifecycleStage=converted`)).json().summary.prospects,
    ).toBe(1);
    expect(
      (await call(`/prospects/map?bbox=${bbox}&campaignId=${duplicateCampaign}`)).json().summary
        .campaignMemberships,
    ).toBe(1);
    expect((await call(`/prospects/map?bbox=${bbox}&search=%25`)).json().summary.prospects).toBe(0);
    expect(
      (await call(`/prospects/map?bbox=${bbox}&territoryId=${territory}`)).json().summary.prospects,
    ).toBe(2);
    expect(
      (await call(`/prospects/map?bbox=${bbox}&territoryId=${territory}`, member)).json().summary
        .prospects,
    ).toBe(0);
  });
  it('orders nearby results by meters, deduplicates, and validates scoped cursors', async () => {
    const first = await call(
      '/prospects/nearby?latitude=48.85&longitude=2.35&radiusMeters=1000&limit=1',
    );
    expect(first.statusCode, first.body).toBe(200);
    expect(first.json().items[0]).toMatchObject({ id: places[0], distanceMeters: 0 });
    const next = await call(
      `/prospects/nearby?latitude=48.85&longitude=2.35&radiusMeters=1000&limit=1&cursor=${first.json().nextCursor}`,
    );
    expect(next.json().items[0].id).toBe(places[1]);
    expect(next.json().items[0].distanceMeters).toBeGreaterThan(0);
    expect(next.json().nextCursor).toBeNull();
    expect(
      (await call(`/prospects/nearby?latitude=48.85&longitude=2.35&cursor=${places[1]}`, member))
        .statusCode,
    ).toBe(400);
    expect(
      (await call('/prospects/nearby?latitude=48.85&longitude=2.35&radiusMeters=1')).json().items,
    ).toHaveLength(1);
  });
  it('aggregates heatmap activity and conversion without revealing another owner', async () => {
    const all = await call(`/map/heatmap?bbox=${bbox}&zoom=0`);
    expect(all.statusCode, all.body).toBe(200);
    expect(all.json().features[0].properties).toMatchObject({
      prospects: 2,
      completedActions: 1,
      convertedProspects: 1,
      weight: 1,
    });
    const own = await call(`/map/heatmap?bbox=${bbox}&zoom=0&metric=conversion`, member);
    expect(own.json().features[0].properties).toMatchObject({
      prospects: 1,
      completedActions: 1,
      convertedProspects: 0,
      weight: 0,
    });
    const old = await call(`/map/heatmap?bbox=${bbox}&zoom=0&from=2020-01-01&to=2020-02-01`);
    expect(old.json().features[0].properties.completedActions).toBe(0);
  });
  it('counts boundary points in coverage and intersects territory and prospect authorization', async () => {
    const result = await call(`/map/coverage?bbox=${bbox}`);
    expect(result.statusCode, result.body).toBe(200);
    expect(result.json().features[0].properties).toMatchObject({
      prospects: 2,
      assignedProspects: 2,
      contactedProspects: 1,
      convertedProspects: 1,
      coveragePercent: 50,
    });
    expect((await call(`/map/coverage?bbox=${bbox}`, member)).json().features).toEqual([]);
    await db.insert(membershipResourceScopes).values({
      tenantId: tenant,
      userId: member,
      role: 'prospector',
      scopeType: 'territory',
      territoryId: territory,
      accessLevel: 'read',
    });
    const own = await call(`/map/coverage?bbox=${bbox}`, member);
    expect(own.json().features[0].properties).toMatchObject({
      prospects: 1,
      contactedProspects: 1,
      coveragePercent: 100,
    });
  });
  it('rejects oversized visible scopes while applying ownership before the size limit', async () => {
    const largeCampaign = randomUUID(),
      tag = `large-${randomUUID()}`;
    await db.insert(campaigns).values({
      id: largeCampaign,
      tenantId: tenant,
      organizationId: org,
      name: tag,
      status: 'active',
    });
    try {
      await db.execute(sql`WITH added AS (INSERT INTO establishments(tenant_id,name,normalized_name,country_code,longitude,latitude) SELECT ${tenant}::uuid,${tag}||n,${tag}||n,'FR',2.35,48.85 FROM generate_series(1,20001) n RETURNING id)
        INSERT INTO campaign_prospects(tenant_id,campaign_id,establishment_id) SELECT ${tenant}::uuid,${largeCampaign}::uuid,id FROM added`);
      const response = await call(`/prospects/map?bbox=${bbox}`);
      expect(response.statusCode, response.body).toBe(413);
      expect(response.json().code ?? response.json().error?.code).toBeDefined();
      const own = await call(`/prospects/map?bbox=${bbox}`, member);
      expect(own.statusCode, own.body).toBe(200);
      expect(own.json().summary.prospects).toBe(1);
    } finally {
      await db.delete(campaignProspects).where(eq(campaignProspects.campaignId, largeCampaign));
      await db.execute(
        sql`DELETE FROM establishments WHERE tenant_id=${tenant} AND name LIKE ${tag + '%'}`,
      );
      await db.delete(campaigns).where(eq(campaigns.id, largeCampaign));
    }
  }, 30000);
  it('enforces configurable restrictions and explicit denial on map aliases', async () => {
    await db
      .insert(tenantRolePermissions)
      .values({ tenantId: tenant, role: 'prospector', permissions: [] });
    for (const url of [
      `/prospects/map?bbox=${bbox}`,
      `/map/coverage?bbox=${bbox}`,
      `/map/heatmap?bbox=${bbox}`,
    ])
      expect((await call(url, member)).statusCode).toBe(403);
    await db.delete(tenantRolePermissions).where(eq(tenantRolePermissions.tenantId, tenant));
    await db.insert(membershipScopeDenials).values({
      tenantId: tenant,
      userId: member,
      scopeType: 'team',
      resourceId: team,
      reason: 'Map restriction',
    });
    expect((await call(`/map/heatmap?bbox=${bbox}`, member)).statusCode).toBe(403);
  });
});
