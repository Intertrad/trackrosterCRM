import { ActionEffectsService } from '../src/actions/action-effects.service.js';
import { CollisionWorkflowService } from '../src/collisions/collision-workflow.service.js';
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
import { getSeedDatabase } from './support/seed.js';
import type { Database } from '../src/database/database.types.js';
import {
  reservationRecords,
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
} from '../src/database/schema/index.js';
import { PasswordService } from '../src/auth/password.service.js';
describe('Collision evidence and override request workflows', () => {
  let app: NestFastifyApplication, db: Database, applicationDb: Database;
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
    db = getSeedDatabase();

    /*
     * Immutability is enforced by revoking UPDATE and DELETE from the runtime
     * role (migration 0079), so it has to be asserted through the connection the
     * application uses. The seed connection is the owner and keeps the privilege,
     * which is why this assertion passed a rewrite straight through.
     */
    applicationDb = app.get(DATABASE);
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
    for (const t of [
      reservationRecords,
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
  const check = (key = randomUUID()) =>
    call(
      'POST',
      '/reservations/check',
      { campaignId: campaign, campaignProspectId: prospect },
      member,
      key,
    );
  const request = (id: string, key = randomUUID()) =>
    call(
      'POST',
      `/collision-events/${id}/override-request`,
      { reason: 'Customer requested another contact' },
      member,
      key,
    );
  const decide = (id: string, op = 'approve', actor = admin, key = randomUUID()) =>
    call(
      'POST',
      `/override-requests/${id}/${op}`,
      { reason: 'Reviewed the customer context' },
      actor,
      key,
    );
  const recent = async () => {
    const [row] = await db
      .insert(prospectActivities)
      .values({
        tenantId,
        campaignId: campaign,
        campaignProspectId: prospect,
        establishmentId: establishment,
        assignmentId: assignment,
        userId: member,
        reservationId: randomUUID(),
        type: 'call',
      })
      .returning();
    return row!;
  };
  const pending = async () => {
    await recent();
    const checked = await check();
    expect(checked.statusCode, checked.body).toBe(200);
    const result = await request(checked.json().collisionId);
    expect(result.statusCode, result.body).toBe(201);
    return { eventId: checked.json().collisionId as string, request: result.json() };
  };
  it('checks without claiming and records only collisions; validates IDs and scope', async () => {
    const result = await check();
    expect(result.statusCode, result.body).toBe(200);
    expect(result.json()).toMatchObject({
      decision: 'allow',
      collisionId: null,
      overrideable: false,
    });
    expect(
      await app.get(ReservationRepository).findCurrent(tenantId, campaign, prospect),
    ).toBeNull();
    expect(
      (
        await call(
          'POST',
          '/reservations/check',
          { campaignId: campaign, campaignProspectId: prospect },
          outsider,
        )
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await call(
          'POST',
          '/reservations/check',
          { campaignId: 'bad', campaignProspectId: prospect },
          member,
        )
      ).statusCode,
    ).toBe(400);
  });
  it('persists immutable evidence, redacts conflict identifiers, and scopes pagination', async () => {
    const activity = await recent();
    const key = randomUUID();
    const first = await check(key);
    expect(first.statusCode, first.body).toBe(200);
    expect((await check(key)).json()).toEqual(first.json());
    const eventId = first.json().collisionId;
    expect(first.json()).toMatchObject({ reasonCode: 'RECENT_CONTACT', overrideable: true });
    expect(first.body).not.toContain(activity.id);
    await expect(
      applicationDb
        .update(collisionEvents)
        .set({ reasonCode: 'ACTIVE_ASSIGNMENT' })
        .where(eq(collisionEvents.id, eventId)),
      /* 42501 insufficient_privilege: the grant refuses it, not a check or a
         trigger, so the guarantee holds however the application is written. */
    ).rejects.toMatchObject({ cause: { code: '42501' } });
    await check();
    const page = await call('GET', '/collision-events?limit=1', undefined, member);
    expect(page.json().items).toHaveLength(1);
    const second = await call(
      'GET',
      `/collision-events?limit=1&cursor=${page.json().nextCursor}`,
      undefined,
      member,
    );
    expect(second.json().items).toHaveLength(1);
    expect(second.json().items[0].id).not.toBe(page.json().items[0].id);
    for (const actor of [outsider, foreign]) {
      expect((await call('GET', `/collision-events/${eventId}`, undefined, actor)).statusCode).toBe(
        404,
      );
      expect((await call('GET', '/collision-events', undefined, actor)).json().items).toEqual([]);
    }
    expect((await call('GET', `/collision-events/${eventId}`, undefined, admin)).statusCode).toBe(
      200,
    );
  });
  it('allows one pending request per requester/prospect, including concurrent requests', async () => {
    await recent();
    const event = (await check()).json().collisionId;
    const key = randomUUID();
    const first = await request(event, key);
    expect(first.statusCode, first.body).toBe(201);
    expect((await request(event, key)).json()).toEqual(first.json());
    expect((await request(event)).statusCode).toBe(409);
    expect((await decide(first.json().id, 'cancel', member)).statusCode).toBe(200);
    const race = await Promise.all([request(event), request(event)]);
    expect(race.map((r) => r.statusCode).sort()).toEqual([201, 409]);
    expect(
      (
        await call(
          'POST',
          `/collision-events/${event}/override-request`,
          { reason: 'Another user cannot request' },
          admin,
        )
      ).statusCode,
    ).toBe(404);
  });
  it('atomically approves, audits and issues an exception usable by the requester reservation', async () => {
    const p = await pending();
    const key = randomUUID();
    const approved = await decide(p.request.id, 'approve', admin, key);
    expect(approved.statusCode, approved.body).toBe(200);
    expect(approved.json().status).toBe('approved');
    expect(approved.json().approval.id).toBe(approved.json().overrideId);
    expect((await decide(p.request.id, 'approve', admin, key)).json()).toEqual(approved.json());
    expect((await decide(p.request.id, 'reject')).statusCode).toBe(409);
    const reserve = await call(
      'POST',
      `/campaigns/${campaign}/prospects/${prospect}/reservation`,
      { overrideId: approved.json().overrideId },
      member,
    );
    expect(reserve.statusCode, reserve.body).toBe(201);
    const events = (
      await call('GET', `/prospects/${establishment}/timeline`, undefined, member)
    ).json().items;
    expect(
      events.some((r: { data: { action?: string } }) => r.data.action === 'override.approved'),
    ).toBe(true);
    await expect(
      db
        .update(overrideRequests)
        .set({ decisionReason: 'Rewritten decision reason' })
        .where(eq(overrideRequests.id, p.request.id)),
    ).rejects.toThrow();
    expect(
      (await call('GET', `/override-requests/${p.request.id}`, undefined, member)).json().approval
        .id,
    ).toBe(approved.json().overrideId);
  });
  it('rolls approval and request decision back if audit persistence fails', async () => {
    const p = await pending();
    const service = app.get(CollisionWorkflowService);
    const spy = vi
      .spyOn(service as unknown as { audit: (...args: unknown[]) => Promise<void> }, 'audit')
      .mockRejectedValueOnce(new Error('Simulated audit outage'));
    expect((await decide(p.request.id)).statusCode).toBe(500);
    spy.mockRestore();
    expect(
      await db.select().from(collisionOverrides).where(eq(collisionOverrides.tenantId, tenantId)),
    ).toHaveLength(0);
    expect(
      (await call('GET', `/override-requests/${p.request.id}`, undefined, member)).json().status,
    ).toBe('pending');
    expect((await decide(p.request.id)).statusCode).toBe(200);
  });
  it('serializes concurrent manager decisions into one final decision', async () => {
    const p = await pending();
    const race = await Promise.all([decide(p.request.id), decide(p.request.id, 'reject')]);
    expect(race.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    const row = (
      await db.select().from(overrideRequests).where(eq(overrideRequests.id, p.request.id))
    )[0]!;
    expect(['approved', 'rejected']).toContain(row.status);
    const approvals = await db
      .select()
      .from(collisionOverrides)
      .where(eq(collisionOverrides.tenantId, tenantId));
    expect(approvals).toHaveLength(row.status === 'approved' ? 1 : 0);
  });
  it('supports rejection and owner cancellation with immutable reasons and conditional writes', async () => {
    const p = await pending();
    expect((await decide(p.request.id, 'cancel', admin)).statusCode).toBe(404);
    const stale = await app.inject({
      method: 'POST',
      url: `/api/v1/override-requests/${p.request.id}/reject`,
      headers: {
        authorization: `Bearer ${tokens.get(admin)}`,
        'idempotency-key': randomUUID(),
        'if-match': '"stale"',
      },
      payload: { reason: 'Manager reviewed the request' },
    });
    expect(stale.statusCode).toBe(412);
    expect((await decide(p.request.id, 'reject')).statusCode).toBe(200);
    const next = await request(p.eventId);
    expect(next.statusCode, next.body).toBe(201);
    expect((await decide(next.json().id, 'cancel', member)).statusCode).toBe(200);
    expect(
      (await call('GET', '/override-requests?status=cancelled', undefined, member)).json().items,
    ).toHaveLength(1);
    expect(
      (await call('GET', `/override-requests/${p.request.id}`, undefined, foreign)).statusCode,
    ).toBe(404);
    expect(
      (
        await call(
          'POST',
          `/collision-events/${p.eventId}/override-request`,
          { reason: '   short   ' },
          member,
        )
      ).statusCode,
    ).toBe(400);
  });
  it('rejects changed or expired collision evidence', async () => {
    const p = await pending();
    await db.delete(prospectActivities).where(eq(prospectActivities.tenantId, tenantId));
    expect((await decide(p.request.id)).statusCode).toBe(409);
    await recent();
    expect((await decide(p.request.id)).statusCode).toBe(409);
    await decide(p.request.id, 'cancel', member);
    const [original] = await db
      .select()
      .from(collisionEvents)
      .where(eq(collisionEvents.id, p.eventId));
    const [expired] = await db
      .insert(collisionEvents)
      .values({
        ...original!,
        id: randomUUID(),
        createdAt: new Date(Date.now() - 1200000),
        expiresAt: new Date(Date.now() - 600000),
      })
      .returning();
    expect((await request(expired!.id)).statusCode).toBe(409);
  });
  it('blocks active reservations from exception requests and approval', async () => {
    const p = await pending();
    const now = new Date();
    await app.get(ReservationRepository).acquireWithinOrganizationScope(
      {
        reservationId: randomUUID(),
        tenantId,
        organizationId: org,
        campaignId: campaign,
        campaignProspectId: prospect,
        establishmentId: establishment,
        assignmentId: assignment,
        teamId: team,
        userId: outsider,
        acquiredAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + 600000).toISOString(),
      },
      [org],
      600,
    );
    const result = await check();
    expect(result.json()).toMatchObject({ reasonCode: 'ACTIVE_RESERVATION', overrideable: false });
    expect((await request(result.json().collisionId)).statusCode).toBe(409);
    expect((await decide(p.request.id)).statusCode).toBe(409);
    expect(
      await db.select().from(collisionOverrides).where(eq(collisionOverrides.tenantId, tenantId)),
    ).toHaveLength(0);
  });
  it('honors consent opposition at check, request and approval without preventing cancellation', async () => {
    const p = await pending();
    expect((await append()).statusCode).toBe(201);
    expect((await check()).statusCode).toBe(409);
    expect((await request(p.eventId)).statusCode).toBe(409);
    const approval = await decide(p.request.id);
    expect(approval.statusCode, approval.body).toBe(409);
    expect(approval.json().code).toBe('CONTACT_BLOCKED');
    expect((await decide(p.request.id, 'cancel', member)).statusCode).toBe(200);
  });
  it('checks management scope and configurable permission before idempotent replay', async () => {
    await db.insert(userAccessGrants).values({
      id: extraGrant,
      tenantId,
      userId: outsider,
      role: 'manager',
      scopeType: 'team',
      organizationId: org,
      teamId: team,
    });
    const p = await pending();
    const key = randomUUID();
    expect((await decide(p.request.id, 'approve', outsider, key)).statusCode).toBe(200);
    await db.insert(tenantRolePermissions).values({ tenantId, role: 'manager', permissions: [] });
    expect((await decide(p.request.id, 'approve', outsider, key)).statusCode).toBe(403);
    await db.delete(userAccessGrants).where(eq(userAccessGrants.id, extraGrant));
    expect((await decide(p.request.id, 'approve', outsider, key)).statusCode).toBe(404);
  });
  it('requires an independent manager even when the requester also has management scope', async () => {
    const p = await pending();
    await db.insert(userAccessGrants).values({
      id: extraGrant,
      tenantId,
      userId: member,
      role: 'manager',
      scopeType: 'team',
      organizationId: org,
      teamId: team,
    });
    expect((await decide(p.request.id, 'approve', member)).statusCode).toBe(409);
    expect((await decide(p.request.id, 'reject', member)).statusCode).toBe(409);
    expect((await decide(p.request.id, 'cancel', member)).statusCode).toBe(200);
  });
  it('invalidates approval after assignment replacement', async () => {
    const p = await pending();
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
      assignedUserId: member,
    });
    expect((await decide(p.request.id)).statusCode).toBe(409);
    expect((await decide(p.request.id, 'cancel', member)).statusCode).toBe(200);
  });
  it('records policy context and rejects approval after policy changes', async () => {
    const [a, b] = [org, policyOrg].sort();
    const [policy] = await db
      .insert(organizationCoordinationPolicies)
      .values({ tenantId, organizationAId: a!, organizationBId: b!, policy: 'shared' })
      .returning();
    const p = await pending();
    const stored = (
      await db.select().from(collisionEvents).where(eq(collisionEvents.id, p.eventId))
    )[0]!;
    expect(stored.policySnapshot.coordinationPolicies).toHaveLength(1);
    await db
      .update(organizationCoordinationPolicies)
      .set({ policy: 'independent', updatedAt: new Date() })
      .where(eq(organizationCoordinationPolicies.id, policy!.id));
    expect((await decide(p.request.id)).statusCode).toBe(409);
    expect((await decide(p.request.id, 'cancel', member)).statusCode).toBe(200);
    const next = await request((await check()).json().collisionId);
    expect(next.statusCode, next.body).toBe(201);
    expect((await decide(next.json().id)).statusCode).toBe(200);
  });
  it('includes planned contact actions in collisions and invalidates exceptions when plans change', async () => {
    await db.insert(campaignProspectAssignments).values({
      id: extraAssignment,
      tenantId,
      campaignId: otherCampaign,
      campaignProspectId: otherProspect,
      organizationId: org,
      teamId: team,
      assignedUserId: outsider,
    });
    const [action] = await db
      .insert(actions)
      .values({
        tenantId,
        campaignId: otherCampaign,
        campaignProspectId: otherProspect,
        establishmentId: establishment,
        assignmentId: extraAssignment,
        assigneeMembershipId: outsider,
        createdBy: admin,
        type: 'task',
        subject: 'Non-contact preparation',
      })
      .returning();
    expect((await check()).json().reasonCode).toBe('ACTIVE_ASSIGNMENT');
    await db.update(actions).set({ type: 'call' }).where(eq(actions.id, action!.id));
    const checked = await check();
    expect(checked.json()).toMatchObject({ reasonCode: 'PLANNED_ACTION', overrideable: true });
    expect(checked.body).not.toContain(action!.id);
    expect(checked.body).not.toContain(otherProspect);
    const r = await request(checked.json().collisionId);
    expect(r.statusCode, r.body).toBe(201);
    await db
      .update(actions)
      .set({ dueAt: new Date(Date.now() + 60000), updatedAt: new Date() })
      .where(eq(actions.id, action!.id));
    expect((await decide(r.json().id)).statusCode).toBe(409);
    await decide(r.json().id, 'cancel', member);
    const next = await request((await check()).json().collisionId);
    const approved = await decide(next.json().id);
    expect(approved.statusCode, approved.body).toBe(200);
    const reserve = await call(
      'POST',
      `/campaigns/${campaign}/prospects/${prospect}/reservation`,
      { overrideId: approved.json().overrideId },
      member,
    );
    expect(reserve.statusCode, reserve.body).toBe(201);
  });
  it('lets the requester cancel after losing assignment access', async () => {
    const p = await pending();
    await db
      .update(campaignProspectAssignments)
      .set({ endedAt: new Date() })
      .where(eq(campaignProspectAssignments.id, assignment));
    expect(
      (await call('GET', `/override-requests/${p.request.id}`, undefined, member)).statusCode,
    ).toBe(404);
    expect((await decide(p.request.id, 'cancel', member)).statusCode).toBe(200);
  });
  it('lets an authorized administrator reject an unassigned pending request', async () => {
    const p = await pending();
    await db
      .update(campaignProspectAssignments)
      .set({ endedAt: new Date() })
      .where(eq(campaignProspectAssignments.id, assignment));
    expect((await decide(p.request.id)).statusCode).toBe(409);
    expect((await decide(p.request.id, 'reject')).statusCode).toBe(200);
  });
});
