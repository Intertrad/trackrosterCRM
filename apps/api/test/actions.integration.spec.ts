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
describe('Actions, outcomes and unified timelines', () => {
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
  const path = `/prospects/${establishment}/consents`;
  const call = (
    method: 'GET' | 'POST',
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
  const create = (body: object = {}, actor = member) =>
    call(
      'POST',
      '/actions',
      {
        campaignId: campaign,
        campaignProspectId: prospect,
        type: 'task',
        subject: 'Contact prospect',
        ...body,
      },
      actor,
    );
  const command = (
    id: string,
    op: string,
    body: object = {},
    actor = member,
    key: string = randomUUID(),
  ) => call('POST', `/actions/${id}/${op}`, body, actor, key);
  it('validates planning scope, target assignee and required fields', async () => {
    expect(
      (
        await call(
          'POST',
          `/campaigns/${'-'.repeat(36)}/prospects/${prospect}/reservation`,
          {},
          member,
        )
      ).statusCode,
    ).toBe(400);
    expect((await create()).statusCode).toBe(201);
    expect((await create({}, outsider)).statusCode).toBe(404);
    expect((await create({}, foreign)).statusCode).toBe(404);
    expect((await create({ assigneeMembershipId: outsider }, admin)).statusCode).toBe(400);
    expect((await create({ subject: '' })).statusCode).toBe(400);
    expect(
      (
        await call(
          'POST',
          '/actions',
          { campaignId: campaign, campaignProspectId: prospect, type: 'task' },
          member,
        )
      ).statusCode,
    ).toBe(400);
    expect((await create({ assigneeMembershipId: member }, admin)).statusCode).toBe(201);
    await db.update(campaigns).set({ status: 'completed' }).where(eq(campaigns.id, campaign));
    expect((await create()).statusCode).toBe(409);
    await db.update(campaigns).set({ status: 'active' }).where(eq(campaigns.id, campaign));
  });
  it('enforces lifecycle transitions and append-only reasoned corrections', async () => {
    const first = await create();
    const id = first.json().id;
    expect((await command(id, 'complete', { outcomeCode: 'completed' })).statusCode).toBe(409);
    expect((await command(id, 'start')).statusCode).toBe(200);
    expect((await command(id, 'start')).statusCode).toBe(409);
    expect(
      (await command(id, 'complete', { outcomeCode: 'completed', notes: 'Finished' })).statusCode,
    ).toBe(200);
    expect((await command(id, 'cancel', { reason: 'Too late' })).statusCode).toBe(409);
    expect(
      (await command(id, 'corrections', { reason: 'Clarify', notes: 'Corrected description' }))
        .statusCode,
    ).toBe(200);
    const detail = (await call('GET', `/actions/${id}`, undefined, member)).json();
    expect(detail.outcome.notes).toBe('Finished');
    expect(detail.status).toBe('completed');
    const events = (await call('GET', `/actions/${id}/events`, undefined, member)).json().items;
    expect(events.map((e: { eventType: string }) => e.eventType).sort()).toEqual([
      'complete',
      'correction',
      'created',
      'start',
    ]);
    await expect(
      db.update(actionEvents).set({ eventType: 'rewrite' }).where(eq(actionEvents.actionId, id)),
    ).rejects.toMatchObject({ cause: { code: '23514' } });
    await expect(
      db.update(actionOutcomes).set({ notes: 'rewrite' }).where(eq(actionOutcomes.actionId, id)),
    ).rejects.toMatchObject({ cause: { code: '23514' } });
  });
  it('atomically completes contact outcome, contact edits, status, follow-up and delivery intent', async () => {
    const created = await create({ type: 'call' }),
      id = created.json().id;
    const started = await command(id, 'start');
    expect(started.statusCode, started.body).toBe(200);
    const completed = await command(id, 'complete', {
      outcomeCode: 'interested',
      notes: 'Asked for a proposal',
      lifecycleStage: 'follow_up',
      contactUpdate: { contactId: contact, name: 'Updated' },
      nextFollowUp: { dueAt: new Date(Date.now() + 3600000).toISOString(), channel: 'email' },
      reservationDisposition: 'release',
    });
    expect(completed.statusCode, completed.body).toBe(200);
    expect(
      await db.select().from(prospectActivities).where(eq(prospectActivities.tenantId, tenantId)),
    ).toHaveLength(1);
    expect(
      await db.select().from(prospectFollowUps).where(eq(prospectFollowUps.tenantId, tenantId)),
    ).toHaveLength(1);
    expect(
      (await db.select().from(campaignProspects).where(eq(campaignProspects.id, prospect)))[0]!
        .lifecycleStage,
    ).toBe('follow_up');
    expect(
      (
        await db.select().from(establishmentContacts).where(eq(establishmentContacts.id, contact))
      )[0]!.name,
    ).toBe('Updated');
    expect(
      await db.select().from(actionEffects).where(eq(actionEffects.actionId, id)),
    ).toHaveLength(2);
    const effects = app.get(ActionEffectsService);
    await effects.drain();
    expect(
      (await db.select().from(actionEffects).where(eq(actionEffects.actionId, id))).every(
        (e) => e.deliveredAt,
      ),
    ).toBe(true);
    expect(
      await app.get(ReservationRepository).findCurrent(tenantId, campaign, prospect),
    ).toBeNull();
  });
  it('rolls back every completion write when the contact belongs to another prospect', async () => {
    const id = (await create({ type: 'call' })).json().id;
    const startResult = await command(id, 'start');
    expect(startResult.statusCode, startResult.body).toBe(200);
    const result = await command(id, 'complete', {
      outcomeCode: 'contacted',
      contactUpdate: { contactId: otherContact, name: 'Wrong' },
    });
    expect(result.statusCode, result.body).toBe(404);
    expect(
      await db.select().from(actionOutcomes).where(eq(actionOutcomes.actionId, id)),
    ).toHaveLength(0);
    expect(
      await db.select().from(prospectActivities).where(eq(prospectActivities.tenantId, tenantId)),
    ).toHaveLength(0);
    expect((await call('GET', `/actions/${id}`, undefined, member)).json().status).toBe('started');
  });
  it('preserves failed delivery intents for retry and sends a reminder only once', async () => {
    const id = (await create()).json().id;
    const startResult = await command(id, 'start');
    expect(startResult.statusCode, startResult.body).toBe(200);
    expect(
      (
        await command(id, 'complete', {
          outcomeCode: 'completed',
          nextFollowUp: { dueAt: new Date(Date.now() + 3600000).toISOString() },
        })
      ).statusCode,
    ).toBe(200);
    const scheduler = app.get(FollowUpReminderSchedulerService);
    const send = vi
      .spyOn(scheduler, 'schedule')
      .mockRejectedValueOnce(new Error('queue unavailable'))
      .mockResolvedValue(undefined);
    await expect(app.get(ActionEffectsService).drain()).rejects.toThrow('queue unavailable');
    expect(
      (await db.select().from(actionEffects).where(eq(actionEffects.actionId, id)))[0]!.deliveredAt,
    ).toBeNull();
    await app.get(ActionEffectsService).drain();
    await app.get(ActionEffectsService).drain();
    expect(send).toHaveBeenCalledTimes(2);
  });
  it('handles duplicate and concurrent completion without duplicate outcomes', async () => {
    const id = (await create()).json().id;
    const startResult = await command(id, 'start');
    expect(startResult.statusCode, startResult.body).toBe(200);
    const key = randomUUID();
    const first = await command(id, 'complete', { outcomeCode: 'completed' }, member, key);
    expect(first.statusCode).toBe(200);
    expect(
      (await command(id, 'complete', { outcomeCode: 'completed' }, member, key)).json(),
    ).toEqual(first.json());
    const second = (await create()).json().id;
    await command(second, 'start');
    const race = await Promise.all([
      command(second, 'complete', { outcomeCode: 'completed' }),
      command(second, 'complete', { outcomeCode: 'completed' }),
    ]);
    expect(race.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    expect(
      await db.select().from(actionOutcomes).where(eq(actionOutcomes.actionId, second)),
    ).toHaveLength(1);
  });
  it('blocks contact start/completion after opposition but allows cancellation and notes', async () => {
    const id = (await create({ type: 'call' })).json().id;
    const startResult = await command(id, 'start');
    expect(startResult.statusCode, startResult.body).toBe(200);
    await append({ channel: 'phone' });
    expect((await command(id, 'complete', { outcomeCode: 'contacted' })).statusCode).toBe(409);
    expect((await command(id, 'cancel', { reason: 'Opposition' })).statusCode).toBe(200);
    const other = (await create({ type: 'email' })).json().id;
    await append();
    expect((await command(other, 'start')).statusCode).toBe(409);
    const note = (await create({ type: 'note' })).json().id;
    expect((await command(note, 'start')).statusCode).toBe(200);
    expect((await command(note, 'complete', { outcomeCode: 'completed' })).statusCode).toBe(200);
  });
  it('records do-not-contact evidence during completion and prohibits another follow-up', async () => {
    const id = (await create({ type: 'call' })).json().id;
    const startResult = await command(id, 'start');
    expect(startResult.statusCode, startResult.body).toBe(200);
    expect(
      (
        await command(id, 'complete', {
          outcomeCode: 'do_not_contact',
          nextFollowUp: { dueAt: new Date(Date.now() + 3600000).toISOString() },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (await command(id, 'complete', { outcomeCode: 'do_not_contact', notes: 'No more calls' }))
        .statusCode,
    ).toBe(200);
    expect(
      (await db.select().from(contactConsents).where(eq(contactConsents.tenantId, tenantId)))[0]!
        .status,
    ).toBe('blocked');
  });
  it('returns a filtered unified timeline with stable pagination and multiple event sources', async () => {
    expect(
      (await call('GET', `/prospects/${otherEstablishment}/timeline`, undefined, admin)).statusCode,
    ).toBe(200);
    expect(
      (await call('GET', `/prospects/${otherEstablishment}/timeline`, undefined, member))
        .statusCode,
    ).toBe(404);
    const id = (await create()).json().id;
    const startResult = await command(id, 'start');
    expect(startResult.statusCode, startResult.body).toBe(200);
    await command(id, 'complete', {
      outcomeCode: 'completed',
      lifecycleStage: 'qualified',
      nextFollowUp: { dueAt: new Date(Date.now() + 3600000).toISOString() },
    });
    await append({ status: 'allowed' });
    const first = await call(
      'GET',
      `/prospects/${establishment}/timeline?limit=2`,
      undefined,
      member,
    );
    expect(first.statusCode, first.body).toBe(200);
    expect(first.json().items).toHaveLength(2);
    expect(first.json().nextCursor).toBeTruthy();
    const all = [];
    let cursor: string | undefined;
    do {
      const response = await call(
        'GET',
        `/prospects/${establishment}/timeline?limit=2${cursor ? '&cursor=' + cursor : ''}`,
        undefined,
        member,
      );
      expect(response.statusCode, response.body).toBe(200);
      all.push(...response.json().items);
      cursor = response.json().nextCursor;
    } while (cursor);
    expect(new Set(all.map((e) => e.kind))).toEqual(
      new Set(['action_event', 'consent', 'assignment_started', 'follow_up_created']),
    );
    expect(new Set(all.map((e) => e.kind + e.id)).size).toBe(all.length);
    expect(
      (await call('GET', `/prospects/${establishment}/timeline`, undefined, outsider)).statusCode,
    ).toBe(404);
    expect(
      (await call('GET', `/prospects/${establishment}/timeline?cursor=bad`, undefined, member))
        .statusCode,
    ).toBe(400);
  });
  it('reuses the actor reservation, respects keep, and waits for queued release before another start', async () => {
    const reserved = await call(
      'POST',
      `/campaigns/${campaign}/prospects/${prospect}/reservation`,
      {},
      member,
    );
    expect(reserved.statusCode, reserved.body).toBe(201);
    const history = await call('GET', `/prospects/${establishment}/timeline`, undefined, member);
    expect(history.statusCode, history.body).toBe(200);
    expect(history.body).toContain('reservation.succeeded');
    const first = (await create({ type: 'call' })).json().id;
    const started = await command(first, 'start');
    expect(started.statusCode, started.body).toBe(200);
    expect(started.json().reservationId).toBe(reserved.json().reservationId);
    expect(
      (
        await command(first, 'complete', {
          outcomeCode: 'contacted',
          reservationDisposition: 'keep',
        })
      ).statusCode,
    ).toBe(200);
    expect(
      await app.get(ReservationRepository).findCurrent(tenantId, campaign, prospect),
    ).not.toBeNull();
    const second = (await create({ type: 'email' })).json().id;
    expect((await command(second, 'start')).statusCode).toBe(200);
    expect((await command(second, 'cancel', { reason: 'Done' })).statusCode).toBe(200);
    const third = (await create({ type: 'visit' })).json().id;
    expect((await command(third, 'start')).statusCode).toBe(409);
    await app.get(ActionEffectsService).drain();
    expect(
      await app.get(ReservationRepository).findCurrent(tenantId, campaign, prospect),
    ).toBeNull();
  });
  it('rejects stale assignment snapshots and expired reservations', async () => {
    const first = (await create({ type: 'call' })).json().id;
    const started = await command(first, 'start');
    expect(started.statusCode).toBe(200);
    await app
      .get(ReservationRepository)
      .releaseOrganizationScoped(
        tenantId,
        campaign,
        prospect,
        org,
        establishment,
        started.json().reservationId,
      );
    expect((await command(first, 'complete', { outcomeCode: 'contacted' })).statusCode).toBe(409);
    const task = (await create()).json().id;
    await db
      .update(campaignProspectAssignments)
      .set({ endedAt: new Date() })
      .where(eq(campaignProspectAssignments.id, assignment));
    const [replacement] = await db
      .insert(campaignProspectAssignments)
      .values({
        tenantId,
        campaignId: campaign,
        campaignProspectId: prospect,
        organizationId: org,
        teamId: team,
        assignedUserId: member,
      })
      .returning();
    try {
      expect((await command(task, 'start')).statusCode).toBe(409);
    } finally {
      await db
        .delete(campaignProspectAssignments)
        .where(eq(campaignProspectAssignments.id, replacement!.id));
    }
  });
  it('filters another campaign ownership from the same canonical prospect timeline', async () => {
    const [hiddenAssignment] = await db
      .insert(campaignProspectAssignments)
      .values({
        tenantId,
        campaignId: otherCampaign,
        campaignProspectId: otherProspect,
        organizationId: org,
        teamId: team,
        assignedUserId: outsider,
      })
      .returning();
    const [hiddenAction] = await db
      .insert(actions)
      .values({
        tenantId,
        campaignId: otherCampaign,
        campaignProspectId: otherProspect,
        establishmentId: establishment,
        assignmentId: hiddenAssignment!.id,
        assigneeMembershipId: outsider,
        createdBy: admin,
        type: 'note',
        subject: 'Private campaign context',
      })
      .returning();
    await db.insert(actionEvents).values({
      tenantId,
      actionId: hiddenAction!.id,
      eventType: 'created',
      actorMembershipId: admin,
      data: { secret: 'private context' },
    });
    try {
      const own = await call('GET', `/prospects/${establishment}/timeline`, undefined, member);
      expect(own.statusCode, own.body).toBe(200);
      expect(own.body).not.toContain('private context');
      const all = await call('GET', `/prospects/${establishment}/timeline`, undefined, admin);
      expect(all.body).toContain('private context');
    } finally {
      await db.delete(actionEvents).where(eq(actionEvents.actionId, hiddenAction!.id));
      await db.delete(actions).where(eq(actions.id, hiddenAction!.id));
      await db
        .delete(campaignProspectAssignments)
        .where(eq(campaignProspectAssignments.id, hiddenAssignment!.id));
    }
  });
  it('checks action visibility before replay and rejects stale conditional edits', async () => {
    const first = await create();
    const id = first.json().id;
    const changed = await app.inject({
      method: 'PATCH',
      url: `/api/v1/actions/${id}`,
      headers: {
        authorization: `Bearer ${tokens.get(member)}`,
        'idempotency-key': randomUUID(),
        'if-match': '"stale"',
      },
      payload: { subject: 'Edited' },
    });
    expect(changed.statusCode).toBe(412);
    const key = randomUUID();
    expect((await command(id, 'start', {}, member, key)).statusCode).toBe(200);
    const [grant] = await db
      .select()
      .from(userAccessGrants)
      .where(and(eq(userAccessGrants.tenantId, tenantId), eq(userAccessGrants.userId, member)));
    await db.delete(userAccessGrants).where(eq(userAccessGrants.id, grant!.id));
    try {
      expect((await command(id, 'start', {}, member, key)).statusCode).toBe(404);
    } finally {
      await db.insert(userAccessGrants).values(grant!);
    }
  });
});
