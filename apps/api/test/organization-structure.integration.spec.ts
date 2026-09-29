import { StructureService } from '../src/organization-structure/structure.service.js';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { eq, inArray, sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureHttpApplication } from '../src/config/http-application.js';
import { getSeedDatabase } from './support/seed.js';
import type { Database } from '../src/database/database.types.js';
import {
  auditEvents,
  authSessions,
  campaigns,
  campaignTerritories,
  campaignMembers,
  teamMemberships,
  organizationRelationships,
  tenantRolePermissions,
  territoryAssignments,
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

describe('Organization relationships and historical team rosters', () => {
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
  let territory: string;
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
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT',
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
      ...[manager].map((userId) => ({
        tenantId,
        userId,
        role: 'manager' as const,
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
  });
  afterEach(async () => {
    if (db) {
      await db.delete(teamMemberships).where(eq(teamMemberships.tenantId, tenantId));
      await db
        .delete(organizationRelationships)
        .where(eq(organizationRelationships.tenantId, tenantId));
      await db.delete(tenantRolePermissions).where(eq(tenantRolePermissions.tenantId, tenantId));
      await db.delete(campaignMembers).where(eq(campaignMembers.tenantId, tenantId));
      await db.delete(territoryAssignments).where(eq(territoryAssignments.tenantId, tenantId));
    }
  });
  afterAll(async () => {
    if (db) {
      const ids = [tenantId, foreignTenantId];
      await db.delete(teamMemberships).where(inArray(teamMemberships.tenantId, ids));
      await db
        .delete(organizationRelationships)
        .where(inArray(organizationRelationships.tenantId, ids));
      await db.delete(campaignMembers).where(inArray(campaignMembers.tenantId, ids));
      await db.delete(territoryAssignments).where(inArray(territoryAssignments.tenantId, ids));
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
  const iso = (hours: number) => new Date(Date.now() + hours * 3600000).toISOString();
  const relation = (parent: string, child: string, relationshipType = 'parent', actor = admin) =>
    call(
      'POST',
      '/organization-relationships',
      { parentOrganizationId: parent, childOrganizationId: child, relationshipType },
      actor,
    );
  const join = (body: object = {}, actor = admin, key: string = randomUUID()) =>
    call('POST', `/teams/${team}/members`, { membershipId: reader, ...body }, actor, key);
  const newOrg = async () => {
    const id = randomUUID();
    await db.insert(organizations).values({ id, tenantId, name: id, slug: id });
    return id;
  };
  const newTeam = async () => {
    const id = randomUUID();
    await db.insert(teams).values({ id, tenantId, organizationId: org, name: id, slug: id });
    return id;
  };
  it('creates tenant-safe relationships and hides edges unless both organizations are visible', async () => {
    const created = await relation(org, otherOrg);
    expect(created.statusCode, created.body).toBe(201);
    expect((await relation(org, org)).statusCode).toBe(400);
    expect((await relation(org, foreignOrg)).statusCode).toBe(404);
    expect((await relation(org, otherOrg, 'coordination', manager)).statusCode).toBe(403);
    expect(
      (await call('GET', '/organization-relationships', undefined, manager)).json().items,
    ).toEqual([]);
    expect((await call('GET', `/organizations/${otherOrg}`, undefined, manager)).statusCode).toBe(
      404,
    );
    const [grant] = await db
      .insert(userAccessGrants)
      .values({
        tenantId,
        userId: manager,
        role: 'observer',
        scopeType: 'organization',
        organizationId: otherOrg,
      })
      .returning();
    try {
      expect(
        (
          await call(
            'GET',
            `/organization-relationships?organizationId=${org}&relationshipType=parent`,
            undefined,
            manager,
          )
        ).json().items[0].id,
      ).toBe(created.json().id);
    } finally {
      await db.delete(userAccessGrants).where(eq(userAccessGrants.id, grant!.id));
    }
    await expect(
      db.insert(organizationRelationships).values({
        tenantId,
        parentOrganizationId: org,
        childOrganizationId: foreignOrg,
        relationshipType: 'parent',
      }),
    ).rejects.toMatchObject({ cause: { code: '23503' } });
  });
  it('prevents parent/brand cycles and concurrent cycles, and enforces one active parent per type', async () => {
    const a = await newOrg(),
      b = await newOrg(),
      c = await newOrg();
    expect((await relation(a, b)).statusCode).toBe(201);
    expect((await relation(b, c, 'brand')).statusCode).toBe(201);
    expect((await relation(c, a)).statusCode).toBe(409);
    expect((await relation(c, b)).statusCode).toBe(409);
    const d = await newOrg(),
      e = await newOrg();
    const result = await Promise.all([relation(d, e), relation(e, d, 'brand')]);
    expect(result.map((r) => r.statusCode).sort()).toEqual([201, 409]);
  });
  it('normalizes undirected edges, retains ended history and applies ETags', async () => {
    const first = await relation(org, otherOrg, 'partner');
    expect(first.statusCode).toBe(201);
    expect((await relation(otherOrg.toUpperCase(), org.toUpperCase(), 'partner')).statusCode).toBe(
      409,
    );
    expect((await relation(otherOrg, org, 'coordination')).statusCode).toBe(201);
    const path = `/organization-relationships/${first.json().id}`;
    expect(
      (await call('DELETE', path, undefined, admin, randomUUID(), { 'if-match': '"stale"' }))
        .statusCode,
    ).toBe(412);
    expect(
      (
        await call('DELETE', path, undefined, admin, randomUUID(), {
          'if-match': String(first.headers.etag),
        })
      ).statusCode,
    ).toBe(204);
    const again = await relation(org, otherOrg, 'partner');
    expect(again.statusCode).toBe(201);
    expect(again.json().id).not.toBe(first.json().id);
    const ended = (await call('GET', '/organization-relationships?state=ended')).json().items;
    expect(ended).toHaveLength(1);
    expect(ended[0].id).toBe(first.json().id);
    const page = (await call('GET', '/organization-relationships?state=all&limit=1')).json();
    expect(page.nextCursor).not.toBeNull();
    expect(
      (
        await call('GET', `/organization-relationships?state=all&limit=1&cursor=${page.nextCursor}`)
      ).json().items[0].id,
    ).not.toBe(page.items[0].id);
    const audit = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.resourceId, first.json().id));
    expect(audit.map((e) => e.action).sort()).toEqual([
      'organization_relationship.created',
      'organization_relationship.ended',
    ]);
  });
  it('protects organization deactivation, including racing relationship creation', async () => {
    const a = await newOrg(),
      b = await newOrg();
    const linked = await relation(a, b);
    expect((await call('DELETE', `/organizations/${a}`)).statusCode).toBe(409);
    expect(
      (await call('DELETE', `/organization-relationships/${linked.json().id}`)).statusCode,
    ).toBe(204);
    expect((await call('DELETE', `/organizations/${a}`)).statusCode).toBe(200);
    const c = await newOrg(),
      d = await newOrg();
    const race = await Promise.all([relation(c, d), call('DELETE', `/organizations/${d}`)]);
    expect(race.filter((r) => r.statusCode === 409)).toHaveLength(1);
    const [row] = await db.select().from(organizations).where(eq(organizations.id, d));
    expect(row!.status).toBe(race[0]!.statusCode === 201 ? 'active' : 'inactive');
  });
  it('adds roster-derived read access without creating manager or prospector grants', async () => {
    expect((await call('GET', `/teams/${team}`, undefined, reader)).statusCode).toBe(404);
    const created = await join({}, manager);
    expect(created.statusCode, created.body).toBe(201);
    expect((await call('GET', `/teams/${team}`, undefined, reader)).statusCode).toBe(200);
    expect(
      (await call('GET', '/teams', undefined, reader))
        .json()
        .items.map((t: { id: string }) => t.id),
    ).toEqual([team]);
    expect((await call('GET', `/organizations/${org}`, undefined, reader)).statusCode).toBe(404);
    expect(
      (await call('PATCH', `/teams/${team}`, { name: 'Unauthorized' }, reader)).statusCode,
    ).toBe(403);
    expect((await call('GET', '/me/permissions', undefined, reader)).json()).toContainEqual(
      expect.objectContaining({
        source: 'team_membership',
        role: null,
        teamId: team,
        permissions: ['scope.read'],
      }),
    );
    expect(
      await db.select().from(userAccessGrants).where(eq(userAccessGrants.userId, reader)),
    ).toHaveLength(0);
  });
  it('preserves historical roles by splitting active periods and records membership access history', async () => {
    const first = await join({ startsAt: iso(-1) });
    expect(first.statusCode).toBe(201);
    const path = `/teams/${team}/members/${reader}?periodId=${first.json().id}`;
    expect((await call('PATCH', path, { teamRole: 'manager' }, manager)).statusCode).toBe(403);
    const changed = await call('PATCH', path, { teamRole: 'manager' }, admin, randomUUID(), {
      'if-match': String(first.headers.etag),
    });
    expect(changed.statusCode, changed.body).toBe(200);
    expect(changed.json().id).not.toBe(first.json().id);
    const periods = (await call('GET', `/teams/${team}/members?membershipId=${reader}`)).json()
      .items;
    expect(periods).toHaveLength(2);
    const old = periods.find((p: { id: string }) => p.id === first.json().id);
    expect(old.state).toBe('ended');
    expect(old.teamRole).toBe('member');
    expect(old.endsAt).toBe(changed.json().startsAt);
    expect((await call('PATCH', path, { teamRole: 'member' })).statusCode).toBe(409);
    expect(
      (
        await call(
          'DELETE',
          `/teams/${team}/members/${reader}?periodId=${changed.json().id}`,
          undefined,
          manager,
        )
      ).statusCode,
    ).toBe(403);
    expect((await join({ membershipId: manager }, reader)).statusCode).toBe(403);
    const history = (await call('GET', `/memberships/${reader}/access-history?limit=100`)).json()
      .items;
    expect(
      history.some(
        (e: { action: string; metadata: { after?: { id: string } } }) =>
          e.action === 'membership.team_changed' && e.metadata.after?.id === changed.json().id,
      ),
    ).toBe(true);
  });
  it('supports dated rosters, per-period targeting, optimistic updates and terminal cancellation', async () => {
    const start = iso(1),
      middle = iso(2),
      end = iso(3);
    const first = await join({ startsAt: start, endsAt: middle });
    expect(first.statusCode).toBe(201);
    expect((await join({ startsAt: middle, endsAt: end })).statusCode).toBe(201);
    expect((await call('GET', `/teams/${team}`, undefined, reader)).statusCode).toBe(404);
    expect(
      (await call('PATCH', `/teams/${team}/members/${reader}`, { endsAt: iso(4) })).statusCode,
    ).toBe(409);
    const path = `/teams/${team}/members/${reader}?periodId=${first.json().id}`;
    const update = await call('PATCH', path, { startsAt: iso(-1) }, admin, randomUUID(), {
      'if-match': String(first.headers.etag),
    });
    expect(update.statusCode).toBe(200);
    expect(
      (
        await call('PATCH', path, { endsAt: middle }, admin, randomUUID(), {
          'if-match': String(first.headers.etag),
        })
      ).statusCode,
    ).toBe(412);
    expect((await call('GET', `/teams/${team}`, undefined, reader)).statusCode).toBe(200);
    expect((await call('PATCH', path, { startsAt: iso(-2) })).statusCode).toBe(400);
    expect((await call('DELETE', path)).statusCode).toBe(204);
    expect((await call('PATCH', path, { endsAt: end })).statusCode).toBe(409);
    const detail = await call('GET', `/memberships/${reader}`);
    expect(detail.statusCode).toBe(200);
    expect(detail.json().rosterHistory.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: first.json().id, effective: false })]),
    );

    expect((await call('GET', `/teams/${team}`, undefined, reader)).statusCode).toBe(404);
    expect((await call('GET', `/teams/${team}/members?state=revoked`)).json().items).toHaveLength(
      1,
    );
  });
  it('prevents overlapping roster periods concurrently and validates tenant-safe membership', async () => {
    const result = await Promise.all([join(), join()]);
    expect(result.map((r) => r.statusCode).sort()).toEqual([201, 409]);
    await expect(
      db.insert(teamMemberships).values({ tenantId, teamId: team, membershipId: reader }),
    ).rejects.toMatchObject({ cause: { code: '23P01' } });
    expect((await join({ membershipId: foreign })).statusCode).toBe(404);
    expect(
      (await join({ membershipId: manager, startsAt: iso(2), endsAt: iso(1) })).statusCode,
    ).toBe(400);
    expect(
      (await join({ membershipId: manager, startsAt: '2027-01-01T10:00:00' })).statusCode,
    ).toBe(400);
    await expect(
      db
        .insert(teamMemberships)
        .values({ tenantId: foreignTenantId, teamId: team, membershipId: foreign }),
    ).rejects.toMatchObject({ cause: { code: '23503' } });
  });
  it('derives team campaign/territory participation only while roster membership is active', async () => {
    expect(
      (await call('POST', `/campaigns/${campaign}/members`, { teamId: team })).statusCode,
    ).toBe(201);
    expect(
      (await call('POST', '/territory-assignments', { teamId: team, territoryId: territory }))
        .statusCode,
    ).toBe(201);
    const created = await join({});
    expect((await call('GET', `/campaigns/${campaign}`, undefined, reader)).statusCode).toBe(200);
    expect((await call('GET', `/territories/${territory}`, undefined, reader)).statusCode).toBe(
      200,
    );
    expect(
      (await call('DELETE', `/teams/${team}/members/${reader}?periodId=${created.json().id}`))
        .statusCode,
    ).toBe(204);
    expect((await call('GET', `/campaigns/${campaign}`, undefined, reader)).statusCode).toBe(404);
    expect((await call('GET', `/territories/${territory}`, undefined, reader)).statusCode).toBe(
      404,
    );
    expect((await call('GET', `/teams/${team}/members`, undefined, reader)).statusCode).toBe(404);
  });
  it('checks configurable team management permissions before cached roster responses', async () => {
    const key = randomUUID();
    const created = await join({}, manager, key);
    expect(created.statusCode).toBe(201);
    expect((await join({}, manager, key)).headers['idempotency-replayed']).toBe('true');
    expect((await call('PUT', '/roles/manager/permissions', { permissions: [] })).statusCode).toBe(
      200,
    );
    expect((await join({}, manager, key)).statusCode).toBe(403);
    expect(
      (
        await call(
          'DELETE',
          `/teams/${team}/members/${reader}?periodId=${created.json().id}`,
          undefined,
          manager,
        )
      ).statusCode,
    ).toBe(403);
  });
  it('rechecks permission revocation after HTTP authorization and before mutation', async () => {
    const service = app.get(StructureService),
      original = service.authorizeRoster.bind(service);
    let notify!: () => void;
    const checked = new Promise<void>((r) => {
      notify = r;
    });
    const spy = vi.spyOn(service, 'authorizeRoster').mockImplementationOnce(async (...args) => {
      const result = await original(...args);
      notify();
      return result;
    });
    let pending: ReturnType<typeof join> | undefined;
    try {
      await db.transaction(async (tx) => {
        await tx
          .select({ id: tenants.id })
          .from(tenants)
          .where(eq(tenants.id, tenantId))
          .for('no key update');
        pending = join({}, manager);
        void pending.then(() => undefined);
        await checked;
        await tx
          .insert(tenantRolePermissions)
          .values({ tenantId, role: 'manager', permissions: [] });
      });
      expect((await pending!).statusCode).toBe(403);
      expect(
        await db.select().from(teamMemberships).where(eq(teamMemberships.tenantId, tenantId)),
      ).toHaveLength(0);
    } finally {
      spy.mockRestore();
    }
  });
  it('protects team deactivation and closes races with roster creation', async () => {
    const fresh = await newTeam();
    const created = await call('POST', `/teams/${fresh}/members`, {
      membershipId: reader,
      startsAt: iso(1),
    });
    expect(created.statusCode).toBe(201);
    expect((await call('DELETE', `/teams/${fresh}`)).statusCode).toBe(409);
    expect(
      (await call('DELETE', `/teams/${fresh}/members/${reader}?periodId=${created.json().id}`))
        .statusCode,
    ).toBe(204);
    expect((await call('DELETE', `/teams/${fresh}`)).statusCode).toBe(200);
    const racing = await newTeam();
    const result = await Promise.all([
      call('POST', `/teams/${racing}/members`, { membershipId: reader }),
      call('DELETE', `/teams/${racing}`),
    ]);
    expect(result.filter((r) => r.statusCode === 409)).toHaveLength(1);
    const [row] = await db.select().from(teams).where(eq(teams.id, racing));
    expect(row!.status).toBe(result[0]!.statusCode === 201 ? 'active' : 'inactive');
  });
});
