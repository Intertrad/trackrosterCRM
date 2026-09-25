import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureHttpApplication } from '../src/config/http-application.js';
import { getSeedDatabase } from './support/seed.js';
import type { Database } from '../src/database/database.types.js';
import {
  auditEvents,
  authSessions,
  campaignProspectAssignments,
  campaignProspects,
  campaignTerritories,
  campaigns,
  establishments,
  identities,
  idempotencyRecords,
  membershipSettings,
  organizations,
  teams,
  teamSettings,
  tenantMemberships,
  tenantRolePermissions,
  tenants,
  territories,
  territoryAssignments,
  userAccessGrants,
} from '../src/database/schema/index.js';
import { PasswordService } from '../src/auth/password.service.js';
import { GeographicAllocationService } from '../src/geographic-allocation/allocation.service.js';
describe('Automatic geographic allocation', () => {
  let app: NestFastifyApplication, db: Database;
  const tenantId = randomUUID(),
    foreignTenantId = randomUUID(),
    admin = randomUUID(),
    director = randomUUID(),
    member = randomUUID(),
    foreign = randomUUID();
  const org = randomUUID(),
    otherOrg = randomUUID(),
    foreignOrg = randomUUID(),
    team = randomUUID(),
    otherTeam = randomUUID(),
    outsideTeam = randomUUID(),
    campaign = randomUUID(),
    foreignCampaign = randomUUID(),
    territory = randomUUID();
  const actors = [admin, director, member, foreign],
    tokens = new Map<string, string>();
  const call = (
    method: 'POST' | 'GET' | 'PATCH',
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
  const allocate = (ids: string[], mode = 'preview', actor = admin, key: string = randomUUID()) =>
    call(
      'POST',
      `/campaigns/${campaign}/geographic-allocation/${mode}`,
      { prospectIds: ids },
      actor,
      key,
    );
  const prospect = async (longitude: number | null = 2.5, latitude: number | null = 48.5) => {
    const e = randomUUID(),
      p = randomUUID();
    await db.insert(establishments).values({
      id: e,
      tenantId,
      name: e,
      normalizedName: e,
      countryCode: 'FR',
      longitude,
      latitude,
    });
    await db
      .insert(campaignProspects)
      .values({ id: p, tenantId, campaignId: campaign, establishmentId: e });
    return p;
  };
  const responsibility = async (values: Partial<typeof territoryAssignments.$inferInsert> = {}) => {
    const [r] = await db
      .insert(territoryAssignments)
      .values({ tenantId, territoryId: territory, teamId: team, ...values })
      .returning();
    return r!;
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
    await db.insert(organizations).values(
      [org, otherOrg, foreignOrg].map((id) => ({
        id,
        tenantId: id === foreignOrg ? foreignTenantId : tenantId,
        name: id,
        slug: id,
      })),
    );
    await db.insert(teams).values(
      [team, otherTeam, outsideTeam].map((id) => ({
        id,
        tenantId,
        organizationId: id === outsideTeam ? otherOrg : org,
        name: id,
        slug: id,
      })),
    );
    const password = 'GeographicAllocation123!';
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
        userId: director,
        role: 'director',
        scopeType: 'organization',
        organizationId: org,
      },
      {
        tenantId,
        userId: member,
        role: 'prospector',
        scopeType: 'team',
        organizationId: org,
        teamId: team,
      },
    ]);
    await db.insert(campaigns).values([
      { id: campaign, tenantId, organizationId: org, name: campaign, status: 'active' },
      {
        id: foreignCampaign,
        tenantId: foreignTenantId,
        organizationId: foreignOrg,
        name: foreignCampaign,
        status: 'active',
      },
    ]);
    await db.insert(territories).values({
      id: territory,
      tenantId,
      name: territory,
      boundary: sql`ST_Multi(ST_MakeEnvelope(2,48,3,49,4326))`,
    });
    await db
      .insert(campaignTerritories)
      .values({ tenantId, campaignId: campaign, territoryId: territory });
    for (const id of actors) {
      const result = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: `${id}@example.test`, password },
      });
      expect(result.statusCode, result.body).toBe(200);
      tokens.set(id, result.json().accessToken);
    }
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    for (const t of [
      campaignProspectAssignments,
      campaignProspects,
      establishments,
      territoryAssignments,
      membershipSettings,
      teamSettings,
      tenantRolePermissions,
    ])
      await db.delete(t).where(eq(t.tenantId, tenantId));
    await db.update(campaigns).set({ status: 'active' }).where(eq(campaigns.id, campaign));
    await db.update(territories).set({ status: 'active' }).where(eq(territories.id, territory));
    await db.update(teams).set({ status: 'active' }).where(eq(teams.tenantId, tenantId));
    await db
      .update(tenantMemberships)
      .set({ status: 'active', suspendedAt: null })
      .where(eq(tenantMemberships.id, member));
  });
  afterAll(async () => {
    if (db) {
      const ids = [tenantId, foreignTenantId];
      for (const t of [
        idempotencyRecords,
        auditEvents,
        territoryAssignments,
        campaignTerritories,
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
  it('previews without assignments, applies deterministic boundary-inclusive matches and records evidence', async () => {
    const p = await prospect(2, 48);
    const r = await responsibility();
    const preview = await allocate([p]);
    expect(preview.statusCode, preview.body).toBe(200);
    expect(preview.json().decisions[0]).toMatchObject({
      prospectId: p,
      outcome: 'proposed',
      teamId: team,
      territoryId: territory,
      responsibilityId: r.id,
    });
    expect(
      await db
        .select()
        .from(campaignProspectAssignments)
        .where(eq(campaignProspectAssignments.tenantId, tenantId)),
    ).toHaveLength(0);
    const applied = await allocate([p], 'apply', director);
    expect(applied.statusCode, applied.body).toBe(200);
    expect(applied.json().assigned).toBe(1);
    const [audit] = await db
      .select()
      .from(auditEvents)
      .where(and(eq(auditEvents.resourceId, p), eq(auditEvents.action, 'assignment.assigned')));
    expect(audit!.metadata).toMatchObject({
      source: 'geographic_allocation',
      responsibilityId: r.id,
    });
  });
  it('reports missing coordinates, outside coverage and excluded prospects separately', async () => {
    await responsibility();
    const missing = await prospect(null, null),
      outside = await prospect(9, 48),
      excluded = await prospect();
    await db
      .update(campaignProspects)
      .set({ status: 'excluded' })
      .where(eq(campaignProspects.id, excluded));
    const result = (await allocate([missing, outside, excluded], 'apply')).json();
    expect(result.assigned).toBe(0);
    expect(result.decisions).toEqual(
      expect.arrayContaining([
        { prospectId: missing, outcome: 'missing_coordinates' },
        { prospectId: outside, outcome: 'no_eligible_responsibility' },
        { prospectId: excluded, outcome: 'inactive_prospect' },
      ]),
    );
  });
  it('honors priority, personal capacity and fallback identically during preview and apply', async () => {
    await responsibility({ teamId: null, membershipId: member, priority: 1 });
    await responsibility({ teamId: otherTeam, priority: 10 });
    await db.insert(membershipSettings).values({ tenantId, membershipId: member, capacity: 1 });
    const ids = [await prospect(), await prospect()].sort();
    const preview = await allocate(ids);
    expect(preview.statusCode, preview.body).toBe(200);
    expect(
      preview.json().decisions.map((d: { membershipId: string | null }) => d.membershipId),
    ).toEqual([member, null]);
    const applied = await allocate(ids, 'apply');
    expect(applied.statusCode, applied.body).toBe(200);
    expect(applied.json().decisions.map((d: { teamId: string }) => d.teamId)).toEqual([
      team,
      otherTeam,
    ]);
  });
  it('enforces team capacity across the batch and competing allocation requests', async () => {
    await responsibility();
    await db
      .insert(teamSettings)
      .values({ tenantId, organizationId: org, teamId: team, capacity: 1 });
    const ids = [await prospect(), await prospect()];
    const preview = (await allocate(ids)).json();
    expect(preview.proposed).toBe(1);
    expect(
      preview.decisions.some((d: { outcome: string }) => d.outcome === 'capacity_exhausted'),
    ).toBe(true);
    const race = await Promise.all(ids.map((p) => allocate([p], 'apply')));
    expect(race.every((r) => r.statusCode === 200)).toBe(true);
    expect(race.reduce((n, r) => n + r.json().assigned, 0)).toBe(1);
  });
  it('preserves existing ownership and replays apply without duplicate audit events', async () => {
    await responsibility();
    const p = await prospect(),
      key = randomUUID();
    const first = await allocate([p], 'apply', admin, key);
    expect(first.json().assigned).toBe(1);
    const replay = await allocate([p], 'apply', admin, key);
    expect(replay.json()).toEqual(first.json());
    expect((await allocate([p], 'apply')).json().decisions[0].outcome).toBe('already_assigned');
    expect(await db.select().from(auditEvents).where(eq(auditEvents.resourceId, p))).toHaveLength(
      1,
    );
  });
  it('rejects foreign or missing batch IDs atomically and validates bounded unique input', async () => {
    await responsibility();
    const p = await prospect();
    expect((await allocate([p, randomUUID()], 'apply')).statusCode).toBe(404);
    expect(
      await db
        .select()
        .from(campaignProspectAssignments)
        .where(eq(campaignProspectAssignments.tenantId, tenantId)),
    ).toHaveLength(0);
    expect((await allocate([])).statusCode).toBe(400);
    expect((await allocate([p, p])).statusCode).toBe(400);
    expect((await allocate([p, p.toUpperCase()])).statusCode).toBe(400);
    expect((await allocate(Array.from({ length: 101 }, () => randomUUID()))).statusCode).toBe(400);
    expect(
      (
        await call('POST', `/campaigns/${foreignCampaign}/geographic-allocation/apply`, {
          prospectIds: [p],
        })
      ).statusCode,
    ).toBe(403);
    expect((await allocate([p], 'apply', member)).statusCode).toBe(403);
  });
  it('excludes future, expired, revoked, inactive and foreign-organization responsibilities', async () => {
    const p = await prospect();
    const r = await responsibility({ startsAt: new Date(Date.now() + 3600000) });
    expect((await allocate([p])).json().proposed).toBe(0);
    await db
      .update(territoryAssignments)
      .set({ startsAt: new Date(Date.now() - 7200000), endsAt: new Date(Date.now() - 3600000) })
      .where(eq(territoryAssignments.id, r.id));
    expect((await allocate([p])).json().proposed).toBe(0);
    await db
      .update(territoryAssignments)
      .set({ endsAt: null, revokedAt: new Date() })
      .where(eq(territoryAssignments.id, r.id));
    expect((await allocate([p])).json().proposed).toBe(0);
    await responsibility({ teamId: outsideTeam });
    expect((await allocate([p])).json().proposed).toBe(0);
    await db
      .update(territoryAssignments)
      .set({ revokedAt: null })
      .where(eq(territoryAssignments.id, r.id));
    await db.update(territories).set({ status: 'inactive' }).where(eq(territories.id, territory));
    expect((await allocate([p])).json().proposed).toBe(0);
  });
  it('requires active prospector grants for personal responsibility and excludes inactive teams', async () => {
    const p = await prospect();
    await responsibility({ teamId: null, membershipId: director });
    expect((await allocate([p])).json().proposed).toBe(0);
    await responsibility({ teamId: null, membershipId: member });
    expect((await allocate([p])).json().proposed).toBe(1);
    await db
      .update(tenantMemberships)
      .set({ status: 'suspended', suspendedAt: new Date() })
      .where(eq(tenantMemberships.id, member));
    expect((await allocate([p])).json().proposed).toBe(0);
    await responsibility();
    await db.update(teams).set({ status: 'inactive' }).where(eq(teams.id, team));
    expect((await allocate([p])).json().proposed).toBe(0);
  });
  it('ignores unlinked territories and handles concurrent manual assignment without oversubscribing a member', async () => {
    const unlinked = randomUUID();
    await db.insert(territories).values({
      id: unlinked,
      tenantId,
      name: unlinked,
      boundary: sql`ST_Multi(ST_MakeEnvelope(2,48,3,49,4326))`,
    });
    await responsibility({ territoryId: unlinked, priority: 0 });
    const p = await prospect(),
      manual = await prospect();
    expect((await allocate([p])).json().proposed).toBe(0);
    await responsibility({ teamId: null, membershipId: member });
    await db.insert(membershipSettings).values({ tenantId, membershipId: member, capacity: 1 });
    const results = await Promise.all([
      allocate([p], 'apply'),
      call('POST', `/campaigns/${campaign}/prospects/${manual}/assignment`, {
        teamId: team,
        assignedUserId: member,
      }),
    ]);
    expect(results[0]!.statusCode, results[0]!.body).toBe(200);
    expect([201, 409]).toContain(results[1]!.statusCode);
    expect(
      await db
        .select()
        .from(campaignProspectAssignments)
        .where(
          and(
            eq(campaignProspectAssignments.tenantId, tenantId),
            eq(campaignProspectAssignments.assignedUserId, member),
          ),
        ),
    ).toHaveLength(1);
  });
  it('blocks terminal campaigns and configurable permission revocation before replay', async () => {
    const p = await prospect();
    await responsibility();
    const key = randomUUID();
    expect((await allocate([p], 'apply', director, key)).json().assigned).toBe(1);
    await db.insert(tenantRolePermissions).values({ tenantId, role: 'director', permissions: [] });
    expect((await allocate([p], 'apply', director, key)).statusCode).toBe(403);
    await db.update(campaigns).set({ status: 'completed' }).where(eq(campaigns.id, campaign));
    expect((await allocate([p])).statusCode).toBe(409);
  });
  it('rechecks permission after waiting for the allocation transaction lock', async () => {
    const p = await prospect();
    await responsibility();
    const service = app.get(GeographicAllocationService),
      original = service.authorize.bind(service);
    let signal!: () => void;
    const checked = new Promise<void>((r) => (signal = r));
    vi.spyOn(service, 'authorize').mockImplementation(async (...args) => {
      const result = await original(...args);
      if (!args[2]) signal();
      return result;
    });
    let pending!: ReturnType<typeof allocate>;
    await db.transaction(async (tx) => {
      await tx.select().from(tenants).where(eq(tenants.id, tenantId)).for('no key update');
      pending = allocate([p], 'apply', director);
      void pending.then(() => undefined);
      await checked;
      await tx
        .insert(tenantRolePermissions)
        .values({ tenantId, role: 'director', permissions: [] });
    });
    expect((await pending).statusCode).toBe(403);
    expect(
      await db
        .select()
        .from(campaignProspectAssignments)
        .where(eq(campaignProspectAssignments.tenantId, tenantId)),
    ).toHaveLength(0);
  });
});
