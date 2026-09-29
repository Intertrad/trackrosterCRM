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
describe('Canonical follow-ups and dashboards', () => {
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
  const followUp = async (values: object = {}) => {
    const [row] = await db
      .insert(prospectFollowUps)
      .values({
        tenantId,
        campaignId: campaign,
        campaignProspectId: prospect,
        establishmentId: establishment,
        assignmentId: assignment,
        assignedUserId: member,
        createdBy: member,
        dueAt: new Date(Date.now() + 86400000),
        ...values,
      })
      .returning();
    return row!;
  };
  it('exposes scoped canonical dashboards and explicit unavailable dependencies', async () => {
    await followUp();
    const today = await call(
      'GET',
      `/dashboard/today?teamId=${team}&timeZone=Europe/Paris`,
      undefined,
      member,
    );
    expect(today.statusCode, today.body).toBe(200);
    expect(today.json().routeSummary.available).toBe(true);
    const manager = await call('GET', '/dashboard/manager', undefined, admin);
    expect(manager.statusCode, manager.body).toBe(200);
    expect(manager.json().workload.items[0].current).toBe(1);
    const director = await call('GET', '/dashboard/director', undefined, admin);
    expect(director.statusCode, director.body).toBe(200);
    expect(director.json().organizationComparison.items[0].organizationId).toBe(org);
    const administrative = await call('GET', '/dashboard/admin', undefined, admin);
    expect(administrative.statusCode, administrative.body).toBe(200);
    expect(administrative.json().metrics.activeMembers).toBe(3);
    expect(administrative.json().metrics.totalEstablishments).toBe(2);
    expect(administrative.json().activityByDay).toHaveLength(14);
    expect(administrative.json().activityTimeZone).toBe('Europe/Paris');
    expect(
      administrative
        .json()
        .activityByDay.every(
          (day: { date: string; total: number }) =>
            /^\d{4}-\d{2}-\d{2}$/.test(day.date) && Number.isInteger(day.total) && day.total >= 0,
        ),
    ).toBe(true);
    expect((await call('GET', '/dashboard/director', undefined, member)).statusCode).toBe(403);
    expect((await call('GET', '/dashboard/admin', undefined, member)).statusCode).toBe(403);
    expect(
      (await call('GET', `/dashboard/manager?organizationId=${org}`, undefined, foreign))
        .statusCode,
    ).not.toBe(200);
    const other = (await call('GET', '/dashboard/admin', undefined, foreign)).json();
    expect(other.metrics.activeMembers).toBe(1);
    expect(other.metrics.totalEstablishments).toBe(0);
    expect(other.metrics.contactedEstablishments).toBe(0);
    expect(other.activityByDay.every((day: { total: number }) => day.total === 0)).toBe(true);
  });
  it('limits managers to their team and directors to explicitly authorized organizations', async () => {
    const otherTeam = randomUUID(),
      otherAssignment = randomUUID();
    await db.insert(teams).values({
      id: otherTeam,
      tenantId,
      organizationId: org,
      name: 'Other team',
      slug: otherTeam,
    });
    await db.insert(campaignProspectAssignments).values({
      id: otherAssignment,
      tenantId,
      campaignId: otherCampaign,
      campaignProspectId: otherProspect,
      organizationId: org,
      teamId: otherTeam,
    });
    await db.insert(userAccessGrants).values({
      tenantId,
      userId: outsider,
      role: 'manager',
      scopeType: 'team',
      organizationId: org,
      teamId: team,
    });
    try {
      const own = await call('GET', '/dashboard/manager', undefined, outsider);
      expect(own.statusCode, own.body).toBe(200);
      expect(own.json().workload.items).toHaveLength(1);
      expect(own.json().workload.items[0].teamId).toBe(team);
      expect(
        (await call('GET', `/dashboard/manager?teamId=${otherTeam}`, undefined, outsider))
          .statusCode,
      ).toBe(404);
      expect((await call('GET', '/dashboard/director', undefined, outsider)).statusCode).toBe(403);
      await db.insert(userAccessGrants).values({
        tenantId,
        userId: outsider,
        role: 'director',
        scopeType: 'organization',
        organizationId: org,
      });
      const director = await call('GET', '/dashboard/director', undefined, outsider);
      expect(director.statusCode, director.body).toBe(200);
      expect(director.json().organizationComparison.items[0].currentAssignments).toBe(2);
      expect(
        (await call('GET', `/dashboard/director?organizationId=${foreignOrg}`, undefined, outsider))
          .statusCode,
      ).not.toBe(200);
    } finally {
      await db
        .delete(userAccessGrants)
        .where(and(eq(userAccessGrants.tenantId, tenantId), eq(userAccessGrants.userId, outsider)));
      await db
        .delete(campaignProspectAssignments)
        .where(eq(campaignProspectAssignments.id, otherAssignment));
      await db.delete(teams).where(eq(teams.id, otherTeam));
    }
  });
  it('validates reporting windows and prospector context before returning aggregates', async () => {
    expect(
      (await call('GET', '/dashboard/manager?from=2026-01-01', undefined, admin)).statusCode,
    ).toBe(400);
    expect(
      (await call('GET', `/dashboard/today?teamId=${team}&timeZone=Invalid`, undefined, member))
        .statusCode,
    ).toBe(400);
    expect((await call('GET', '/dashboard/manager', undefined, member)).statusCode).toBe(403);
  });
});
