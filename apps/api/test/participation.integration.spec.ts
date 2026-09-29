import { ResourceScopeService } from '../src/resource-scopes/resource-scope.service.js';
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

describe('Territory responsibilities and campaign rosters', () => {
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
    if (db) {
      await db.delete(campaignMembers).where(eq(campaignMembers.tenantId, tenantId));
      await db.delete(territoryAssignments).where(eq(territoryAssignments.tenantId, tenantId));
    }
  });
  afterAll(async () => {
    if (db) {
      const ids = [tenantId, foreignTenantId];
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
  const responsibility = (body: object, actor = admin, key: string = randomUUID()) =>
    call(
      'POST',
      '/territory-assignments',
      { territoryId: territory, membershipId: reader, ...body },
      actor,
      key,
    );
  const participant = (body: object = {}, actor = admin, key: string = randomUUID()) =>
    call('POST', `/campaigns/${campaign}/members`, { membershipId: reader, ...body }, actor, key);

  it('derives read-only territory access and reports its source without inventing a role', async () => {
    expect((await call('GET', `/territories/${territory}`, undefined, reader)).statusCode).toBe(
      404,
    );
    const response = await responsibility({ priority: 25 });
    expect(response.statusCode, response.body).toBe(201);
    expect(response.json().priority).toBe(25);
    expect((await call('GET', `/territories/${territory}`, undefined, reader)).statusCode).toBe(
      200,
    );
    expect(
      (await call('GET', `/territories/${hiddenTerritory}`, undefined, reader)).statusCode,
    ).toBe(404);
    const effective = (await call('GET', '/me/permissions', undefined, reader)).json();
    expect(effective).toContainEqual(
      expect.objectContaining({
        grantId: response.json().id,
        source: 'territory_assignment',
        role: null,
        territoryId: territory,
        permissions: ['scope.read'],
      }),
    );
    expect(
      (await call('PATCH', `/territories/${territory}`, { name: 'Forbidden' }, reader)).statusCode,
    ).toBe(404);
    expect((await responsibility({ membershipId: manager }, reader)).statusCode).toBe(404);
  });
  it('applies scheduled/expired windows and preserves ended history', async () => {
    const future = await responsibility({ startsAt: iso(2), endsAt: iso(4) });
    expect(future.statusCode).toBe(201);
    expect((await call('GET', `/territories/${territory}`, undefined, reader)).statusCode).toBe(
      404,
    );
    expect((await call('GET', '/territory-assignments?state=scheduled')).json().items).toHaveLength(
      1,
    );
    const past = await responsibility({ startsAt: iso(-4), endsAt: iso(-2) });
    expect(past.statusCode).toBe(201);
    expect((await call('GET', '/territory-assignments?state=ended')).json().items).toHaveLength(1);
    expect(
      (await call('PATCH', `/territory-assignments/${past.json().id}`, { endsAt: iso(1) }))
        .statusCode,
    ).toBe(409);
    expect(
      (await call('PATCH', `/territory-assignments/${future.json().id}`, { startsAt: iso(-1) }))
        .statusCode,
    ).toBe(200);
    expect((await call('GET', `/territories/${territory}`, undefined, reader)).statusCode).toBe(
      200,
    );
    expect((await call('DELETE', `/territory-assignments/${future.json().id}`)).statusCode).toBe(
      204,
    );
    expect((await call('GET', `/territories/${territory}`, undefined, reader)).statusCode).toBe(
      404,
    );
    expect((await call('GET', '/territory-assignments?state=revoked')).json().items).toHaveLength(
      1,
    );
  });
  it('prevents concurrent overlaps and enforces ranges in the database while allowing adjacent periods', async () => {
    const start = iso(1),
      middle = iso(2),
      end = iso(3);
    const replies = await Promise.all([
      responsibility({ startsAt: start, endsAt: middle }),
      responsibility({ startsAt: start, endsAt: middle }),
    ]);
    expect(replies.map((r) => r.statusCode).sort()).toEqual([201, 409]);
    const adjacent = await responsibility({ startsAt: middle, endsAt: end });
    expect(adjacent.statusCode).toBe(201);
    expect(
      (await call('PATCH', `/territory-assignments/${adjacent.json().id}`, { startsAt: start }))
        .statusCode,
    ).toBe(409);
    await expect(
      db.insert(territoryAssignments).values({
        tenantId,
        territoryId: territory,
        membershipId: reader,
        startsAt: new Date(start),
        endsAt: new Date(end),
      }),
    ).rejects.toMatchObject({ cause: { code: '23P01' } });
    const campaignReplies = await Promise.all([participant(), participant()]);
    expect(campaignReplies.map((r) => r.statusCode).sort()).toEqual([201, 409]);
    await expect(
      db.insert(campaignMembers).values({ tenantId, campaignId: campaign, membershipId: reader }),
    ).rejects.toMatchObject({ cause: { code: '23P01' } });
  });
  it('resolves team participation live and removes access on team-grant revocation or deactivation', async () => {
    expect(
      (await call('POST', '/territory-assignments', { territoryId: territory, teamId: team }))
        .statusCode,
    ).toBe(201);
    expect(
      (await call('POST', `/campaigns/${campaign}/members`, { teamId: team })).statusCode,
    ).toBe(201);
    expect((await call('GET', `/territories/${territory}`, undefined, reader)).statusCode).toBe(
      200,
    );
    expect((await call('GET', `/campaigns/${campaign}`, undefined, reader)).statusCode).toBe(200);
    const [original] = await db
      .delete(userAccessGrants)
      .where(eq(userAccessGrants.userId, reader))
      .returning();
    try {
      expect((await call('GET', `/territories/${territory}`, undefined, reader)).statusCode).toBe(
        404,
      );
      expect((await call('GET', `/campaigns/${campaign}`, undefined, reader)).statusCode).toBe(404);
    } finally {
      await db.insert(userAccessGrants).values(original!);
    }
    await db.update(teams).set({ status: 'inactive' }).where(eq(teams.id, team));
    try {
      expect((await call('GET', `/campaigns/${campaign}`, undefined, reader)).statusCode).toBe(404);
    } finally {
      await db.update(teams).set({ status: 'active' }).where(eq(teams.id, team));
    }
    expect((await call('GET', `/campaigns/${campaign}`, undefined, reader)).statusCode).toBe(200);
  });
  it('validates subjects, dates and tenant boundaries at API and database layers', async () => {
    expect((await responsibility({ teamId: team })).statusCode).toBe(400);
    expect(
      (await call('POST', '/territory-assignments', { territoryId: territory })).statusCode,
    ).toBe(400);
    expect((await responsibility({ membershipId: foreign })).statusCode).toBe(404);
    expect((await responsibility({ territoryId: foreignTerritory })).statusCode).toBe(404);
    expect((await participant({ membershipId: foreign })).statusCode).toBe(404);
    expect((await responsibility({ priority: -1 })).statusCode).toBe(400);
    expect((await responsibility({ startsAt: iso(2), endsAt: iso(1) })).statusCode).toBe(400);
    expect((await responsibility({ startsAt: '2027-01-01T10:00:00' })).statusCode).toBe(400);
    expect((await participant({ campaignRole: 'tenant_admin' })).statusCode).toBe(400);
    await expect(
      db
        .insert(territoryAssignments)
        .values({ tenantId, territoryId: foreignTerritory, membershipId: reader }),
    ).rejects.toMatchObject({ cause: { code: '23503' } });
    await expect(
      db.insert(campaignMembers).values({ tenantId, campaignId: campaign, membershipId: foreign }),
    ).rejects.toMatchObject({ cause: { code: '23503' } });
    await expect(
      db
        .insert(campaignMembers)
        .values({ tenantId, campaignId: campaign, membershipId: reader, teamId: team }),
    ).rejects.toMatchObject({ cause: { code: '23514' } });
    const inactive = randomUUID();
    members.push(inactive);
    await db.insert(identities).values({ id: inactive, email: `${inactive}@example.test` });
    await db.insert(tenantMemberships).values({
      id: inactive,
      identityId: inactive,
      tenantId,
      status: 'suspended',
      activatedAt: sql`now()`,
      suspendedAt: sql`now()`,
    });
    expect((await responsibility({ membershipId: inactive })).statusCode).toBe(404);
  });
  it('supports conditional updates, terminal cancellation and audited rejoining', async () => {
    const created = await responsibility({});
    const id = created.json().id;
    const updated = await call(
      'PATCH',
      `/territory-assignments/${id}`,
      { priority: 5 },
      admin,
      randomUUID(),
      { 'if-match': String(created.headers.etag) },
    );
    expect(updated.statusCode).toBe(200);
    expect(updated.json().priority).toBe(5);
    expect(
      (
        await call('PATCH', `/territory-assignments/${id}`, { priority: 8 }, admin, randomUUID(), {
          'if-match': String(created.headers.etag),
        })
      ).statusCode,
    ).toBe(412);
    expect((await call('PATCH', `/territory-assignments/${id}`, {})).statusCode).toBe(400);
    const listed = (await call('GET', `/territory-assignments?territoryId=${territory}`)).json()
      .items[0];
    expect(listed.etag).toBe(updated.headers.etag);
    expect(
      (
        await call('DELETE', `/territory-assignments/${id}`, undefined, admin, randomUUID(), {
          'if-match': listed.etag,
        })
      ).statusCode,
    ).toBe(204);
    expect((await call('PATCH', `/territory-assignments/${id}`, { priority: 1 })).statusCode).toBe(
      409,
    );
    expect((await responsibility({})).statusCode).toBe(201);
    const events = await db.select().from(auditEvents).where(eq(auditEvents.resourceId, id));
    expect(events.map((e) => e.action).sort()).toEqual([
      'territory_assignment.created',
      'territory_assignment.ended',
      'territory_assignment.updated',
    ]);
    expect(events.every((e) => e.actorUserId === admin)).toBe(true);
  });
  it('treats campaign roles as roster roles without giving coordinators administrative authority', async () => {
    const created = await participant({ campaignRole: 'coordinator' });
    expect(created.statusCode).toBe(201);
    const id = created.json().id;
    expect(
      (await call('GET', `/campaigns/${campaign}/members`, undefined, reader)).json().items[0]
        .campaignRole,
    ).toBe('coordinator');
    expect(
      (await call('PATCH', `/campaigns/${campaign}`, { name: 'Forbidden' }, reader)).statusCode,
    ).toBe(404);
    expect((await participant({ membershipId: manager }, reader)).statusCode).toBe(404);
    const changed = await call('PATCH', `/campaign-members/${id}`, { campaignRole: 'observer' });
    expect(changed.statusCode).toBe(200);
    expect(changed.json().campaignRole).toBe('observer');
    expect((await call('DELETE', `/campaign-members/${id}`)).statusCode).toBe(204);
    expect((await call('GET', `/campaigns/${campaign}`, undefined, reader)).statusCode).toBe(404);
    expect(
      (await call('GET', `/campaigns/${campaign}/members?state=revoked`)).json().items[0].id,
    ).toBe(id);
  });
  it('enforces campaign period expiry and archived-resource access without losing history', async () => {
    const path = `/campaigns/${otherCampaign}/members`;
    expect(
      (await call('POST', path, { membershipId: reader, startsAt: iso(-4), endsAt: iso(-2) }))
        .statusCode,
    ).toBe(201);
    expect((await call('GET', `/campaigns/${otherCampaign}`, undefined, reader)).statusCode).toBe(
      404,
    );
    const current = await call('POST', path, { membershipId: reader });
    expect(current.statusCode).toBe(201);
    expect((await call('GET', `/campaigns/${otherCampaign}`, undefined, reader)).statusCode).toBe(
      200,
    );
    expect(
      (await call('PATCH', `/campaigns/${otherCampaign}`, { status: 'completed' })).statusCode,
    ).toBe(200);
    expect((await call('POST', path, { membershipId: manager })).statusCode).toBe(409);
    expect(
      (await call('PATCH', `/campaign-members/${current.json().id}`, { campaignRole: 'observer' }))
        .statusCode,
    ).toBe(409);
    expect(
      (await call('PATCH', `/campaigns/${otherCampaign}`, { status: 'archived' })).statusCode,
    ).toBe(200);
    expect((await call('GET', `/campaigns/${otherCampaign}`, undefined, reader)).statusCode).toBe(
      404,
    );
    expect((await call('DELETE', `/campaign-members/${current.json().id}`)).statusCode).toBe(204);
    expect((await call('GET', path)).json().items).toHaveLength(2);
  });
  it('protects future territory responsibilities from deactivation', async () => {
    const resource = (await call('POST', '/territories', { name: 'Scheduled territory' })).json()
      .id;
    const created = await responsibility({ territoryId: resource, startsAt: iso(12) });
    expect(created.statusCode).toBe(201);
    expect((await call('DELETE', `/territories/${resource}`)).statusCode).toBe(409);
    expect((await call('DELETE', `/territory-assignments/${created.json().id}`)).statusCode).toBe(
      204,
    );
    expect((await call('DELETE', `/territories/${resource}`)).statusCode).toBe(204);
  });
  it('checks live management authority before replaying cached roster mutations', async () => {
    const scope = await grant(manager, 'campaign', campaign, 'manage');
    const key = randomUUID();
    const created = await participant({}, manager, key);
    expect(created.statusCode).toBe(201);
    const replay = await participant({}, manager, key);
    expect(replay.headers['idempotency-replayed']).toBe('true');
    expect((await call('DELETE', `/membership-scopes/${scope.id}`)).statusCode).toBe(204);
    expect((await participant({}, manager, key)).statusCode).toBe(404);
    expect(
      (
        await call(
          'PATCH',
          `/campaign-members/${created.json().id}`,
          { campaignRole: 'observer' },
          manager,
        )
      ).statusCode,
    ).toBe(404);
  });
  it('rechecks management authority if it changes after the guard but before the write', async () => {
    const scope = await grant(manager, 'campaign', campaign, 'manage');
    const scopes = app.get(ResourceScopeService);
    const original = scopes.require.bind(scopes);
    let notify!: () => void;
    const checked = new Promise<void>((resolve) => {
      notify = resolve;
    });
    const spy = vi.spyOn(scopes, 'require').mockImplementationOnce(async (...args) => {
      await original(...args);
      notify();
    });
    let pending: ReturnType<typeof participant> | undefined;
    try {
      await db.transaction(async (tx) => {
        await tx
          .select({ id: tenants.id })
          .from(tenants)
          .where(eq(tenants.id, tenantId))
          .for('update');
        pending = participant({}, manager);
        void pending.then(() => undefined);
        await checked;
        await tx.delete(membershipResourceScopes).where(eq(membershipResourceScopes.id, scope.id));
      });
      expect((await pending!).statusCode).toBe(404);
      expect(
        await db.select().from(campaignMembers).where(eq(campaignMembers.tenantId, tenantId)),
      ).toHaveLength(0);
    } finally {
      spy.mockRestore();
    }
  });
  it('paginates only visible records and filters subjects and lifecycle state', async () => {
    await responsibility({});
    await responsibility({ membershipId: manager });
    const hidden = await responsibility({ territoryId: hiddenTerritory, membershipId: manager });
    expect(hidden.statusCode).toBe(201);
    const page = (await call('GET', '/territory-assignments?limit=1', undefined, reader)).json();
    expect(page.items).toHaveLength(1);
    expect(page.items[0].territoryId).toBe(territory);
    const next = (
      await call(
        'GET',
        `/territory-assignments?limit=1&cursor=${page.nextCursor}`,
        undefined,
        reader,
      )
    ).json();
    expect(next.items).toHaveLength(1);
    expect(next.items[0].territoryId).toBe(territory);
    expect(next.items[0].id).not.toBe(page.items[0].id);
    expect(next.nextCursor).toBeNull();
    expect(
      (
        await call(
          'GET',
          `/territory-assignments?territoryId=${hiddenTerritory}`,
          undefined,
          reader,
        )
      ).statusCode,
    ).toBe(404);
    expect(
      (await call('GET', `/territory-assignments?membershipId=${reader}&state=active`)).json()
        .items,
    ).toHaveLength(1);
  });
});
