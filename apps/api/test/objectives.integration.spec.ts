import { objectives } from '../src/database/schema/objectives.js';
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
import { DATABASE } from '../src/database/database.constants.js';
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
describe('Objectives and director risk', () => {
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
    method: 'GET' | 'POST' | 'PATCH',
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
    db = app.get(DATABASE);
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
    await db.delete(objectives).where(eq(objectives.tenantId, tenantId));
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

  const createObjective = (body: object = {}, actor = admin, key: string = randomUUID()) =>
    call(
      'POST',
      '/objectives',
      {
        organizationId: org,
        name: 'Campaign target',
        metric: 'completed_actions',
        target: 10,
        startsAt: new Date(Date.now() - 86400000).toISOString(),
        endsAt: new Date(Date.now() + 86400000).toISOString(),
        ...body,
      },
      actor,
      key,
    );
  it('creates scoped objectives with progress, contribution history and director risk', async () => {
    const created = await createObjective();
    expect(created.statusCode, created.body).toBe(201);
    const objective = created.json();
    const detail = await call('GET', `/objectives/${objective.id}`);
    expect(detail.statusCode, detail.body).toBe(200);
    expect(detail.json().progress.status).toBe('at_risk');
    expect(detail.json().history).toHaveLength(1);
    const risk = await call('GET', '/objectives/at-risk');
    expect(risk.statusCode, risk.body).toBe(200);
    expect(risk.json().items[0].id).toBe(objective.id);
    const dashboard = await call('GET', '/dashboard/director');
    expect(dashboard.statusCode, dashboard.body).toBe(200);
    expect(dashboard.json().objectiveRisks.available).toBe(true);
    expect(dashboard.json().objectiveRisks.items[0].id).toBe(objective.id);
    expect((await call('GET', `/objectives/${objective.id}`, undefined, foreign)).statusCode).toBe(
      404,
    );
    expect((await call('GET', '/objectives/at-risk', undefined, foreign)).json().items).toEqual([]);
    expect((await call('GET', `/objectives/${objective.id}`, undefined, member)).statusCode).toBe(
      404,
    );
  });
  it('derives actuals from immutable completion semantics and deduplicates converted prospects', async () => {
    const now = new Date();
    const ids = [randomUUID(), randomUUID()];
    for (const id of ids) {
      await db.insert(actions).values({
        id,
        tenantId,
        campaignId: campaign,
        campaignProspectId: prospect,
        establishmentId: establishment,
        assignmentId: assignment,
        assigneeMembershipId: member,
        createdBy: member,
        type: 'visit',
        status: 'completed',
        subject: 'Completed visit',
        startedAt: now,
        completedAt: now,
      });
      await db
        .insert(actionOutcomes)
        .values({ tenantId, actionId: id, outcomeCode: 'custom_win', recordedBy: member });
      await db.insert(actionEvents).values({
        tenantId,
        actionId: id,
        eventType: 'complete',
        actorMembershipId: member,
        data: { outcomeDefinition: { code: 'custom_win', behavior: 'converted', label: 'Won' } },
      });
    }
    const goal = (
      await createObjective({ metric: 'converted_prospects', target: 2, campaignId: campaign })
    ).json();
    const detail = await call('GET', `/objectives/${goal.id}`);
    expect(detail.statusCode, detail.body).toBe(200);
    expect(detail.json().progress.actual).toBe(1);
    expect(detail.json().progressHistory[0].cumulative).toBe(1);
    const visits = (await createObjective({ metric: 'completed_visits', target: 2 })).json();
    const done = (await call('GET', `/objectives/${visits.id}`)).json();
    expect(done.progress.actual).toBe(2);
    expect(done.progress.status).toBe('achieved');
    const other = (await createObjective({ campaignId: otherCampaign })).json();
    expect((await call('GET', `/objectives/${other.id}`)).json().progress.actual).toBe(0);
    expect(
      (await call('GET', '/objectives/at-risk'))
        .json()
        .items.some((o: { id: string }) => o.id === visits.id),
    ).toBe(false);
  });
  it('limits edits to future objectives, protects versions and records definition history', async () => {
    const future = (
      await createObjective({
        startsAt: new Date(Date.now() + 86400000).toISOString(),
        endsAt: new Date(Date.now() + 172800000).toISOString(),
      })
    ).json();
    expect((await call('PATCH', `/objectives/${future.id}`, { target: 20 })).statusCode).toBe(200);
    const stale = await app.inject({
      method: 'PATCH',
      url: `/api/v1/objectives/${future.id}`,
      payload: { target: 30 },
      headers: {
        authorization: `Bearer ${tokens.get(admin)}`,
        'idempotency-key': randomUUID(),
        'if-match': future.etag,
      },
    });
    expect(stale.statusCode).toBe(412);
    expect((await call('GET', `/objectives/${future.id}`)).json().history).toHaveLength(2);
    const active = (await createObjective()).json();
    expect((await call('PATCH', `/objectives/${active.id}`, { target: 30 })).statusCode).toBe(409);
    expect((await createObjective({ target: 0 })).statusCode).toBe(400);
    expect(
      (await createObjective({ endsAt: new Date(Date.now() - 172800000).toISOString() }))
        .statusCode,
    ).toBe(400);
    expect((await createObjective({ campaignId: randomUUID() })).statusCode).toBe(404);
  });
  it('allows manager team targets while keeping directors read-only and checking replay permissions', async () => {
    await db.insert(userAccessGrants).values({
      tenantId,
      userId: outsider,
      role: 'manager',
      scopeType: 'team',
      organizationId: org,
      teamId: team,
    });
    try {
      expect((await createObjective({}, outsider)).statusCode).toBe(404);
      const key = randomUUID(),
        payload = { teamId: team };
      const created = await createObjective(payload, outsider, key);
      expect(created.statusCode, created.body).toBe(201);
      await db
        .delete(userAccessGrants)
        .where(and(eq(userAccessGrants.tenantId, tenantId), eq(userAccessGrants.userId, outsider)));
      await db.insert(userAccessGrants).values({
        tenantId,
        userId: outsider,
        role: 'director',
        scopeType: 'organization',
        organizationId: org,
      });
      expect(
        (await call('GET', `/objectives/${created.json().id}`, undefined, outsider)).statusCode,
      ).toBe(200);
      expect((await createObjective(payload, outsider, key)).statusCode).toBe(404);
      expect(
        (await call('PATCH', `/objectives/${created.json().id}`, { target: 12 }, outsider))
          .statusCode,
      ).toBe(404);
    } finally {
      await db
        .delete(userAccessGrants)
        .where(and(eq(userAccessGrants.tenantId, tenantId), eq(userAccessGrants.userId, outsider)));
    }
  });
  it('uses half-open periods and returns a globally risk-ranked bounded list', async () => {
    const started = new Date(Date.now() - 86400000),
      ended = new Date(Date.now() + 86400000);
    const future = (
      await createObjective({
        startsAt: ended.toISOString(),
        endsAt: new Date(Date.now() + 172800000).toISOString(),
      })
    ).json();
    await createObjective({ startsAt: started.toISOString(), endsAt: ended.toISOString() });
    await createObjective({ startsAt: started.toISOString(), endsAt: ended.toISOString() });
    const risks = (await call('GET', '/objectives/at-risk?limit=1')).json();
    expect(risks.total).toBe(2);
    expect(risks.truncated).toBe(true);
    expect(risks.items[0].id).not.toBe(future.id);
    const first = (await call('GET', '/objectives?limit=1')).json();
    expect(first.nextCursor).toBeTruthy();
    expect(
      (await call('GET', `/objectives?limit=1&cursor=${first.nextCursor}`)).json().items[0].id,
    ).not.toBe(first.items[0].id);
  });
  it('counts period contributions at the inclusive start and excludes past/future records', async () => {
    const start = new Date(Date.now() - 86400000),
      end = new Date(Date.now() + 86400000);
    const goal = (
      await createObjective({
        metric: 'completed_follow_ups',
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
      })
    ).json();
    for (const completedAt of [
      start,
      new Date(start.getTime() - 1),
      new Date(Date.now() + 3600000),
      end,
    ])
      await db.insert(prospectFollowUps).values({
        tenantId,
        campaignId: campaign,
        campaignProspectId: prospect,
        establishmentId: establishment,
        assignmentId: assignment,
        assignedUserId: member,
        createdBy: member,
        dueAt: start,
        status: 'completed',
        completedAt,
      });
    const result = await call('GET', `/objectives/${goal.id}`);
    expect(result.statusCode, result.body).toBe(200);
    expect(result.json().progress.actual).toBe(1);
    expect(result.json().progressHistory[0].count).toBe(1);
    expect((await createObjective({ ownerId: outsider })).statusCode).toBe(404);
  });
});
