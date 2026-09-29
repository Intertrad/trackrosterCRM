import { ResourceScopeService } from '../src/resource-scopes/resource-scope.service.js';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { eq, inArray, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureHttpApplication } from '../src/config/http-application.js';
import { getSeedDatabase } from './support/seed.js';
import type { Database } from '../src/database/database.types.js';
import {
  actions,
  prospectFollowUps,
  reservationRecords,
  collisionEvents,
  overrideRequests,
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
describe('Campaign lifecycle APIs', () => {
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
    key = randomUUID(),
    extra: Record<string, string> = {},
  ) =>
    app.inject({
      method,
      url: `/api/v1${url}`,
      payload,
      headers: { authorization: `Bearer ${tokens.get(actor)}`, 'idempotency-key': key, ...extra },
    });
  const create = async () => {
    const r = await call('POST', '/campaigns', { organizationId: org, name: ' Lifecycle test ' });
    expect(r.statusCode, r.body).toBe(201);
    return r;
  };
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
        overrideRequests,
        collisionEvents,
        reservationRecords,
        prospectFollowUps,
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
  it('creates a normalized draft once and preserves idempotent response and audit', async () => {
    const key = randomUUID(),
      payload = {
        organizationId: org,
        name: '  Canonical campaign  ',
        startsAt: '2026-10-01T00:00:00Z',
        endsAt: '2026-11-01T00:00:00Z',
      };
    const first = await call('POST', '/campaigns', payload, admin, key);
    expect(first.statusCode, first.body).toBe(201);
    expect(first.json()).toMatchObject({
      status: 'draft',
      name: 'Canonical campaign',
      summary: { prospects: 0 },
    });
    const replay = await call('POST', '/campaigns', payload, admin, key);
    expect(replay.statusCode, replay.body).toBe(201);
    expect(replay.json()).toEqual(first.json());
    expect(replay.headers.etag).toBe(first.headers.etag);
    expect(
      (await call('POST', '/campaigns', { ...payload, name: 'Different' }, admin, key)).statusCode,
    ).toBe(409);
    const evidence = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.resourceId, first.json().id));
    expect(evidence.filter((e) => e.action === 'campaign.created')).toHaveLength(1);
  });
  it('validates fields and rejects unauthorized, foreign or inactive organizations', async () => {
    expect(
      (await call('POST', '/campaigns', { organizationId: org, name: 'Denied' }, member))
        .statusCode,
    ).toBe(403);
    expect(
      (await call('POST', '/campaigns', { organizationId: foreignOrg, name: 'Foreign' }))
        .statusCode,
    ).toBe(404);
    for (const payload of [
      { organizationId: org, name: '   ' },
      { organizationId: org, name: 'Bad dates', startsAt: '2026-10-02', endsAt: '2026-10-01' },
      { organizationId: org, name: 'Invalid status', status: 'active' },
    ])
      expect((await call('POST', '/campaigns', payload)).statusCode).toBe(400);
    await db.update(organizations).set({ status: 'inactive' }).where(eq(organizations.id, org));
    try {
      expect(
        (await call('POST', '/campaigns', { organizationId: org, name: 'Inactive' })).statusCode,
      ).toBe(409);
    } finally {
      await db.update(organizations).set({ status: 'active' }).where(eq(organizations.id, org));
    }
  });
  it('implements activate, pause, resume, complete and archive with historical retention', async () => {
    let current = await create();
    const id = current.json().id;
    for (const status of ['active', 'paused', 'active', 'completed']) {
      const r = await call(
        'POST',
        `/campaigns/${id}/status`,
        { status, reason: 'Lifecycle integration' },
        admin,
        randomUUID(),
        { 'if-match': String(current.headers.etag) },
      );
      expect(r.statusCode, r.body).toBe(200);
      expect(r.json().status).toBe(status);
      current = r;
    }
    const archived = await call('DELETE', `/campaigns/${id}`, undefined, admin, randomUUID(), {
      'if-match': String(current.headers.etag),
    });
    expect(archived.statusCode, archived.body).toBe(204);
    const detail = await call('GET', `/campaigns/${id}`);
    expect(detail.statusCode).toBe(200);
    expect(detail.json().status).toBe('archived');
    expect((await call('POST', `/campaigns/${id}/status`, { status: 'active' })).statusCode).toBe(
      400,
    );
    expect((await call('PATCH', `/campaigns/${id}`, { name: 'Rewrite history' })).statusCode).toBe(
      409,
    );
    expect((await call('DELETE', `/campaigns/${id}`)).statusCode).toBe(204);
    const evidence = await db.select().from(auditEvents).where(eq(auditEvents.resourceId, id));
    expect(evidence.filter((e) => e.action === 'campaign.status_changed')).toHaveLength(5);
  });
  it('rejects stale and concurrent versions and does not audit no-op status retries', async () => {
    const initial = await create(),
      id = initial.json().id,
      headers = { 'if-match': String(initial.headers.etag) };
    const results = await Promise.all([
      call('POST', `/campaigns/${id}/status`, { status: 'active' }, admin, randomUUID(), headers),
      call('DELETE', `/campaigns/${id}`, undefined, admin, randomUUID(), headers),
    ]);
    expect(results.map((r) => r.statusCode).filter((s) => s === 412)).toHaveLength(1);
    expect(results.some((r) => r.statusCode === 200 || r.statusCode === 204)).toBe(true);
    const state = await call('GET', `/campaigns/${id}`),
      key = randomUUID();
    const noop = await call(
      'POST',
      `/campaigns/${id}/status`,
      { status: state.json().status },
      admin,
      key,
    );
    expect(noop.statusCode, noop.body).toBe(200);
    expect(noop.headers.etag).toBe(state.headers.etag);
    expect(
      (
        await call('POST', `/campaigns/${id}/status`, { status: state.json().status }, admin, key)
      ).json(),
    ).toEqual(noop.json());
  });
  it('rejects invalid transitions and terminal closure with open work through every route', async () => {
    const initial = await create(),
      id = initial.json().id;
    expect(
      (await call('POST', `/campaigns/${id}/status`, { status: 'completed' })).statusCode,
    ).toBe(400);
    for (const [method, url, payload] of [
      ['DELETE', `/campaigns/${campaign}`, undefined],
      ['POST', `/campaigns/${campaign}/status`, { status: 'completed' }],
      ['PATCH', `/campaigns/${campaign}`, { status: 'archived' }],
    ] as const) {
      const r = await call(method, url, payload);
      expect(r.statusCode, r.body).toBe(409);
      expect(r.json().code).toBe('CAMPAIGN_HAS_OPEN_WORK');
    }
    expect((await call('GET', `/campaigns/${campaign}`)).json().status).toBe('active');
    expect((await call('PATCH', `/campaigns/${id}`, { name: null })).statusCode).toBe(400);
    expect((await call('PATCH', `/campaigns/${id}`, { status: null })).statusCode).toBe(400);
  });
  it('enforces manage scope before replay and rechecks creation authority', async () => {
    const initial = await create(),
      id = initial.json().id,
      key = randomUUID();
    const [grant] = await db
      .insert(membershipResourceScopes)
      .values({
        tenantId: tenant,
        userId: outsider,
        role: 'manager',
        scopeType: 'campaign',
        campaignId: id,
        accessLevel: 'read_write',
      })
      .returning();
    expect(
      (await call('POST', `/campaigns/${id}/status`, { status: 'active' }, outsider, key))
        .statusCode,
    ).toBe(404);
    await db
      .update(membershipResourceScopes)
      .set({ accessLevel: 'manage' })
      .where(eq(membershipResourceScopes.id, grant!.id));
    expect(
      (await call('POST', `/campaigns/${id}/status`, { status: 'active' }, outsider, key))
        .statusCode,
    ).toBe(200);
    await db.delete(membershipResourceScopes).where(eq(membershipResourceScopes.id, grant!.id));
    expect(
      (await call('POST', `/campaigns/${id}/status`, { status: 'active' }, outsider, key))
        .statusCode,
    ).toBe(404);
    expect((await call('DELETE', `/campaigns/${foreignCampaign}`)).statusCode).toBe(404);
  });
  it('serializes late assignment insertion against archival and preserves a valid final state', async () => {
    const initial = await create(),
      id = initial.json().id,
      cp = randomUUID();
    expect((await call('POST', `/campaigns/${id}/status`, { status: 'active' })).statusCode).toBe(
      200,
    );
    await db
      .insert(campaignProspects)
      .values({ id: cp, tenantId: tenant, campaignId: id, establishmentId: places[0]! });
    const results = await Promise.allSettled([
      db.insert(campaignProspectAssignments).values({
        tenantId: tenant,
        campaignId: id,
        campaignProspectId: cp,
        organizationId: org,
        teamId: team,
        assignedUserId: member,
      }),
      call('DELETE', `/campaigns/${id}`),
    ]);
    const state = (await call('GET', `/campaigns/${id}`)).json();
    if (state.status === 'archived') {
      expect(results[0]!.status).toBe('rejected');
      expect(state.summary.activeAssignments).toBe(0);
    } else {
      expect(state.status).toBe('active');
      expect(state.summary.activeAssignments).toBe(1);
      expect(results[1]!.status === 'fulfilled' && results[1]!.value.statusCode).toBe(409);
    }
  });
  it('blocks each category of unresolved work independently before closing', async () => {
    const initial = await create(),
      id = initial.json().id,
      cp = randomUUID(),
      assignment = randomUUID();
    await call('POST', `/campaigns/${id}/status`, { status: 'active' });
    await db
      .insert(campaignProspects)
      .values({ id: cp, tenantId: tenant, campaignId: id, establishmentId: places[0]! });
    await db.insert(campaignProspectAssignments).values({
      id: assignment,
      tenantId: tenant,
      campaignId: id,
      campaignProspectId: cp,
      organizationId: org,
      teamId: team,
      assignedUserId: member,
      status: 'revoked',
      assignedAt: new Date(Date.now() - 60_000),
      endedAt: new Date(),
      endReason: 'Historical assignment',
    });
    const blocked = async () => {
      const r = await call('POST', `/campaigns/${id}/status`, { status: 'completed' });
      expect(r.statusCode, r.body).toBe(409);
      expect(r.json().code).toBe('CAMPAIGN_HAS_OPEN_WORK');
    };
    const [action] = await db
      .insert(actions)
      .values({
        tenantId: tenant,
        campaignId: id,
        campaignProspectId: cp,
        establishmentId: places[0]!,
        assignmentId: assignment,
        assigneeMembershipId: member,
        createdBy: member,
        type: 'task',
        subject: 'Unresolved action',
      })
      .returning();
    await blocked();
    await db
      .update(actions)
      .set({ status: 'cancelled', cancelledAt: new Date() })
      .where(eq(actions.id, action!.id));
    const [follow] = await db
      .insert(prospectFollowUps)
      .values({
        tenantId: tenant,
        campaignId: id,
        campaignProspectId: cp,
        establishmentId: places[0]!,
        assignmentId: assignment,
        assignedUserId: member,
        createdBy: member,
        dueAt: new Date(),
      })
      .returning();
    await blocked();
    await db
      .update(prospectFollowUps)
      .set({ status: 'cancelled', cancelledAt: new Date() })
      .where(eq(prospectFollowUps.id, follow!.id));
    const lease = randomUUID();
    await db.execute(
      sql`INSERT INTO reservation_records(id,tenant_id,campaign_id,campaign_prospect_id,establishment_id,owner_membership_id,lease,rule_snapshot,status,expires_at) VALUES(${lease},${tenant},${id},${cp},${places[0]},${member},'{}','{}','active',now()+interval '1 minute')`,
    );
    await blocked();
    await db
      .update(reservationRecords)
      .set({ status: 'released' })
      .where(eq(reservationRecords.id, lease));
    const collision = randomUUID();
    await db.execute(
      sql`INSERT INTO collision_events(id,tenant_id,campaign_id,campaign_prospect_id,establishment_id,assignment_id,detected_by,decision,reason_code,evaluation,policy_snapshot,expires_at) VALUES(${collision},${tenant},${id},${cp},${places[0]},${assignment},${member},'require_override','ACTIVE_ASSIGNMENT','{}','{}',now()+interval '1 minute')`,
    );
    const [request] = await db
      .insert(overrideRequests)
      .values({
        tenantId: tenant,
        collisionId: collision,
        campaignProspectId: cp,
        requestedBy: member,
        reason: 'Unresolved override request',
      })
      .returning();
    await blocked();
    await db
      .update(overrideRequests)
      .set({
        status: 'cancelled',
        decidedBy: member,
        decidedAt: new Date(),
        decisionReason: 'Cancelled test request',
      })
      .where(eq(overrideRequests.id, request!.id));
    expect(
      (await call('POST', `/campaigns/${id}/status`, { status: 'completed' })).statusCode,
    ).toBe(200);
  });
  it('rechecks configurable permission after the HTTP resource guard', async () => {
    const initial = await create(),
      id = initial.json().id;
    const [grant] = await db
      .insert(membershipResourceScopes)
      .values({
        tenantId: tenant,
        userId: outsider,
        role: 'manager',
        scopeType: 'campaign',
        campaignId: id,
        accessLevel: 'manage',
      })
      .returning();
    const scopes = app.get(ResourceScopeService),
      original = scopes.require.bind(scopes);
    const spy = vi.spyOn(scopes, 'require').mockImplementationOnce(async (...args) => {
      await original(...args);
      await db
        .insert(tenantRolePermissions)
        .values({ tenantId: tenant, role: 'manager', permissions: [] });
    });
    try {
      expect(
        (await call('POST', `/campaigns/${id}/status`, { status: 'active' }, outsider)).statusCode,
      ).toBe(403);
      expect((await call('GET', `/campaigns/${id}`)).json().status).toBe('draft');
    } finally {
      spy.mockRestore();
      await db.delete(tenantRolePermissions).where(eq(tenantRolePermissions.tenantId, tenant));
      await db.delete(membershipResourceScopes).where(eq(membershipResourceScopes.id, grant!.id));
    }
  });
  it('database guards reject new open work in a terminal campaign', async () => {
    const initial = await create(),
      id = initial.json().id,
      cp = randomUUID();
    await db
      .insert(campaignProspects)
      .values({ id: cp, tenantId: tenant, campaignId: id, establishmentId: places[0]! });
    expect((await call('DELETE', `/campaigns/${id}`)).statusCode).toBe(204);
    await expect(
      db.insert(campaignProspectAssignments).values({
        tenantId: tenant,
        campaignId: id,
        campaignProspectId: cp,
        organizationId: org,
        teamId: team,
        assignedUserId: member,
      }),
    ).rejects.toThrow();
  });
});
