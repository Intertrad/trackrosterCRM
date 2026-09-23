import { ResourceScopeService } from '../src/resource-scopes/resource-scope.service.js';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { eq, inArray, sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureHttpApplication } from '../src/config/http-application.js';
import { DATABASE } from '../src/database/database.constants.js';
import type { Database } from '../src/database/database.types.js';
import {
  auditEvents,
  authSessions,
  campaigns,
  campaignTerritories,
  identities,
  idempotencyRecords,
  membershipResourceScopes,
  organizations,
  teams,
  tenantMemberships,
  tenants,
  territories,
  userAccessGrants,
} from '../src/database/schema/index.js';
import { PasswordService } from '../src/auth/password.service.js';

describe('Territory and campaign resource scopes', () => {
  let app: NestFastifyApplication, db: Database;
  const tenantId = randomUUID(),
    foreignTenantId = randomUUID();
  const admin = randomUUID(),
    reader = randomUUID(),
    manager = randomUUID(),
    foreign = randomUUID();
  const members = [admin, reader, manager, foreign];
  const org = randomUUID(),
    otherOrg = randomUUID(),
    foreignOrg = randomUUID(),
    team = randomUUID();
  const campaign = randomUUID(),
    otherCampaign = randomUUID(),
    foreignCampaign = randomUUID();
  let territory: string, hiddenTerritory: string, foreignTerritory: string;
  const tokens = new Map<string, string>();
  const polygon = {
    type: 'Polygon',
    coordinates: [
      [
        [2, 48],
        [3, 48],
        [3, 49],
        [2, 49],
        [2, 48],
      ],
    ],
  };
  const call = (
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body?: object,
    actor = admin,
    key: string = randomUUID(),
    headers: Record<string, string> = {},
  ) =>
    app.inject({
      method,
      url: `/api/v1${path}`,
      payload: body,
      headers: { authorization: `Bearer ${tokens.get(actor)}`, 'idempotency-key': key, ...headers },
    });
  const grant = async (
    member: string,
    kind: 'territory' | 'campaign',
    id: string,
    level = 'read',
    role = 'manager',
  ) => {
    const response = await call('POST', `/memberships/${member}/scopes`, {
      role,
      scopeType: kind,
      [`${kind}Id`]: id,
      accessLevel: level,
    });
    expect(response.statusCode, response.body).toBe(201);
    return response.json() as { id: string };
  };
  beforeAll(async () => {
    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
      logger: false,
      abortOnError: false,
    });
    await configureHttpApplication(app);
    await app.init();
    db = app.get(DATABASE);
    await db
      .insert(tenants)
      .values([tenantId, foreignTenantId].map((id) => ({ id, name: id, slug: id })));
    await db.insert(organizations).values([
      { id: org, tenantId, name: org, slug: org },
      { id: otherOrg, tenantId, name: otherOrg, slug: otherOrg },
      { id: foreignOrg, tenantId: foreignTenantId, name: foreignOrg, slug: foreignOrg },
    ]);
    await db
      .insert(teams)
      .values({ id: team, tenantId, organizationId: org, name: team, slug: team });
    const password = 'ResourceScopes123!';
    const passwordHash = await app.get(PasswordService).hash(password);
    await db
      .insert(identities)
      .values(members.map((id) => ({ id, email: `${id}@example.test`, passwordHash })));
    await db.insert(tenantMemberships).values(
      members.map((id) => ({
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
      ...[reader, manager].map((userId) => ({
        tenantId,
        userId,
        role: 'prospector' as const,
        scopeType: 'team' as const,
        organizationId: org,
        teamId: team,
      })),
    ]);
    await db.insert(campaigns).values(
      [campaign, otherCampaign, foreignCampaign].map((id) => ({
        id,
        tenantId: id === foreignCampaign ? foreignTenantId : tenantId,
        organizationId: id === foreignCampaign ? foreignOrg : id === otherCampaign ? otherOrg : org,
        name: id,
        status: 'active' as const,
      })),
    );
    for (const id of members) {
      const result = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: `${id}@example.test`, password },
      });
      expect(result.statusCode).toBe(200);
      tokens.set(id, result.json().accessToken);
    }
    const result = await call('POST', '/territories', {
      name: 'North',
      code: 'NORTH',
      boundary: polygon,
    });
    expect(result.statusCode, result.body).toBe(201);
    territory = result.json().id;
    hiddenTerritory = (await call('POST', '/territories', { name: 'South' })).json().id;
    foreignTerritory = (await call('POST', '/territories', { name: 'Foreign' }, foreign)).json().id;
  });
  afterEach(async () => {
    if (db)
      await db
        .delete(membershipResourceScopes)
        .where(eq(membershipResourceScopes.tenantId, tenantId));
  });
  afterAll(async () => {
    if (db) {
      const ids = [tenantId, foreignTenantId];
      await db.delete(idempotencyRecords).where(inArray(idempotencyRecords.tenantId, ids));
      await db.delete(auditEvents).where(inArray(auditEvents.tenantId, ids));
      await db
        .delete(membershipResourceScopes)
        .where(inArray(membershipResourceScopes.tenantId, ids));
      await db.delete(campaignTerritories).where(inArray(campaignTerritories.tenantId, ids));
      await db
        .update(territories)
        .set({ parentId: null })
        .where(inArray(territories.tenantId, ids));
      await db.delete(territories).where(inArray(territories.tenantId, ids));
      await db.delete(campaigns).where(inArray(campaigns.tenantId, ids));
      await db.delete(authSessions).where(inArray(authSessions.tenantId, ids));
      await db.delete(userAccessGrants).where(inArray(userAccessGrants.tenantId, ids));
      await db.delete(tenantMemberships).where(inArray(tenantMemberships.tenantId, ids));
      await db.delete(identities).where(inArray(identities.id, members));
      await db.delete(teams).where(eq(teams.tenantId, tenantId));
      await db.delete(organizations).where(inArray(organizations.tenantId, ids));
      await db.delete(tenants).where(inArray(tenants.id, ids));
    }
    await app?.close();
  });
  it('creates PostGIS geometry and returns scoped GeoJSON without revealing hidden territories', async () => {
    expect((await call('GET', '/territories', undefined, reader)).json()).toEqual([]);
    await grant(reader, 'territory', territory, 'read', 'auditor');
    const detail = await call('GET', `/territories/${territory}`, undefined, reader);
    expect(detail.statusCode).toBe(200);
    expect(detail.json().boundary.type).toBe('MultiPolygon');
    expect(detail.json().center.type).toBe('Point');
    const map = (await call('GET', '/territories/map', undefined, reader)).json();
    expect(map.features.map((f: { id: string }) => f.id)).toEqual([territory]);
    for (const id of [hiddenTerritory, foreignTerritory])
      expect((await call('GET', `/territories/${id}`, undefined, reader)).statusCode).toBe(404);
    expect(
      (await call('PATCH', `/territories/${territory}`, { name: 'Denied' }, reader)).statusCode,
    ).toBe(404);
    expect((await call('POST', '/territories', { name: 'Denied' }, reader)).statusCode).toBe(403);
  });
  it('filters and paginates campaigns without accepting hidden cursors', async () => {
    const first = await call('GET', '/campaigns?limit=1&sort=name');
    expect(first.statusCode, first.body).toBe(200);
    expect(first.json().items).toHaveLength(1);
    const second = await call(
      'GET',
      `/campaigns?limit=1&sort=name&cursor=${first.json().nextCursor}`,
    );
    expect(second.statusCode, second.body).toBe(200);
    expect(second.json().items[0].id).not.toBe(first.json().items[0].id);
    expect((await call('GET', `/campaigns?organizationId=${foreignOrg}`)).json().items).toEqual([]);
    expect((await call('GET', `/campaigns?cursor=${foreignCampaign}`)).statusCode).toBe(400);
    expect(
      (
        await call(
          'GET',
          '/campaigns?startsAfter=2026-12-01T00:00:00Z&startsBefore=2026-01-01T00:00:00Z',
        )
      ).statusCode,
    ).toBe(400);
    const filtered = await call('GET', `/campaigns?organizationId=${org}`);
    expect(filtered.json().items.map((row: { id: string }) => row.id)).toEqual([campaign]);
    const detail = await call('GET', `/campaigns/${campaign}`);
    expect(detail.json().summary).toMatchObject({
      prospects: 0,
      activeAssignments: 0,
      scope: 'visible_prospects',
    });
  });
  it('applies explicit territory deny before positive grants and retains disjoint detail access', async () => {
    await grant(reader, 'territory', territory, 'read', 'auditor');
    await grant(reader, 'territory', hiddenTerritory, 'read', 'auditor');
    const denied = await call('POST', `/memberships/${reader}/scopes`, {
      effect: 'deny',
      scopeType: 'territory',
      territoryId: territory,
      reason: 'Territory restriction',
    });
    expect(denied.statusCode, denied.body).toBe(201);
    expect((await call('GET', `/territories/${territory}`, undefined, reader)).statusCode).toBe(
      403,
    );
    expect(
      (await call('GET', `/territories/${hiddenTerritory}`, undefined, reader)).statusCode,
    ).toBe(200);
    expect((await call('GET', '/territories/map', undefined, reader)).statusCode).toBe(403);
    expect((await call('DELETE', `/membership-scopes/${denied.json().id}`)).statusCode).toBe(204);
  });
  it('restricts campaign list/detail to explicit grants and never grants organization or assignment authority', async () => {
    await grant(reader, 'campaign', campaign, 'read', 'prospector');
    expect(
      (await call('GET', '/campaigns', undefined, reader)).json().map((r: { id: string }) => r.id),
    ).toEqual([campaign]);
    expect((await call('GET', `/campaigns/${campaign}`, undefined, reader)).statusCode).toBe(200);
    expect((await call('GET', `/campaigns/${otherCampaign}`, undefined, reader)).statusCode).toBe(
      404,
    );
    expect(
      (await call('PATCH', `/campaigns/${campaign}`, { name: 'Denied' }, reader)).statusCode,
    ).toBe(404);
    await grant(manager, 'campaign', campaign, 'manage');
    expect(
      (
        await call(
          'POST',
          `/campaigns/${campaign}/prospects/${randomUUID()}/assignment`,
          { teamId: team, assignedUserId: reader },
          manager,
        )
      ).statusCode,
    ).toBe(403);
    await grant(manager, 'campaign', otherCampaign, 'manage');
    expect((await call('GET', `/organizations/${otherOrg}`, undefined, manager)).statusCode).toBe(
      404,
    );
  });
  it('supports edit/manage levels and blocks replay after grant revocation', async () => {
    const scope = await grant(manager, 'campaign', campaign, 'read_write');
    const key = randomUUID();
    expect(
      (await call('PATCH', `/campaigns/${campaign}`, { name: 'Scoped edit' }, manager, key))
        .statusCode,
    ).toBe(200);
    expect(
      (await call('PATCH', `/campaigns/${campaign}`, { status: 'paused' }, manager)).statusCode,
    ).toBe(404);
    const replay = await call(
      'PATCH',
      `/campaigns/${campaign}`,
      { name: 'Scoped edit' },
      manager,
      key,
    );
    expect(replay.statusCode).toBe(200);
    expect(replay.headers['idempotency-replayed']).toBe('true');
    expect(
      (await call('PATCH', `/campaigns/${campaign}`, { name: 'Bad key' }, manager, '')).statusCode,
    ).toBe(400);
    expect((await call('DELETE', `/membership-scopes/${scope.id}`)).statusCode).toBe(204);
    expect(
      (await call('PATCH', `/campaigns/${campaign}`, { name: 'Scoped edit' }, manager, key))
        .statusCode,
    ).toBe(404);
    expect((await call('GET', `/campaigns/${campaign}`, undefined, manager)).statusCode).toBe(404);
  });
  it('rechecks campaign authority when a grant is revoked after the HTTP guard', async () => {
    const scope = await grant(manager, 'campaign', campaign, 'read_write');
    const service = app.get(ResourceScopeService);
    const original = service.require.bind(service);
    let guardPassed!: () => void;
    const checked = new Promise<void>((resolve) => {
      guardPassed = resolve;
    });
    const spy = vi.spyOn(service, 'require').mockImplementationOnce(async (...args) => {
      await original(...args);
      guardPassed();
    });
    let pending: ReturnType<typeof call> | undefined;
    try {
      await db.transaction(async (tx) => {
        await tx
          .select({ id: tenants.id })
          .from(tenants)
          .where(eq(tenants.id, tenantId))
          .for('update');
        pending = call('PATCH', `/campaigns/${campaign}`, { name: 'Must not persist' }, manager);
        // Start injection while the revoking transaction holds the tenant lock.
        void pending.then(() => undefined);
        await checked;
        await tx.delete(membershipResourceScopes).where(eq(membershipResourceScopes.id, scope.id));
      });
      expect((await pending!).statusCode).toBe(404);
      const [row] = await db.select().from(campaigns).where(eq(campaigns.id, campaign));
      expect(row!.name).not.toBe('Must not persist');
    } finally {
      spy.mockRestore();
    }
  });
  it('validates role/shape, tenant boundaries and duplicate grants at API and database layers', async () => {
    const base = { role: 'manager', scopeType: 'campaign', campaignId: campaign };
    for (const body of [
      { ...base, territoryId: territory },
      { ...base, organizationId: org },
      { ...base, role: 'tenant_admin' },
      { ...base, role: 'auditor', accessLevel: 'manage' },
    ])
      expect((await call('POST', `/memberships/${reader}/scopes`, body)).statusCode).toBe(400);
    expect(
      (
        await call('POST', `/memberships/${reader}/scopes`, {
          ...base,
          campaignId: foreignCampaign,
        })
      ).statusCode,
    ).toBe(404);
    expect((await call('POST', `/memberships/${foreign}/scopes`, base)).statusCode).toBe(404);
    await grant(reader, 'campaign', campaign);
    expect((await call('POST', `/memberships/${reader}/scopes`, base)).statusCode).toBe(409);
    await expect(
      db.insert(membershipResourceScopes).values({
        tenantId,
        userId: reader,
        role: 'observer',
        scopeType: 'territory',
        territoryId: foreignTerritory,
      }),
    ).rejects.toMatchObject({ cause: { code: '23503' } });
    await expect(
      db
        .insert(campaignTerritories)
        .values({ tenantId, campaignId: campaign, territoryId: foreignTerritory }),
    ).rejects.toMatchObject({ cause: { code: '23503' } });
  });
  it('updates resource scopes with ETags, filters memberships and preserves access history', async () => {
    const scope = await grant(reader, 'campaign', campaign, 'read', 'auditor');
    const scopes = (await call('GET', `/memberships/${reader}/scopes`)).json();
    const original = scopes.find((s: { id: string }) => s.id === scope.id);
    const replacement = {
      role: 'auditor',
      scopeType: 'territory',
      territoryId: territory,
      accessLevel: 'read',
    };
    expect(
      (
        await call('PATCH', `/membership-scopes/${scope.id}`, replacement, admin, randomUUID(), {
          'if-match': original.etag,
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await call('PATCH', `/membership-scopes/${scope.id}`, replacement, admin, randomUUID(), {
          'if-match': original.etag,
        })
      ).statusCode,
    ).toBe(412);
    const filtered = (
      await call('GET', `/memberships?territoryId=${territory}&role=auditor`)
    ).json();
    expect(filtered.items.map((r: { id: string }) => r.id)).toEqual([reader]);
    expect(filtered.items[0].roles).toContain('auditor');
    expect(
      (await call('GET', '/memberships?role=auditor'))
        .json()
        .items.map((r: { id: string }) => r.id),
    ).toContain(reader);
    const effective = (await call('GET', '/me/permissions', undefined, reader)).json();
    expect(JSON.stringify(effective)).toContain(territory);
    expect((await call('GET', '/me', undefined, reader)).json().grants).toContainEqual({
      role: 'auditor',
      scopeType: 'territory',
      territoryId: territory,
      campaignId: null,
      accessLevel: 'read',
    });
    expect((await call('GET', '/me/memberships', undefined, reader)).json()[0].roles).toContain(
      'auditor',
    );
    expect((await call('DELETE', `/membership-scopes/${scope.id}`)).statusCode).toBe(204);
    const history = (await call('GET', `/memberships/${reader}/access-history?limit=100`)).json();
    expect(
      history.items.some(
        (e: { action: string; metadata: { before?: { id?: string } } }) =>
          e.action === 'membership.scope_removed' && e.metadata.before?.id === scope.id,
      ),
    ).toBe(true);
  });
  it('checks both sides of campaign links and removes access immediately after unlink/revocation', async () => {
    await grant(manager, 'campaign', campaign, 'manage');
    expect(
      (
        await call(
          'POST',
          `/campaigns/${campaign}/territories`,
          { territoryId: territory },
          manager,
        )
      ).statusCode,
    ).toBe(404);
    await grant(manager, 'territory', territory);
    expect(
      (
        await call(
          'POST',
          `/campaigns/${campaign}/territories`,
          { territoryId: territory },
          manager,
        )
      ).statusCode,
    ).toBe(201);
    expect(
      (
        await call(
          'POST',
          `/campaigns/${campaign}/territories`,
          { territoryId: territory },
          manager,
        )
      ).statusCode,
    ).toBe(409);
    await grant(reader, 'campaign', campaign, 'read', 'auditor');
    expect(
      (await call('GET', `/campaigns/${campaign}/territories`, undefined, reader)).json(),
    ).toEqual([]);
    await grant(reader, 'territory', territory, 'read', 'auditor');
    expect(
      (await call('GET', `/campaigns/${campaign}/territories`, undefined, reader)).json(),
    ).toHaveLength(1);
    expect((await call('DELETE', `/territories/${territory}`)).statusCode).toBe(409);
    expect(
      (await call('DELETE', `/campaigns/${campaign}/territories/${territory}`, undefined, manager))
        .statusCode,
    ).toBe(204);
    expect(
      (await call('GET', `/campaigns/${campaign}/territories`, undefined, reader)).json(),
    ).toEqual([]);
  });
  it('checks territory authority before replaying a cached campaign-link response', async () => {
    await grant(manager, 'campaign', campaign, 'manage');
    const scope = await grant(manager, 'territory', hiddenTerritory);
    const key = randomUUID();
    const path = `/campaigns/${campaign}/territories`;
    expect(
      (await call('POST', path, { territoryId: hiddenTerritory }, manager, key)).statusCode,
    ).toBe(201);
    expect(
      (await call('POST', path, { territoryId: hiddenTerritory }, manager, key)).headers[
        'idempotency-replayed'
      ],
    ).toBe('true');
    expect((await call('DELETE', `/membership-scopes/${scope.id}`)).statusCode).toBe(204);
    expect(
      (await call('POST', path, { territoryId: hiddenTerritory }, manager, key)).statusCode,
    ).toBe(404);
    expect((await call('DELETE', `${path}/${hiddenTerritory}`)).statusCode).toBe(204);
  });
  it('rejects invalid geometry, cycles and cross-tenant parentage, including concurrent cycles', async () => {
    expect(
      (
        await call('POST', '/territories', {
          name: 'Malformed',
          boundary: { type: 'Polygon', coordinates: 'bad' },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await call('POST', '/territories', {
          name: 'Invalid',
          boundary: { type: 'Point', coordinates: [1, 2] },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await call('POST', '/territories', {
          name: 'Invalid',
          boundary: {
            type: 'Polygon',
            coordinates: [
              [
                [200, 48],
                [201, 48],
                [201, 49],
                [200, 48],
              ],
            ],
          },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (await call('POST', '/territories', { name: 'Foreign child', parentId: foreignTerritory }))
        .statusCode,
    ).toBe(404);
    const a = (await call('POST', '/territories', { name: 'A' })).json().id;
    const b = (await call('POST', '/territories', { name: 'B' })).json().id;
    const results = await Promise.all([
      call('PATCH', `/territories/${a}`, { parentId: b }),
      call('PATCH', `/territories/${b}`, { parentId: a }),
    ]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    const parent = results[0]!.statusCode === 200 ? b : a;
    expect((await call('DELETE', `/territories/${parent}`)).statusCode).toBe(409);
  });
  it('enforces metadata versus manage authority and deactivation on territories', async () => {
    const id = (await call('POST', '/territories', { name: 'Disposable' })).json().id;
    const scope = await grant(manager, 'territory', id, 'read_write');
    const old = await call('GET', `/territories/${id}`, undefined, manager);
    expect(
      (
        await call('PATCH', `/territories/${id}`, { name: 'Edited' }, manager, randomUUID(), {
          'if-match': String(old.headers.etag),
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await call('PATCH', `/territories/${id}`, { name: 'Stale' }, manager, randomUUID(), {
          'if-match': String(old.headers.etag),
        })
      ).statusCode,
    ).toBe(412);
    expect(
      (await call('PATCH', `/territories/${id}`, { status: 'inactive' }, manager)).statusCode,
    ).toBe(404);
    expect(
      (
        await call('PATCH', `/membership-scopes/${scope.id}`, {
          role: 'manager',
          scopeType: 'territory',
          territoryId: id,
          accessLevel: 'manage',
        })
      ).statusCode,
    ).toBe(200);
    expect((await call('DELETE', `/territories/${id}`, undefined, manager)).statusCode).toBe(204);
    expect((await call('GET', `/territories/${id}`, undefined, manager)).statusCode).toBe(404);
    expect(
      (
        await call('POST', `/memberships/${reader}/scopes`, {
          role: 'auditor',
          scopeType: 'territory',
          territoryId: id,
        })
      ).statusCode,
    ).toBe(404);
  });
});
