import { ActionEffectsService } from '../src/actions/action-effects.service.js';
import { ReservationLedgerService } from '../src/reservations/reservation-ledger.service.js';
import { RedisService } from '../src/redis/redis.service.js';
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
  reservationRules,
  reservationIntents,
  reservationRecords,
  reservationEvents,
  collisionEvents,
  overrideRequests,
  collisionOverrides,
  tenantRolePermissions,
  organizationCoordinationPolicies,
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
  notificationDeliveries,
  notifications,
} from '../src/database/schema/index.js';
import { PasswordService } from '../src/auth/password.service.js';
describe('Reservation rules, lifecycle and durable evidence', () => {
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
  const extraGrant = randomUUID(),
    extraAssignment = randomUUID(),
    policyOrg = randomUUID();
  const actors = [admin, member, outsider, foreign],
    tokens = new Map<string, string>();
  const path = `/prospects/${establishment}/consents`;
  const call = (
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
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
      { id: policyOrg, tenantId, name: policyOrg, slug: policyOrg },
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
    vi.restoreAllMocks();
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
    const otherLease = await repo.findCurrent(tenantId, otherCampaign, otherProspect);
    if (otherLease)
      await repo.releaseOrganizationScoped(
        tenantId,
        otherCampaign,
        otherProspect,
        otherLease.organizationId,
        establishment,
        otherLease.reservationId,
      );
    for (const t of [
      reservationRecords,
      reservationIntents,
      reservationRules,
      overrideRequests,
      collisionEvents,
      collisionOverrides,
      tenantRolePermissions,
    ])
      await db.delete(t).where(eq(t.tenantId, tenantId));
    await db
      .delete(userAccessGrants)
      .where(and(eq(userAccessGrants.tenantId, tenantId), eq(userAccessGrants.id, extraGrant)));
    for (const t of [actionEffects, actionEvents, actionOutcomes, actions])
      await db.delete(t).where(eq(t.tenantId, tenantId));
    for (const t of [contactConsents, prospectActivities, prospectFollowUps])
      await db.delete(t).where(eq(t.tenantId, tenantId));
    await db
      .delete(organizationCoordinationPolicies)
      .where(eq(organizationCoordinationPolicies.tenantId, tenantId));
    await db
      .delete(campaignProspectAssignments)
      .where(eq(campaignProspectAssignments.id, extraAssignment));
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
        notificationDeliveries,
        notifications,
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
  const claim = (body: object = {}, key = randomUUID()) =>
    call(
      'POST',
      '/reservations/claim',
      { campaignId: campaign, campaignProspectId: prospect, ...body },
      member,
      key,
    );
  const mutate = (id: string, op: string, body: object = {}, key = randomUUID(), actor = member) =>
    call('POST', `/reservations/${id}/${op}`, body, actor, key);
  const rule = (body: object = {}) =>
    call('POST', '/reservation-rules', {
      durationMinutes: 1,
      maxHoldMinutes: 5,
      cooldownMinutes: 0,
      ...body,
    });
  const release = (id: string) => mutate(id, 'release', { reason: 'Finished prospect work' });
  const recent = () =>
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
  it('claims once, lists scoped records and exposes durable immutable evidence', async () => {
    const key = randomUUID();
    const first = await claim({}, key);
    expect(first.statusCode, first.body).toBe(201);
    const id = first.json().reservationId;
    expect(first.json().claimToken).toBe(id);
    expect((await claim({}, key)).json()).toEqual(first.json());
    const records = await db
      .select()
      .from(reservationRecords)
      .where(eq(reservationRecords.tenantId, tenantId));
    expect(records).toHaveLength(1);
    expect(records[0]!.status).toBe('active');
    const detail = await call('GET', `/reservations/${id}`, undefined, member);
    expect(detail.statusCode, detail.body).toBe(200);
    expect(detail.json().events.map((e: { type: string }) => e.type)).toContain('claimed');
    for (const actor of [outsider, foreign]) {
      expect((await call('GET', `/reservations/${id}`, undefined, actor)).statusCode).toBe(404);
      expect((await call('GET', '/reservations', undefined, actor)).json().items).toEqual([]);
    }
    expect(
      (await call('GET', '/reservations?status=active&limit=1', undefined, member)).json().items,
    ).toHaveLength(1);
    await expect(
      db
        .update(reservationEvents)
        .set({ type: 'fake' })
        .where(eq(reservationEvents.reservationId, id)),
    ).rejects.toThrow();
    await expect(
      db
        .insert(reservationEvents)
        .values({ tenantId: foreignTenantId, reservationId: id, type: 'fake' }),
    ).rejects.toThrow();
  });
  it('restricts rule administration and validates bounds, duplicate scopes and ETags', async () => {
    expect((await call('POST', '/reservation-rules', {}, member)).statusCode).toBe(403);
    expect((await rule({ durationMinutes: 5, maxHoldMinutes: 1 })).statusCode).toBe(400);
    expect((await rule({ durationMinutes: null })).statusCode).toBe(400);
    expect((await call('POST', '/reservation-rules', { maxHoldMinutes: 1 })).statusCode).toBe(400);
    const r = await rule();
    expect(r.statusCode, r.body).toBe(201);
    const id = r.json().id;
    expect((await rule()).statusCode).toBe(409);
    expect((await call('GET', `/reservation-rules/${id}`, undefined, foreign)).statusCode).toBe(
      404,
    );
    expect((await call('GET', '/reservation-rules')).json().items).toHaveLength(1);
    const stale = await app.inject({
      method: 'PATCH',
      url: `/api/v1/reservation-rules/${id}`,
      headers: {
        authorization: `Bearer ${tokens.get(admin)}`,
        'idempotency-key': randomUUID(),
        'if-match': '"stale"',
      },
      payload: { durationMinutes: 2 },
    });
    expect(stale.statusCode).toBe(412);
    expect(
      (await call('PATCH', `/reservation-rules/${id}`, { durationMinutes: 2 })).statusCode,
    ).toBe(200);
    expect((await call('DELETE', `/reservation-rules/${id}`)).statusCode).toBe(200);
    expect(
      (await call('PATCH', `/reservation-rules/${id}`, { durationMinutes: 3 })).statusCode,
    ).toBe(409);
    expect((await rule()).statusCode).toBe(201);
  });
  it('uses campaign rules over tenant defaults and falls back after deactivation', async () => {
    await rule({ durationMinutes: 2 });
    const scoped = await rule({ campaignId: campaign, durationMinutes: 3 });
    expect(scoped.statusCode, scoped.body).toBe(201);
    const first = (await claim()).json();
    expect(Date.parse(first.expiresAt) - Date.parse(first.acquiredAt)).toBe(180000);
    await release(first.reservationId);
    await call('DELETE', `/reservation-rules/${scoped.json().id}`);
    const next = (await claim()).json();
    expect(Date.parse(next.expiresAt) - Date.parse(next.acquiredAt)).toBe(120000);
  });
  it('applies configured cooldown to checks and legacy claims', async () => {
    await recent();
    const r = await rule({ cooldownMinutes: 60 });
    expect((await claim()).statusCode).toBe(409);
    await call('PATCH', `/reservation-rules/${r.json().id}`, { cooldownMinutes: 0 });
    const legacy = await call(
      'POST',
      `/campaigns/${campaign}/prospects/${prospect}/reservation`,
      {},
      member,
    );
    expect(legacy.statusCode, legacy.body).toBe(201);
    expect(Date.parse(legacy.json().expiresAt) - Date.parse(legacy.json().acquiredAt)).toBe(60000);
    expect(
      (await call('GET', `/reservations/${legacy.json().reservationId}`, undefined, member))
        .statusCode,
    ).toBe(200);
  });
  it('prevents exceptions through request and direct approval paths when disabled', async () => {
    await rule({ cooldownMinutes: 60, allowManagerOverride: false });
    await recent();
    const check = await call(
      'POST',
      '/reservations/check',
      { campaignId: campaign, campaignProspectId: prospect },
      member,
    );
    expect(check.statusCode, check.body).toBe(200);
    expect(check.json().overrideable).toBe(false);
    expect(
      (
        await call(
          'POST',
          `/collision-events/${check.json().collisionId}/override-request`,
          { reason: 'Please review the collision' },
          member,
        )
      ).statusCode,
    ).toBe(409);
    const direct = await call(
      'POST',
      `/campaigns/${campaign}/prospects/${prospect}/collision-overrides`,
      { prospectorUserId: member, reason: 'Manager has reviewed the request' },
    );
    expect(direct.statusCode, direct.body).toBe(409);
  });
  it('renews both Redis keys together and records confirmed heartbeat', async () => {
    await rule();
    const initial = (await claim()).json();
    const renewed = await mutate(initial.reservationId, 'heartbeat');
    expect(renewed.statusCode, renewed.body).toBe(200);
    expect(Date.parse(renewed.json().expiresAt)).toBeGreaterThan(Date.parse(initial.expiresAt));
    const repo = app.get(ReservationRepository);
    const exact = await repo.findCurrent(tenantId, campaign, prospect),
      pair = await repo.findCurrentByOrganizationEstablishment(tenantId, org, establishment);
    expect(exact!.expiresAt).toBe(pair!.expiresAt);
    expect(exact!.expiresAt).toBe(renewed.json().expiresAt);
    const events = (
      await call('GET', `/reservations/${initial.reservationId}`, undefined, member)
    ).json().events;
    expect(events.some((e: { type: string }) => e.type === 'heartbeat_confirmed')).toBe(true);
  });
  it('extends idempotently and honors maximum hold under concurrent requests', async () => {
    await rule({ maxHoldMinutes: 2 });
    const initial = (await claim()).json();
    const key = randomUUID();
    const first = await mutate(initial.reservationId, 'extend', { minutes: 1 }, key);
    expect(first.statusCode, first.body).toBe(200);
    expect((await mutate(initial.reservationId, 'extend', { minutes: 1 }, key)).json()).toEqual(
      first.json(),
    );
    expect(Date.parse(first.json().expiresAt) - Date.parse(initial.expiresAt)).toBe(60000);
    expect((await mutate(initial.reservationId, 'heartbeat')).statusCode).toBe(409);
    await release(initial.reservationId);
    const second = (await claim()).json();
    const race = await Promise.all([
      mutate(second.reservationId, 'extend', { minutes: 1 }),
      mutate(second.reservationId, 'extend', { minutes: 1 }),
    ]);
    expect(race.map((r) => r.statusCode).sort()).toEqual([200, 409]);
  });
  it('enforces renewal policy changes before cached replay', async () => {
    const r = await rule();
    const initial = (await claim()).json();
    const key = randomUUID();
    expect((await mutate(initial.reservationId, 'extend', { minutes: 1 }, key)).statusCode).toBe(
      200,
    );
    await call('PATCH', `/reservation-rules/${r.json().id}`, {
      allowExtension: false,
      allowHeartbeat: false,
    });
    expect((await mutate(initial.reservationId, 'extend', { minutes: 1 }, key)).statusCode).toBe(
      409,
    );
    expect((await mutate(initial.reservationId, 'heartbeat')).statusCode).toBe(409);
    expect((await release(initial.reservationId)).statusCode).toBe(200);
  });
  it('blocks renewal and claim replay after opposition but permits owned release', async () => {
    const key = randomUUID(),
      initial = (await claim({}, key)).json();
    await append();
    expect((await claim({}, key)).statusCode).toBe(409);
    expect((await mutate(initial.reservationId, 'heartbeat')).statusCode).toBe(409);
    expect((await release(initial.reservationId)).statusCode).toBe(200);
    expect(
      (
        await db
          .select()
          .from(reservationRecords)
          .where(eq(reservationRecords.id, initial.reservationId))
      )[0]!.status,
    ).toBe('released');
  });
  it('permits the original owner to release after reassignment without granting new access', async () => {
    const initial = (await claim()).json();
    await db
      .update(campaignProspectAssignments)
      .set({ endedAt: new Date() })
      .where(eq(campaignProspectAssignments.id, assignment));
    await db.insert(campaignProspectAssignments).values({
      id: extraAssignment,
      tenantId,
      campaignId: campaign,
      campaignProspectId: prospect,
      organizationId: org,
      teamId: team,
      assignedUserId: outsider,
    });
    expect((await mutate(initial.reservationId, 'heartbeat')).statusCode).toBe(404);
    expect(
      (await call('GET', `/reservations/${initial.reservationId}`, undefined, member)).statusCode,
    ).toBe(404);
    expect((await release(initial.reservationId)).statusCode).toBe(200);
  });
  it('never recreates a missing collision lock during heartbeat', async () => {
    const initial = (await claim()).json(),
      repo = app.get(ReservationRepository);
    await app
      .get(RedisService)
      .getClient()
      .del(repo.buildOrganizationCollisionKey(tenantId, org, establishment));
    expect((await mutate(initial.reservationId, 'heartbeat')).statusCode).toBe(409);
    expect(
      await repo.findCurrentByOrganizationEstablishment(tenantId, org, establishment),
    ).toBeNull();
    expect(
      (await call('GET', `/reservations/${initial.reservationId}`, undefined, member)).json()
        .status,
    ).toBe('lost');
  });
  it('preserves a replacement reservation when old tokens are retried', async () => {
    const old = (await claim()).json();
    await release(old.reservationId);
    const replacement = (await claim()).json();
    expect(replacement.reservationId).not.toBe(old.reservationId);
    expect((await mutate(old.reservationId, 'extend', { minutes: 1 })).statusCode).toBe(409);
    await release(old.reservationId);
    expect(
      (await app.get(ReservationRepository).findCurrent(tenantId, campaign, prospect))!
        .reservationId,
    ).toBe(replacement.reservationId);
  });
  it('fails before Redis on intent failure and recovers uncertain claim confirmation', async () => {
    const ledger = app.get(ReservationLedgerService),
      repo = app.get(ReservationRepository);
    const intent = vi
      .spyOn(ledger, 'prepare')
      .mockRejectedValueOnce(new Error('Intent database unavailable'));
    expect((await claim()).statusCode).toBe(503);
    expect(await repo.findCurrent(tenantId, campaign, prospect)).toBeNull();
    intent.mockRestore();
    const confirmed = vi
      .spyOn(ledger, 'confirm')
      .mockRejectedValueOnce(new Error('Confirmation database unavailable'));
    expect((await claim()).statusCode).toBe(503);
    confirmed.mockRestore();
    const live = await repo.findCurrent(tenantId, campaign, prospect);
    expect(live).not.toBeNull();
    const row = (
      await db
        .select()
        .from(reservationRecords)
        .where(eq(reservationRecords.id, live!.reservationId))
    )[0]!;
    expect(row.status).toBe('pending');
    const intents = await db
      .select()
      .from(reservationIntents)
      .where(eq(reservationIntents.id, live!.reservationId));
    expect(intents).toHaveLength(1);
    expect(intents[0]!.tenantId).toBe(tenantId);
    await ledger.reconcile();
    await ledger.reconcile();
    expect(
      (await call('GET', `/reservations/${live!.reservationId}`, undefined, member)).json().status,
    ).toBe('active');
    expect(
      await db
        .select()
        .from(reservationRecords)
        .where(eq(reservationRecords.id, live!.reservationId)),
    ).toHaveLength(1);
    const evidence = await db
      .select()
      .from(reservationEvents)
      .where(eq(reservationEvents.reservationId, live!.reservationId));
    expect(evidence.filter((event) => event.type === 'claim_requested')).toHaveLength(1);
    expect(evidence.filter((event) => event.type === 'live_state_observed')).toHaveLength(1);
  });
  it('records observed expiry once and retains it in the prospect timeline', async () => {
    const initial = (await claim()).json(),
      repo = app.get(ReservationRepository);
    await repo.releaseOrganizationScoped(
      tenantId,
      campaign,
      prospect,
      org,
      establishment,
      initial.reservationId,
    );
    await db
      .update(reservationRecords)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(reservationRecords.id, initial.reservationId));
    const ledger = app.get(ReservationLedgerService);
    await ledger.refresh(tenantId, initial.reservationId);
    await ledger.refresh(tenantId, initial.reservationId);
    const detail = (
      await call('GET', `/reservations/${initial.reservationId}`, undefined, member)
    ).json();
    expect(detail.status).toBe('expired');
    expect(
      detail.events.filter((e: { type: string }) => e.type === 'expiry_observed'),
    ).toHaveLength(1);
    const timeline = (
      await call('GET', `/prospects/${establishment}/timeline`, undefined, member)
    ).json().items;
    expect(
      timeline.some(
        (e: { kind: string; data: { type?: string } }) =>
          e.kind === 'reservation_evidence' && e.data.type === 'expiry_observed',
      ),
    ).toBe(true);
  });
  it('distinguishes unexplained disappearance from confirmed release or expiry', async () => {
    const initial = (await claim()).json();
    await app
      .get(ReservationRepository)
      .releaseOrganizationScoped(
        tenantId,
        campaign,
        prospect,
        org,
        establishment,
        initial.reservationId,
      );
    const detail = (
      await call('GET', `/reservations/${initial.reservationId}`, undefined, member)
    ).json();
    expect(detail.status).toBe('lost');
    expect(detail.events.some((e: { type: string }) => e.type === 'absence_observed')).toBe(true);
  });
  it('records action-driven release as confirmed rather than unexplained absence', async () => {
    const action = await call(
      'POST',
      '/actions',
      {
        campaignId: campaign,
        campaignProspectId: prospect,
        type: 'call',
        subject: 'Call customer',
      },
      member,
    );
    const id = action.json().id;
    const start = await call('POST', `/actions/${id}/start`, {}, member);
    expect(start.statusCode, start.body).toBe(200);
    const complete = await call(
      'POST',
      `/actions/${id}/complete`,
      { outcomeCode: 'contacted' },
      member,
    );
    expect(complete.statusCode, complete.body).toBe(200);
    await app.get(ActionEffectsService).drain();
    const row = (
      await db
        .select()
        .from(reservationRecords)
        .where(eq(reservationRecords.id, start.json().reservationId))
    )[0]!;
    expect(row.status).toBe('released');
  });
  it('recovers renewed expiry when Redis succeeded but confirmation failed', async () => {
    await rule();
    const initial = (await claim()).json();
    const ledger = app.get(ReservationLedgerService);
    const confirmation = vi
      .spyOn(ledger, 'confirm')
      .mockRejectedValueOnce(new Error('Confirmation unavailable'));
    expect((await mutate(initial.reservationId, 'extend', { minutes: 1 })).statusCode).toBe(500);
    confirmation.mockRestore();
    const live = (await app.get(ReservationRepository).findCurrent(tenantId, campaign, prospect))!;
    expect(Date.parse(live.expiresAt) - Date.parse(initial.expiresAt)).toBe(60000);
    const detail = (
      await call('GET', `/reservations/${initial.reservationId}`, undefined, member)
    ).json();
    expect(detail.expiresAt).toBe(live.expiresAt);
    expect(detail.events.some((e: { type: string }) => e.type === 'live_state_observed')).toBe(
      true,
    );
  });
  it('refuses renewal when coordination changes introduce another live lock', async () => {
    const [a, b] = [org, policyOrg].sort();
    const [policy] = await db
      .insert(organizationCoordinationPolicies)
      .values({ tenantId, organizationAId: a!, organizationBId: b!, policy: 'independent' })
      .returning();
    const initial = (await claim()).json();
    const now = new Date();
    const repo = app.get(ReservationRepository);
    expect(
      await repo.acquireWithinOrganizationScope(
        {
          reservationId: randomUUID(),
          tenantId,
          organizationId: policyOrg,
          campaignId: otherCampaign,
          campaignProspectId: otherProspect,
          establishmentId: establishment,
          assignmentId: randomUUID(),
          teamId: team,
          userId: outsider,
          acquiredAt: now.toISOString(),
          expiresAt: new Date(now.getTime() + 600000).toISOString(),
        },
        [policyOrg],
        600,
      ),
    ).toBe(true);
    await db
      .update(organizationCoordinationPolicies)
      .set({ policy: 'shared' })
      .where(eq(organizationCoordinationPolicies.id, policy!.id));
    expect((await mutate(initial.reservationId, 'extend', { minutes: 1 })).statusCode).toBe(409);
    expect((await repo.findCurrent(tenantId, campaign, prospect))!.expiresAt).toBe(
      initial.expiresAt,
    );
  });
  it('does not install an expired lease after a delayed database preparation', async () => {
    const past = new Date(Date.now() - 60000),
      repo = app.get(ReservationRepository);
    const lease = {
      reservationId: randomUUID(),
      tenantId,
      organizationId: org,
      campaignId: campaign,
      campaignProspectId: prospect,
      establishmentId: establishment,
      assignmentId: assignment,
      teamId: team,
      userId: member,
      acquiredAt: new Date(past.getTime() - 60000).toISOString(),
      expiresAt: past.toISOString(),
    };
    expect(await repo.acquireWithinOrganizationScope(lease, [org], 60)).toBe(false);
    expect(await repo.findCurrent(tenantId, campaign, prospect)).toBeNull();
  });
});
