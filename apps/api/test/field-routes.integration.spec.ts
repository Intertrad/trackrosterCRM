import { fieldRoutes } from '../src/database/schema/field-routes.js';
import { outcomeSettings } from '../src/database/schema/outcome-settings.js';
import { ActionEffectsService } from '../src/actions/action-effects.service.js';
import { ReservationRepository } from '../src/reservations/reservation.repository.js';
import {
  actions,
  actionEvents,
  actionOutcomes,
  actionEffects,
} from '../src/database/schema/actions.js';
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
  reservationRecords,
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
describe('Field routes', () => {
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
  const call = (
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
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
  beforeAll(async () => {
    app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
      logger: false,
      abortOnError: false,
    });
    await configureHttpApplication(app);
    await app.init();
    db = getSeedDatabase();
    app.get(ActionEffectsService).onModuleDestroy();
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
        latitude: 48.85,
        longitude: 2.35,
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
    vi.restoreAllMocks();
    await db.delete(fieldRoutes).where(eq(fieldRoutes.tenantId, tenantId));
    await db
      .update(establishments)
      .set({ latitude: 48.85, longitude: 2.35 })
      .where(eq(establishments.tenantId, tenantId));
    await db.delete(outcomeSettings).where(eq(outcomeSettings.tenantId, tenantId));
    await db
      .update(campaignProspects)
      .set({ lifecycleStage: 'to_contact' })
      .where(eq(campaignProspects.tenantId, tenantId));
    const repo = app.get(ReservationRepository);
    const reservation = await repo.findCurrent(tenantId, campaign, prospect);
    if (reservation) {
      await repo.releaseOrganizationScoped(
        tenantId,
        campaign,
        prospect,
        org,
        establishment,
        reservation.reservationId,
      );
    }
    for (const t of [reservationRecords, actionEffects, actionEvents, actionOutcomes, actions])
      await db.delete(t).where(eq(t.tenantId, tenantId));
    for (const t of [contactConsents, prospectActivities, prospectFollowUps])
      await db.delete(t).where(eq(t.tenantId, tenantId));
    // Ended ownership is immutable. Recreate this disposable fixture only after
    // all test-owned dependent rows have been deleted; never reopen history.
    const [base] = await db
      .select()
      .from(campaignProspectAssignments)
      .where(eq(campaignProspectAssignments.id, assignment));
    if (base?.endedAt) {
      await db
        .delete(campaignProspectAssignments)
        .where(eq(campaignProspectAssignments.id, assignment));
      await db
        .insert(campaignProspectAssignments)
        .values({ ...base, endedAt: null, status: 'active', endReason: null });
    }
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

  const createRoute = async (body: object = {}, key: string = randomUUID()) =>
    call(
      'POST',
      '/routes',
      {
        teamId: team,
        name: 'Morning visits',
        scheduledAt: new Date().toISOString(),
        startPoint: { latitude: 48.8, longitude: 2.3 },
        ...body,
      },
      member,
      key,
    );
  const add = async (id: string, body: object = {}) =>
    call('POST', `/routes/${id}/stops`, { campaignProspectId: prospect, ...body }, member);
  it('creates, paginates and shows the current local-day route in the today dashboard', async () => {
    const route = await createRoute();
    expect(route.statusCode, route.body).toBe(201);
    const id = route.json().id;
    expect((await add(id)).statusCode).toBe(200);
    const dashboard = await call(
      'GET',
      `/dashboard/today?teamId=${team}&timeZone=Europe/Paris`,
      undefined,
      member,
    );
    expect(dashboard.statusCode, dashboard.body).toBe(200);
    expect(dashboard.json().routeSummary.items[0].id).toBe(id);
    expect(dashboard.json().routeSummary.items[0].metrics.stopCount).toBe(1);
    const tomorrow = await createRoute({
      scheduledAt: new Date(Date.now() + 172800000).toISOString(),
    });
    expect(tomorrow.statusCode).toBe(201);
    const today = (
      await call('GET', `/dashboard/today?teamId=${team}&timeZone=Europe/Paris`, undefined, member)
    ).json();
    expect(today.routeSummary.items).toHaveLength(1);
    const page = (await call('GET', '/routes?limit=1', undefined, member)).json();
    expect(page.nextCursor).toBeTruthy();
    expect(
      (await call('GET', `/routes?limit=1&cursor=${page.nextCursor}`, undefined, member)).json()
        .items,
    ).toHaveLength(1);
    expect((await call('GET', `/routes/${id}`, undefined, foreign)).statusCode).toBe(404);
    expect((await call('GET', `/routes/${id}`, undefined, outsider)).statusCode).toBe(404);
    expect((await call('PATCH', `/routes/${id}`, { name: 'Changed' }, admin)).statusCode).toBe(404);
  });
  it('executes sequential stops and finalizes immutable routes with idempotent transitions', async () => {
    const route = (await createRoute()).json();
    const added = (await add(route.id)).json();
    const stop = added.stops[0];
    expect(
      (await call('PATCH', `/route-stops/${stop.id}`, { status: 'arrived' }, member)).statusCode,
    ).toBe(409);
    expect((await call('POST', `/routes/${route.id}/start`, {}, member)).statusCode).toBe(200);
    expect((await call('POST', `/routes/${route.id}/complete`, {}, member)).statusCode).toBe(409);
    expect(
      (
        await call(
          'PATCH',
          `/route-stops/${stop.id}`,
          { status: 'completed', outcome: 'Visited' },
          member,
        )
      ).statusCode,
    ).toBe(409);
    expect(
      (await call('PATCH', `/route-stops/${stop.id}`, { status: 'arrived' }, member)).statusCode,
    ).toBe(200);
    expect(
      (
        await call(
          'PATCH',
          `/route-stops/${stop.id}`,
          { status: 'completed', outcome: 'Visit recorded' },
          member,
        )
      ).statusCode,
    ).toBe(200);
    const key = randomUUID();
    expect((await call('POST', `/routes/${route.id}/complete`, {}, member, key)).statusCode).toBe(
      200,
    );
    expect((await call('POST', `/routes/${route.id}/complete`, {}, member, key)).statusCode).toBe(
      200,
    );
    expect(
      (await call('PATCH', `/routes/${route.id}`, { name: 'Reopened' }, member)).statusCode,
    ).toBe(409);
  });
  it('rejects missing coordinates, stale versions, duplicate prospects and invalid stop order', async () => {
    const route = (await createRoute()).json();
    await db
      .update(establishments)
      .set({ latitude: null, longitude: null })
      .where(eq(establishments.id, establishment));
    expect((await add(route.id)).statusCode).toBe(409);
    await db
      .update(establishments)
      .set({ latitude: 48.85, longitude: 2.35 })
      .where(eq(establishments.id, establishment));
    const added = await add(route.id);
    expect(added.statusCode).toBe(200);
    expect((await add(route.id)).statusCode).toBe(409);
    expect(
      (await call('PUT', `/routes/${route.id}/stop-order`, { stopIds: [randomUUID()] }, member))
        .statusCode,
    ).toBe(400);
    const stale = await app.inject({
      method: 'PATCH',
      url: `/api/v1/routes/${route.id}`,
      payload: { name: 'Stale' },
      headers: {
        authorization: `Bearer ${tokens.get(member)}`,
        'idempotency-key': randomUUID(),
        'if-match': route.etag,
      },
    });
    expect(stale.statusCode).toBe(412);
    const optimized = await call('POST', `/routes/${route.id}/optimize`, {}, member);
    expect(optimized.statusCode, optimized.body).toBe(200);
    expect(optimized.json().metrics.distanceBasis).toBe('great_circle');
    const stop = added.json().stops[0];
    expect((await call('DELETE', `/route-stops/${stop.id}`, undefined, member)).statusCode).toBe(
      200,
    );
    expect((await call('DELETE', `/routes/${route.id}`, undefined, member)).json().status).toBe(
      'cancelled',
    );
  });
  it('rechecks consent and ownership at start while allowing skips for blocked live stops', async () => {
    const route = (await createRoute()).json();
    const stop = (await add(route.id)).json().stops[0];
    await db.insert(contactConsents).values({
      tenantId,
      prospectId: establishment,
      channel: 'visit',
      status: 'blocked',
      reason: 'No visits',
      recordedBy: member,
    });
    expect((await call('POST', `/routes/${route.id}/start`, {}, member)).statusCode).toBe(409);
    await db.delete(contactConsents).where(eq(contactConsents.tenantId, tenantId));
    expect((await call('POST', `/routes/${route.id}/start`, {}, member)).statusCode).toBe(200);
    await db.insert(contactConsents).values({
      tenantId,
      prospectId: establishment,
      channel: 'visit',
      status: 'blocked',
      reason: 'No visits',
      recordedBy: member,
    });
    expect(
      (await call('PATCH', `/route-stops/${stop.id}`, { status: 'arrived' }, member)).statusCode,
    ).toBe(409);
    expect(
      (
        await call(
          'PATCH',
          `/route-stops/${stop.id}`,
          { status: 'skipped', outcome: 'Visit opposition' },
          member,
        )
      ).statusCode,
    ).toBe(200);
  });
  it('serializes competing route starts and checks authorization before cached writes', async () => {
    const first = (await createRoute()).json(),
      second = (await createRoute()).json();
    await add(first.id);
    await add(second.id);
    const results = await Promise.all([
      call('POST', `/routes/${first.id}/start`, {}, member),
      call('POST', `/routes/${second.id}/start`, {}, member),
    ]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    const draft = results[0]!.statusCode === 409 ? first : second;
    const key = randomUUID();
    expect(
      (await call('PATCH', `/routes/${draft.id}`, { name: 'Updated' }, member, key)).statusCode,
    ).toBe(200);
    await db
      .delete(userAccessGrants)
      .where(and(eq(userAccessGrants.tenantId, tenantId), eq(userAccessGrants.userId, member)));
    try {
      expect(
        (await call('PATCH', `/routes/${draft.id}`, { name: 'Updated' }, member, key)).statusCode,
      ).toBe(404);
    } finally {
      await db.insert(userAccessGrants).values({
        tenantId,
        userId: member,
        role: 'prospector',
        scopeType: 'team',
        organizationId: org,
        teamId: team,
      });
    }
  });
  it('reorders multiple stops atomically, clears stale ETAs and serializes conditional edits', async () => {
    const extra = randomUUID();
    await db.insert(campaignProspectAssignments).values({
      id: extra,
      tenantId,
      campaignId: otherCampaign,
      campaignProspectId: otherProspect,
      organizationId: org,
      teamId: team,
      assignedUserId: member,
    });
    try {
      const route = (await createRoute()).json();
      await add(route.id);
      const added = (await add(route.id, { campaignProspectId: otherProspect })).json();
      const ids = added.stops.map((s: { id: string }) => s.id).reverse();
      const ordered = await call('PUT', `/routes/${route.id}/stop-order`, { stopIds: ids }, member);
      expect(ordered.statusCode, ordered.body).toBe(200);
      expect(ordered.json().stops.map((s: { id: string }) => s.id)).toEqual(ids);
      await call(
        'PATCH',
        `/route-stops/${ids[0]}`,
        { eta: new Date(Date.now() + 3600000).toISOString() },
        member,
      );
      const current = (await call('GET', `/routes/${route.id}`, undefined, member)).json();
      const mutate = () =>
        app.inject({
          method: 'PATCH',
          url: `/api/v1/routes/${route.id}`,
          payload: { startPoint: { latitude: 48.7, longitude: 2.2 } },
          headers: {
            authorization: `Bearer ${tokens.get(member)}`,
            'idempotency-key': randomUUID(),
            'if-match': current.etag,
          },
        });
      const results = await Promise.all([mutate(), mutate()]);
      expect(results.map((r) => r.statusCode).sort()).toEqual([200, 412]);
      expect(
        (await call('GET', `/routes/${route.id}`, undefined, member))
          .json()
          .stops.every((s: { eta: string | null }) => s.eta === null),
      ).toBe(true);
      await call('POST', `/routes/${route.id}/start`, {}, member);
      expect(
        (await call('PATCH', `/route-stops/${ids[1]}`, { status: 'arrived' }, member)).statusCode,
      ).toBe(409);
    } finally {
      await db.delete(campaignProspectAssignments).where(eq(campaignProspectAssignments.id, extra));
    }
  });
  it('requires linked visit completion and rejects action/prospect mismatches', async () => {
    const task = await call(
      'POST',
      '/actions',
      { campaignId: campaign, campaignProspectId: prospect, type: 'task', subject: 'Task' },
      member,
    );
    const route = (await createRoute()).json();
    expect((await add(route.id, { actionId: task.json().id })).statusCode).toBe(409);
    const visit = await call(
      'POST',
      '/actions',
      { campaignId: campaign, campaignProspectId: prospect, type: 'visit', subject: 'Visit' },
      member,
    );
    const added = await add(route.id, { actionId: visit.json().id });
    expect(added.statusCode, added.body).toBe(200);
    const stop = added.json().stops[0];
    await call('POST', `/routes/${route.id}/start`, {}, member);
    await call('PATCH', `/route-stops/${stop.id}`, { status: 'arrived' }, member);
    expect(
      (
        await call(
          'PATCH',
          `/route-stops/${stop.id}`,
          { status: 'completed', outcome: 'Done' },
          member,
        )
      ).statusCode,
    ).toBe(409);
    expect((await call('POST', `/actions/${visit.json().id}/start`, {}, member)).statusCode).toBe(
      200,
    );
    expect(
      (
        await call(
          'POST',
          `/actions/${visit.json().id}/complete`,
          { outcomeCode: 'do_not_contact' },
          member,
        )
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await call(
          'PATCH',
          `/route-stops/${stop.id}`,
          { status: 'completed', outcome: 'Visit logged' },
          member,
        )
      ).statusCode,
    ).toBe(200);
  });
});
