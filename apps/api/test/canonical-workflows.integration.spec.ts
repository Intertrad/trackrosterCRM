import { outcomeSettings } from '../src/database/schema/outcome-settings.js';
import { ActionEffectsService } from '../src/actions/action-effects.service.js';
import { FollowUpReminderSchedulerService } from '../src/follow-ups/follow-up-reminder-scheduler.service.js';
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
  it('lists all lifecycle states with stable pagination and scoped history', async () => {
    const open = await followUp({ dueAt: new Date(Date.now() - 60000) });
    await followUp({ status: 'completed', completedAt: new Date() });
    const missed = await call('GET', '/follow-ups?status=missed', undefined, member);
    expect(missed.statusCode, missed.body).toBe(200);
    expect(missed.json().items.map((r: { id: string }) => r.id)).toEqual([open.id]);
    const first = (await call('GET', '/follow-ups?status=all&limit=1', undefined, member)).json();
    expect(first.nextCursor).toBeTruthy();
    const second = (
      await call(
        'GET',
        `/follow-ups?status=all&limit=1&cursor=${first.nextCursor}`,
        undefined,
        member,
      )
    ).json();
    expect(second.items).toHaveLength(1);
    expect(second.items[0].id).not.toBe(first.items[0].id);
    expect((await call('GET', `/follow-ups/${open.id}`, undefined, outsider)).statusCode).toBe(404);
    expect((await call('GET', `/follow-ups/${open.id}`, undefined, foreign)).statusCode).toBe(404);
    expect((await call('GET', '/follow-ups?status=all', undefined, foreign)).json().items).toEqual(
      [],
    );
    const detail = (await call('GET', `/follow-ups/${open.id}`, undefined, member)).json();
    expect(detail.source.assignmentId).toBe(assignment);
    expect(detail.nextAction.category).toBe('follow_up');
  });
  it('reschedules with reminder and ETag, completes once and retains audit evidence', async () => {
    const row = await followUp();
    const initial = (await call('GET', `/follow-ups/${row.id}`, undefined, member)).json();
    const schedule = vi
      .spyOn(app.get(FollowUpReminderSchedulerService), 'schedule')
      .mockResolvedValue(undefined);
    const update = await call(
      'PATCH',
      `/follow-ups/${row.id}`,
      {
        dueAt: new Date(Date.now() + 172800000).toISOString(),
        category: 'meeting',
        channel: 'call',
      },
      member,
    );
    expect(update.statusCode, update.body).toBe(200);
    expect(schedule).toHaveBeenCalledOnce();
    const stale = await app.inject({
      method: 'PATCH',
      url: `/api/v1/follow-ups/${row.id}`,
      payload: { category: 'todo' },
      headers: {
        authorization: `Bearer ${tokens.get(member)}`,
        'idempotency-key': randomUUID(),
        'if-match': initial.etag,
      },
    });
    expect(stale.statusCode).toBe(412);
    const key = randomUUID();
    const done = await call('POST', `/follow-ups/${row.id}/complete`, {}, member, key);
    expect(done.statusCode, done.body).toBe(200);
    expect((await call('POST', `/follow-ups/${row.id}/complete`, {}, member, key)).statusCode).toBe(
      200,
    );
    expect((await call('POST', `/follow-ups/${row.id}/complete`, {}, member)).statusCode).toBe(409);
    const detail = (await call('GET', `/follow-ups/${row.id}`, undefined, member)).json();
    expect(detail.history.map((e: { action: string }) => e.action)).toContain('follow_up.complete');
  });
  it('rolls back failed reminders and serializes conflicting final transitions', async () => {
    const row = await followUp();
    vi.spyOn(app.get(FollowUpReminderSchedulerService), 'schedule').mockRejectedValue(
      new Error('offline'),
    );
    expect(
      (
        await call(
          'PATCH',
          `/follow-ups/${row.id}`,
          { dueAt: new Date(Date.now() + 172800000).toISOString() },
          member,
        )
      ).statusCode,
    ).toBe(503);
    expect((await call('GET', `/follow-ups/${row.id}`, undefined, member)).json().dueAt).toBe(
      row.dueAt.toISOString(),
    );
    const results = await Promise.all([
      call('POST', `/follow-ups/${row.id}/complete`, {}, member),
      call('POST', `/follow-ups/${row.id}/cancel`, { reason: 'No longer needed' }, member),
    ]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 409]);
  });
  it('requires cancellation reasons, blocks paused edits and checks authority before replay', async () => {
    const row = await followUp();
    expect((await call('POST', `/follow-ups/${row.id}/cancel`, {}, member)).statusCode).toBe(400);
    await db
      .update(campaignProspectAssignments)
      .set({ status: 'paused' })
      .where(eq(campaignProspectAssignments.id, assignment));
    expect((await call('POST', `/follow-ups/${row.id}/complete`, {}, member)).statusCode).toBe(409);
    const key = randomUUID();
    expect(
      (
        await call(
          'POST',
          `/follow-ups/${row.id}/cancel`,
          { reason: 'Paused campaign' },
          member,
          key,
        )
      ).statusCode,
    ).toBe(200);
    await db
      .update(campaignProspectAssignments)
      .set({ status: 'active' })
      .where(eq(campaignProspectAssignments.id, assignment));
    await db
      .delete(userAccessGrants)
      .where(and(eq(userAccessGrants.tenantId, tenantId), eq(userAccessGrants.userId, member)));
    try {
      expect(
        (
          await call(
            'POST',
            `/follow-ups/${row.id}/cancel`,
            { reason: 'Paused campaign' },
            member,
            key,
          )
        ).statusCode,
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
  it('retains historical reads and permits reasoned cleanup after assignment ending', async () => {
    const row = await followUp();
    await db
      .update(campaignProspectAssignments)
      .set({ endedAt: new Date() })
      .where(eq(campaignProspectAssignments.id, assignment));
    expect((await call('GET', `/follow-ups/${row.id}`, undefined, member)).statusCode).toBe(200);
    expect(
      (await call('PATCH', `/follow-ups/${row.id}`, { category: 'todo' }, member)).statusCode,
    ).toBe(409);
    expect(
      (await call('POST', `/follow-ups/${row.id}/cancel`, { reason: 'Ownership ended' }, admin))
        .statusCode,
    ).toBe(200);
    expect(
      (await call('POST', '/follow-ups/not-a-uuid/cancel', { reason: 'Invalid identifier' }, admin))
        .statusCode,
    ).toBe(400);
    const timeline = (
      await call('GET', `/prospects/${establishment}/timeline`, undefined, admin)
    ).json();
    expect(timeline.items.some((e: { kind: string }) => e.kind === 'follow_up_event')).toBe(true);
  });
});
