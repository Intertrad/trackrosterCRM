import { randomUUID } from 'node:crypto';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import type { AuthenticationTokens } from '../src/auth/auth.types.js';
import { PasswordService } from '../src/auth/password.service.js';
import { UserAccessGrantRepository } from '../src/authorization/user-access-grant.repository.js';
import { DATABASE } from '../src/database/database.constants.js';
import type { Database } from '../src/database/database.types.js';
import { campaignProspectAssignments } from '../src/database/schema/campaign-prospect-assignments.js';
import { campaignProspects } from '../src/database/schema/campaign-prospects.js';
import { campaigns } from '../src/database/schema/campaigns.js';
import { establishments } from '../src/database/schema/establishments.js';
import { organizations } from '../src/database/schema/organizations.js';
import { notifications } from '../src/database/schema/notifications.js';
import { prospectFollowUps } from '../src/database/schema/prospect-follow-ups.js';
import { teams } from '../src/database/schema/teams.js';
import { tenants } from '../src/database/schema/tenants.js';
import { users } from '../src/database/schema/users.js';
import { TenantService } from '../src/tenants/tenant.service.js';
import { UserRepository } from '../src/users/user.repository.js';

describe('Follow-up HTTP integration', () => {
  let app: NestFastifyApplication | undefined;
  let database: Database | undefined;

  let tenantId = '';
  let organizationId = '';
  let teamId = '';
  let establishmentId = '';

  let campaignId = '';
  let prospectId = '';
  let assignmentId = '';

  let secondCampaignId = '';
  let secondProspectId = '';
  let secondAssignmentId = '';

  let prospectorAId = '';
  let prospectorBId = '';
  let noScopeUserId = '';

  let prospectorAToken = '';
  let prospectorBToken = '';
  let noScopeToken = '';

  const password = 'FollowUpProspector123!';

  function getApp(): NestFastifyApplication {
    if (!app) {
      throw new Error('Application has not been initialized');
    }

    return app;
  }

  function getDatabase(): Database {
    if (!database) {
      throw new Error('Database has not been initialized');
    }

    return database;
  }

  function followUpUrl(targetCampaignId = campaignId, targetProspectId = prospectId): string {
    return `/campaigns/${targetCampaignId}` + `/prospects/${targetProspectId}` + '/follow-ups';
  }

  function followUpActionUrl(
    followUpId: string,
    action: 'reschedule' | 'complete' | 'cancel',
    targetCampaignId = campaignId,
    targetProspectId = prospectId,
  ): string {
    return `${followUpUrl(targetCampaignId, targetProspectId)}/${followUpId}/${action}`;
  }

  function collisionDecisionUrl(
    targetCampaignId = campaignId,
    targetProspectId = prospectId,
  ): string {
    return (
      `/campaigns/${targetCampaignId}` + `/prospects/${targetProspectId}` + '/collision-decision'
    );
  }
  function idempotentHeaders(token: string): Record<string, string> {
    return {
      authorization: `Bearer ${token}`,

      'idempotency-key': randomUUID(),
    };
  }

  async function login(email: string): Promise<AuthenticationTokens> {
    const response = await getApp().inject({
      method: 'POST',

      url: '/auth/login',

      payload: {
        email,

        password,
      },
    });

    expect(response.statusCode).toBe(200);

    return JSON.parse(response.payload) as AuthenticationTokens;
  }

  async function clearFollowUps(): Promise<void> {
    if (!database || !tenantId) {
      return;
    }

    await getDatabase().delete(notifications).where(eq(notifications.tenantId, tenantId));

    await getDatabase().delete(prospectFollowUps).where(eq(prospectFollowUps.tenantId, tenantId));
  }

  async function createFollowUpViaApi(input?: {
    token?: string;

    targetCampaignId?: string;

    targetProspectId?: string;

    dueAt?: Date;

    assignedUserId?: string | null;
  }): Promise<{
    statusCode: number;

    body: Record<string, unknown>;
  }> {
    const targetCampaignId = input?.targetCampaignId ?? campaignId;

    const targetProspectId = input?.targetProspectId ?? prospectId;

    const dueAt = input?.dueAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000);

    const payload: Record<string, unknown> = {
      dueAt: dueAt.toISOString(),
    };

    if (input && 'assignedUserId' in input) {
      payload.assignedUserId = input.assignedUserId;
    }

    const response = await getApp().inject({
      method: 'POST',

      url: followUpUrl(targetCampaignId, targetProspectId),

      headers: idempotentHeaders(input?.token ?? prospectorAToken),

      payload,
    });

    return {
      statusCode: response.statusCode,

      body: JSON.parse(response.payload) as Record<string, unknown>,
    };
  }

  beforeAll(async () => {
    const application = await NestFactory.create<NestFastifyApplication>(
      AppModule,

      new FastifyAdapter(),

      {
        logger: false,

        abortOnError: false,
      },
    );

    application.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,

        forbidNonWhitelisted: true,

        transform: true,
      }),
    );

    await application.init();

    app = application;

    database = application.get<Database>(DATABASE);

    const tenantService = application.get(TenantService);

    const userRepository = application.get(UserRepository);

    const passwordService = application.get(PasswordService);

    const grantRepository = application.get(UserAccessGrantRepository);

    const suffix = randomUUID().replaceAll('-', '').slice(0, 10);

    /*
     * Tenant.
     */
    const tenant = await tenantService.create({
      name: `Follow-up Tenant ${suffix}`,

      slug: `follow-up-${suffix}`,
    });

    tenantId = tenant.id;

    /*
     * Organization.
     */
    const [organization] = await getDatabase()
      .insert(organizations)
      .values({
        tenantId,

        name: 'France Sales',

        slug: `follow-up-france-${suffix}`,

        status: 'active',
      })
      .returning();

    if (!organization) {
      throw new Error('Failed to create organization');
    }

    organizationId = organization.id;

    /*
     * Team.
     */
    const [team] = await getDatabase()
      .insert(teams)
      .values({
        tenantId,

        organizationId,

        name: 'Paris Follow-up Team',

        slug: `follow-up-paris-${suffix}`,

        status: 'active',
      })
      .returning();

    if (!team) {
      throw new Error('Failed to create team');
    }

    teamId = team.id;

    /*
     * Canonical establishment shared by both
     * campaigns so PLANNED_ACTION behavior can
     * be verified end-to-end.
     */
    const [establishment] = await getDatabase()
      .insert(establishments)
      .values({
        tenantId,

        name: 'Follow-up Restaurant',

        normalizedName: 'follow-up restaurant',

        city: 'Paris',

        countryCode: 'FR',

        source: 'manual',

        status: 'active',
      })
      .returning();

    if (!establishment) {
      throw new Error('Failed to create establishment');
    }

    establishmentId = establishment.id;

    /*
     * Campaign A.
     */
    const [campaign] = await getDatabase()
      .insert(campaigns)
      .values({
        tenantId,

        organizationId,

        name: 'Follow-up Campaign A',

        status: 'active',
      })
      .returning();

    if (!campaign) {
      throw new Error('Failed to create first campaign');
    }

    campaignId = campaign.id;

    const [prospect] = await getDatabase()
      .insert(campaignProspects)
      .values({
        tenantId,

        campaignId,

        establishmentId,

        status: 'active',
      })
      .returning();

    if (!prospect) {
      throw new Error('Failed to create first prospect');
    }

    prospectId = prospect.id;

    const [assignment] = await getDatabase()
      .insert(campaignProspectAssignments)
      .values({
        tenantId,

        campaignId,

        campaignProspectId: prospectId,

        organizationId,

        teamId,

        /*
         * Team-owned assignment allows both
         * prospectors to exercise TR-019
         * ownership rules.
         */
        assignedUserId: null,
      })
      .returning();

    if (!assignment) {
      throw new Error('Failed to create first assignment');
    }

    assignmentId = assignment.id;

    /*
     * Campaign B points to the exact same
     * canonical establishment.
     */
    const [secondCampaign] = await getDatabase()
      .insert(campaigns)
      .values({
        tenantId,

        organizationId,

        name: 'Follow-up Campaign B',

        status: 'active',
      })
      .returning();

    if (!secondCampaign) {
      throw new Error('Failed to create second campaign');
    }

    secondCampaignId = secondCampaign.id;

    const [secondProspect] = await getDatabase()
      .insert(campaignProspects)
      .values({
        tenantId,

        campaignId: secondCampaignId,

        establishmentId,

        status: 'active',
      })
      .returning();

    if (!secondProspect) {
      throw new Error('Failed to create second prospect');
    }

    secondProspectId = secondProspect.id;

    const [secondAssignment] = await getDatabase()
      .insert(campaignProspectAssignments)
      .values({
        tenantId,

        campaignId: secondCampaignId,

        campaignProspectId: secondProspectId,

        organizationId,

        teamId,

        assignedUserId: null,
      })
      .returning();

    if (!secondAssignment) {
      throw new Error('Failed to create second assignment');
    }

    secondAssignmentId = secondAssignment.id;

    /*
     * Two exact-team prospectors and one active
     * user without a prospector grant.
     */
    const passwordHash = await passwordService.hash(password);

    const prospectorAEmail = `follow-up-a-${suffix}@trackroster.test`;

    const prospectorBEmail = `follow-up-b-${suffix}@trackroster.test`;

    const noScopeEmail = `follow-up-no-scope-${suffix}@trackroster.test`;

    const prospectorA = await userRepository.create({
      tenantId,

      email: prospectorAEmail,

      passwordHash,

      status: 'active',
    });

    const prospectorB = await userRepository.create({
      tenantId,

      email: prospectorBEmail,

      passwordHash,

      status: 'active',
    });

    const noScopeUser = await userRepository.create({
      tenantId,

      email: noScopeEmail,

      passwordHash,

      status: 'active',
    });

    prospectorAId = prospectorA.id;

    prospectorBId = prospectorB.id;

    noScopeUserId = noScopeUser.id;

    for (const userId of [prospectorAId, prospectorBId]) {
      await grantRepository.create({
        tenantId,

        userId,

        role: 'prospector',

        scopeType: 'team',

        organizationId,

        teamId,
      });
    }

    prospectorAToken = (await login(prospectorAEmail)).accessToken;

    prospectorBToken = (await login(prospectorBEmail)).accessToken;

    noScopeToken = (await login(noScopeEmail)).accessToken;

    await clearFollowUps();
  });

  beforeEach(async () => {
    await clearFollowUps();
  });

  afterAll(async () => {
    try {
      if (database && tenantId) {
        await clearFollowUps();

        await database
          .delete(campaignProspectAssignments)
          .where(eq(campaignProspectAssignments.tenantId, tenantId));

        await database.delete(campaignProspects).where(eq(campaignProspects.tenantId, tenantId));

        await database.delete(campaigns).where(eq(campaigns.tenantId, tenantId));

        await database.delete(establishments).where(eq(establishments.tenantId, tenantId));

        await database.delete(teams).where(eq(teams.tenantId, tenantId));

        await database.delete(users).where(eq(users.tenantId, tenantId));

        await database.delete(organizations).where(eq(organizations.tenantId, tenantId));

        await database.delete(tenants).where(eq(tenants.id, tenantId));
      }
    } finally {
      if (app) {
        await app.close();
      }
    }
  });

  it('rejects follow-up creation without authentication', async () => {
    const response = await getApp().inject({
      method: 'POST',

      url: followUpUrl(),

      payload: {
        dueAt: new Date(Date.now() + 86_400_000).toISOString(),
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it('creates a self-owned pending follow-up with server-derived context', async () => {
    const dueAt = new Date(Date.now() + 86_400_000);

    const created = await createFollowUpViaApi({
      dueAt,
    });

    expect(created.statusCode).toBe(201);

    expect(created.body).toMatchObject({
      campaignId,

      campaignProspectId: prospectId,

      establishmentId,

      assignedUserId: prospectorAId,

      createdBy: prospectorAId,

      status: 'pending',

      completedAt: null,

      cancelledAt: null,
    });

    expect(created.body).not.toHaveProperty('tenantId');

    expect(created.body).not.toHaveProperty('assignmentId');

    const followUpId = created.body.id;

    expect(typeof followUpId).toBe('string');

    const [persisted] = await getDatabase()
      .select()
      .from(prospectFollowUps)
      .where(eq(prospectFollowUps.id, followUpId as string));

    expect(persisted).toBeDefined();

    expect(persisted?.tenantId).toBe(tenantId);

    expect(persisted?.assignmentId).toBe(assignmentId);

    expect(persisted?.createdBy).toBe(prospectorAId);

    expect(persisted?.assignedUserId).toBe(prospectorAId);
  });

  it('isolates notification inbox and mark-read access by authenticated recipient', async () => {
    const dueAtA = new Date(Date.now() + 60 * 60 * 1000);

    const dueAtB = new Date(Date.now() + 2 * 60 * 60 * 1000);

    const followUpA = await createFollowUpViaApi({
      token: prospectorAToken,

      targetCampaignId: campaignId,

      targetProspectId: prospectId,

      dueAt: dueAtA,
    });

    const followUpB = await createFollowUpViaApi({
      token: prospectorBToken,

      targetCampaignId: secondCampaignId,

      targetProspectId: secondProspectId,

      dueAt: dueAtB,
    });

    expect(followUpA.statusCode).toBe(201);

    expect(followUpB.statusCode).toBe(201);

    const [notificationA] = await getDatabase()
      .insert(notifications)
      .values({
        tenantId,

        recipientUserId: prospectorAId,

        type: 'follow_up_reminder',

        followUpId: followUpA.body.id as string,

        scheduledFor: dueAtA,

        title: 'Prospector A reminder',

        message: 'Prospector A private notification',
      })
      .returning();

    const [notificationB] = await getDatabase()
      .insert(notifications)
      .values({
        tenantId,

        recipientUserId: prospectorBId,

        type: 'follow_up_reminder',

        followUpId: followUpB.body.id as string,

        scheduledFor: dueAtB,

        title: 'Prospector B reminder',

        message: 'Prospector B private notification',
      })
      .returning();

    if (!notificationA || !notificationB) {
      throw new Error('Failed to create notification security fixtures');
    }

    /*
     * A's inbox must contain only A's notification.
     */
    const inboxResponse = await getApp().inject({
      method: 'GET',

      url: '/notifications',

      headers: {
        authorization: `Bearer ${prospectorAToken}`,
      },
    });

    expect(inboxResponse.statusCode).toBe(200);

    const inbox = JSON.parse(inboxResponse.payload) as Array<{
      id: string;

      recipientUserId: string;
    }>;

    const inboxIds = inbox.map((notification) => notification.id);

    expect(inboxIds).toContain(notificationA.id);

    expect(inboxIds).not.toContain(notificationB.id);

    expect(inbox.every((notification) => notification.recipientUserId === prospectorAId)).toBe(
      true,
    );

    /*
     * A may mark A's notification as read.
     */
    const ownMarkReadResponse = await getApp().inject({
      method: 'PATCH',

      url: `/notifications/${notificationA.id}/read`,

      headers: {
        authorization: `Bearer ${prospectorAToken}`,
      },
    });

    expect(ownMarkReadResponse.statusCode).toBe(200);

    const ownMarkedNotification = JSON.parse(ownMarkReadResponse.payload) as {
      id: string;

      recipientUserId: string;

      readAt: string | null;
    };

    expect(ownMarkedNotification.id).toBe(notificationA.id);

    expect(ownMarkedNotification.recipientUserId).toBe(prospectorAId);

    expect(ownMarkedNotification.readAt).not.toBeNull();

    /*
     * A knows B's real notification UUID but must receive
     * the same public security response as for a UUID that
     * does not exist at all.
     */
    const foreignMarkReadResponse = await getApp().inject({
      method: 'PATCH',

      url: `/notifications/${notificationB.id}/read`,

      headers: {
        authorization: `Bearer ${prospectorAToken}`,
      },
    });

    const missingMarkReadResponse = await getApp().inject({
      method: 'PATCH',

      url: `/notifications/${randomUUID()}/read`,

      headers: {
        authorization: `Bearer ${prospectorAToken}`,
      },
    });

    expect(foreignMarkReadResponse.statusCode).toBe(404);

    expect(missingMarkReadResponse.statusCode).toBe(404);

    const foreignBody = JSON.parse(foreignMarkReadResponse.payload) as {
      statusCode: number;

      code: string;

      message: string;

      error: string;

      requestId: string;
    };

    const missingBody = JSON.parse(missingMarkReadResponse.payload) as {
      statusCode: number;

      code: string;

      message: string;

      error: string;

      requestId: string;
    };

    expect(foreignBody).toMatchObject({
      statusCode: 404,

      code: 'NOT_FOUND',

      message: 'Notification not found',

      error: 'Not Found',
    });

    expect(missingBody).toMatchObject({
      statusCode: 404,

      code: 'NOT_FOUND',

      message: 'Notification not found',

      error: 'Not Found',
    });

    /*
     * requestId is intentionally excluded from the
     * anti-enumeration comparison because each HTTP
     * request receives its own trace identifier.
     */
    expect({
      statusCode: foreignBody.statusCode,

      code: foreignBody.code,

      message: foreignBody.message,

      error: foreignBody.error,
    }).toEqual({
      statusCode: missingBody.statusCode,

      code: missingBody.code,

      message: missingBody.message,

      error: missingBody.error,
    });

    expect(foreignBody.requestId).not.toBe(missingBody.requestId);

    /*
     * Failed foreign access must not mutate B's row.
     */
    const [persistedB] = await getDatabase()
      .select()
      .from(notifications)
      .where(eq(notifications.id, notificationB.id));

    expect(persistedB).toBeDefined();

    expect(persistedB?.readAt).toBeNull();
  });

  it('rejects a past due date', async () => {
    const created = await createFollowUpViaApi({
      dueAt: new Date(Date.now() - 60_000),
    });

    expect(created.statusCode).toBe(400);
  });

  it('rejects assigning ordinary prospector work to another user', async () => {
    const created = await createFollowUpViaApi({
      assignedUserId: prospectorBId,
    });

    expect(created.statusCode).toBe(403);
  });

  it('allows another eligible team prospector to complete a team-owned follow-up', async () => {
    const created = await createFollowUpViaApi({
      assignedUserId: null,
    });

    expect(created.statusCode).toBe(201);

    expect(created.body.assignedUserId).toBeNull();

    const followUpId = created.body.id as string;

    const completed = await getApp().inject({
      method: 'POST',

      url: followUpActionUrl(followUpId, 'complete'),

      headers: {
        authorization: `Bearer ${prospectorBToken}`,
        'idempotency-key': randomUUID(),
      },
    });

    expect(completed.statusCode).toBe(201);

    expect(JSON.parse(completed.payload)).toMatchObject({
      id: followUpId,

      assignedUserId: null,

      status: 'completed',

      completedAt: expect.any(String),

      cancelledAt: null,
    });
  });

  it('masks another user from mutating a user-owned follow-up', async () => {
    const created = await createFollowUpViaApi();

    expect(created.statusCode).toBe(201);

    const response = await getApp().inject({
      method: 'POST',

      url: followUpActionUrl(created.body.id as string, 'complete'),

      headers: {
        authorization: `Bearer ${prospectorBToken}`,
        'idempotency-key': randomUUID(),
      },
    });

    expect(response.statusCode).toBe(404);

    expect(JSON.parse(response.payload)).toMatchObject({
      statusCode: 404,

      message: 'Follow-up not found',
    });
  });

  it('reschedules a pending follow-up', async () => {
    const created = await createFollowUpViaApi();

    const followUpId = created.body.id as string;

    const newDueAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    const response = await getApp().inject({
      method: 'PATCH',

      url: followUpActionUrl(followUpId, 'reschedule'),

      headers: {
        authorization: `Bearer ${prospectorAToken}`,
        'idempotency-key': randomUUID(),
      },

      payload: {
        dueAt: newDueAt.toISOString(),
      },
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.payload) as {
      dueAt: string;

      status: string;
    };

    expect(body.status).toBe('pending');

    expect(body.dueAt).toBe(newDueAt.toISOString());

    const [persisted] = await getDatabase()
      .select()
      .from(prospectFollowUps)
      .where(eq(prospectFollowUps.id, followUpId));

    expect(persisted?.dueAt.toISOString()).toBe(newDueAt.toISOString());
  });

  it('rejects a second terminal transition', async () => {
    const created = await createFollowUpViaApi();

    const followUpId = created.body.id as string;

    const completed = await getApp().inject({
      method: 'POST',

      url: followUpActionUrl(followUpId, 'complete'),

      headers: {
        authorization: `Bearer ${prospectorAToken}`,
        'idempotency-key': randomUUID(),
      },
    });

    expect(completed.statusCode).toBe(201);

    const cancelled = await getApp().inject({
      method: 'POST',

      url: followUpActionUrl(followUpId, 'cancel'),

      headers: {
        authorization: `Bearer ${prospectorAToken}`,
        'idempotency-key': randomUUID(),
      },
    });

    expect(cancelled.statusCode).toBe(409);

    const [persisted] = await getDatabase()
      .select()
      .from(prospectFollowUps)
      .where(eq(prospectFollowUps.id, followUpId));

    expect(persisted?.status).toBe('completed');

    expect(persisted?.completedAt).not.toBeNull();

    expect(persisted?.cancelledAt).toBeNull();
  });

  it('returns pending and historical follow-ups for an authorized prospect reader', async () => {
    const completed = await createFollowUpViaApi();

    const completedId = completed.body.id as string;

    await getApp().inject({
      method: 'POST',

      url: followUpActionUrl(completedId, 'complete'),

      headers: {
        authorization: `Bearer ${prospectorAToken}`,
        'idempotency-key': randomUUID(),
      },
    });

    const pending = await createFollowUpViaApi({
      assignedUserId: null,
    });

    const response = await getApp().inject({
      method: 'GET',

      url: followUpUrl(),

      headers: {
        authorization: `Bearer ${prospectorBToken}`,
      },
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.payload) as {
      items: Array<Record<string, unknown>>;
    };

    const ids = body.items.map((item) => item.id);

    expect(ids).toContain(completedId);

    expect(ids).toContain(pending.body.id);

    const completedItem = body.items.find((item) => item.id === completedId);

    expect(completedItem?.status).toBe('completed');

    for (const item of body.items) {
      expect(item).not.toHaveProperty('tenantId');

      expect(item).not.toHaveProperty('assignmentId');
    }
  });

  it('masks prospect follow-up history for a user outside the current team scope', async () => {
    expect(noScopeUserId).not.toBe('');

    const response = await getApp().inject({
      method: 'GET',

      url: followUpUrl(),

      headers: {
        authorization: `Bearer ${noScopeToken}`,
      },
    });

    expect(response.statusCode).toBe(404);

    expect(JSON.parse(response.payload)).toMatchObject({
      statusCode: 404,

      message: 'Campaign prospect not found',
    });
  });

  it('returns only actionable overdue work owned by the caller or their team', async () => {
    const overdueSelfId = randomUUID();

    const overdueTeamId = randomUUID();

    const overdueOtherUserId = randomUUID();

    const upcomingSelfId = randomUUID();

    const completedId = randomUUID();

    const now = Date.now();

    await getDatabase()
      .insert(prospectFollowUps)
      .values([
        {
          id: overdueSelfId,

          tenantId,

          campaignId,

          campaignProspectId: prospectId,

          establishmentId,

          assignmentId,

          assignedUserId: prospectorAId,

          createdBy: prospectorAId,

          dueAt: new Date(now - 120_000),

          status: 'pending',
        },

        {
          id: overdueTeamId,

          tenantId,

          campaignId,

          campaignProspectId: prospectId,

          establishmentId,

          assignmentId,

          assignedUserId: null,

          createdBy: prospectorAId,

          dueAt: new Date(now - 60_000),

          status: 'pending',
        },

        {
          id: overdueOtherUserId,

          tenantId,

          campaignId,

          campaignProspectId: prospectId,

          establishmentId,

          assignmentId,

          assignedUserId: prospectorBId,

          createdBy: prospectorBId,

          dueAt: new Date(now - 30_000),

          status: 'pending',
        },

        {
          id: upcomingSelfId,

          tenantId,

          campaignId,

          campaignProspectId: prospectId,

          establishmentId,

          assignmentId,

          assignedUserId: prospectorAId,

          createdBy: prospectorAId,

          dueAt: new Date(now + 3_600_000),

          status: 'pending',
        },

        {
          id: completedId,

          tenantId,

          campaignId,

          campaignProspectId: prospectId,

          establishmentId,

          assignmentId,

          assignedUserId: prospectorAId,

          createdBy: prospectorAId,

          dueAt: new Date(now - 180_000),

          status: 'completed',

          completedAt: new Date(now - 10_000),
        },
      ]);

    const overdueResponse = await getApp().inject({
      method: 'GET',

      url: '/follow-ups?overdue=true',

      headers: {
        authorization: `Bearer ${prospectorAToken}`,
      },
    });

    expect(overdueResponse.statusCode).toBe(200);

    const overdueBody = JSON.parse(overdueResponse.payload) as {
      items: Array<{
        id: string;

        status: string;
      }>;
    };

    const overdueIds = overdueBody.items.map((item) => item.id);

    expect(overdueIds).toContain(overdueSelfId);

    expect(overdueIds).toContain(overdueTeamId);

    expect(overdueIds).not.toContain(overdueOtherUserId);

    expect(overdueIds).not.toContain(upcomingSelfId);

    expect(overdueIds).not.toContain(completedId);

    const upcomingResponse = await getApp().inject({
      method: 'GET',

      url: '/follow-ups?overdue=false',

      headers: {
        authorization: `Bearer ${prospectorAToken}`,
      },
    });

    expect(upcomingResponse.statusCode).toBe(200);

    const upcomingBody = JSON.parse(upcomingResponse.payload) as {
      items: Array<{
        id: string;
      }>;
    };

    const upcomingIds = upcomingBody.items.map((item) => item.id);

    expect(upcomingIds).toContain(upcomingSelfId);

    expect(upcomingIds).not.toContain(overdueSelfId);
  });

  it('rejects the operational queue for a user without a prospector team grant', async () => {
    const response = await getApp().inject({
      method: 'GET',

      url: '/follow-ups',

      headers: {
        authorization: `Bearer ${noScopeToken}`,
      },
    });

    expect(response.statusCode).toBe(403);
  });

  it('turns a pending cross-campaign follow-up into PLANNED_ACTION and removes the block after completion', async () => {
    const created = await createFollowUpViaApi({
      token: prospectorBToken,

      targetCampaignId: secondCampaignId,

      targetProspectId: secondProspectId,
    });

    expect(created.statusCode).toBe(201);

    const before = await getApp().inject({
      method: 'GET',

      url: collisionDecisionUrl(),

      headers: {
        authorization: `Bearer ${prospectorAToken}`,
      },
    });

    expect(before.statusCode).toBe(200);

    expect(JSON.parse(before.payload)).toMatchObject({
      decision: 'block',

      reasonCode: 'PLANNED_ACTION',
    });

    const completed = await getApp().inject({
      method: 'POST',

      url: followUpActionUrl(
        created.body.id as string,

        'complete',

        secondCampaignId,

        secondProspectId,
      ),

      headers: {
        authorization: `Bearer ${prospectorBToken}`,
        'idempotency-key': randomUUID(),
      },
    });

    expect(completed.statusCode).toBe(201);

    const after = await getApp().inject({
      method: 'GET',

      url: collisionDecisionUrl(),

      headers: {
        authorization: `Bearer ${prospectorAToken}`,
      },
    });

    expect(after.statusCode).toBe(200);

    const afterBody = JSON.parse(after.payload) as {
      reasonCode: string;

      decision: string;
    };

    expect(afterBody.reasonCode).not.toBe('PLANNED_ACTION');

    /*
     * Campaign B still has a current assignment,
     * therefore the lower-priority assignment
     * warning remains.
     */
    expect(afterBody).toMatchObject({
      decision: 'warn',

      reasonCode: 'ACTIVE_ASSIGNMENT',
    });
  });

  it('removes PLANNED_ACTION after cancellation', async () => {
    const created = await createFollowUpViaApi({
      token: prospectorBToken,

      targetCampaignId: secondCampaignId,

      targetProspectId: secondProspectId,
    });

    const before = await getApp().inject({
      method: 'GET',

      url: collisionDecisionUrl(),

      headers: {
        authorization: `Bearer ${prospectorAToken}`,
      },
    });

    expect(JSON.parse(before.payload)).toMatchObject({
      decision: 'block',

      reasonCode: 'PLANNED_ACTION',
    });

    const cancelled = await getApp().inject({
      method: 'POST',

      url: followUpActionUrl(
        created.body.id as string,

        'cancel',

        secondCampaignId,

        secondProspectId,
      ),

      headers: {
        authorization: `Bearer ${prospectorBToken}`,
        'idempotency-key': randomUUID(),
      },
    });

    expect(cancelled.statusCode).toBe(201);

    const after = await getApp().inject({
      method: 'GET',

      url: collisionDecisionUrl(),

      headers: {
        authorization: `Bearer ${prospectorAToken}`,
      },
    });

    const afterBody = JSON.parse(after.payload) as {
      reasonCode: string;
    };

    expect(afterBody.reasonCode).not.toBe('PLANNED_ACTION');
  });

  it('does not treat a team-owned follow-up on the exact prospect as a collision for another eligible teammate', async () => {
    const created = await createFollowUpViaApi({
      assignedUserId: null,
    });

    expect(created.statusCode).toBe(201);

    const response = await getApp().inject({
      method: 'GET',

      url: collisionDecisionUrl(),

      headers: {
        authorization: `Bearer ${prospectorBToken}`,
      },
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.payload) as {
      reasonCode: string;
    };

    expect(body.reasonCode).not.toBe('PLANNED_ACTION');
  });

  it('ignores a pending follow-up tied to an ended assignment', async () => {
    /*
     * Historical assignment for Campaign B.
     *
     * The actual current secondAssignmentId stays
     * untouched, so this test cannot contaminate
     * the shared fixture.
     */
    const staleAssignedAt = new Date(Date.now() - 60_000);

    const staleEndedAt = new Date();

    const [staleAssignment] = await getDatabase()
      .insert(campaignProspectAssignments)
      .values({
        tenantId,

        campaignId: secondCampaignId,

        campaignProspectId: secondProspectId,

        organizationId,

        teamId,

        assignedUserId: prospectorBId,

        assignedAt: staleAssignedAt,

        endedAt: staleEndedAt,
      })
      .returning();

    if (!staleAssignment) {
      throw new Error('Failed to create stale assignment');
    }

    const staleFollowUpId = randomUUID();

    try {
      await getDatabase()
        .insert(prospectFollowUps)
        .values({
          id: staleFollowUpId,

          tenantId,

          campaignId: secondCampaignId,

          campaignProspectId: secondProspectId,

          establishmentId,

          assignmentId: staleAssignment.id,

          assignedUserId: prospectorBId,

          createdBy: prospectorBId,

          dueAt: new Date(Date.now() + 86_400_000),

          status: 'pending',
        });

      const collisionResponse = await getApp().inject({
        method: 'GET',

        url: collisionDecisionUrl(),

        headers: {
          authorization: `Bearer ${prospectorAToken}`,
        },
      });

      expect(collisionResponse.statusCode).toBe(200);

      const collisionBody = JSON.parse(collisionResponse.payload) as {
        reasonCode: string;
      };

      expect(collisionBody.reasonCode).not.toBe('PLANNED_ACTION');

      const queueResponse = await getApp().inject({
        method: 'GET',

        url: '/follow-ups',

        headers: {
          authorization: `Bearer ${prospectorBToken}`,
        },
      });

      expect(queueResponse.statusCode).toBe(200);

      const queueBody = JSON.parse(queueResponse.payload) as {
        items: Array<{
          id: string;
        }>;
      };

      expect(queueBody.items.map((item) => item.id)).not.toContain(staleFollowUpId);
    } finally {
      await getDatabase()
        .delete(prospectFollowUps)
        .where(eq(prospectFollowUps.id, staleFollowUpId));

      await getDatabase()
        .delete(campaignProspectAssignments)
        .where(eq(campaignProspectAssignments.id, staleAssignment.id));
    }
  });

  it('uses the configured queue limit', async () => {
    const now = Date.now();

    await getDatabase()
      .insert(prospectFollowUps)
      .values(
        [1, 2, 3].map((offset) => ({
          tenantId,

          campaignId,

          campaignProspectId: prospectId,

          establishmentId,

          assignmentId,

          assignedUserId: prospectorAId,

          createdBy: prospectorAId,

          dueAt: new Date(now + offset * 60_000),

          status: 'pending' as const,
        })),
      );

    const response = await getApp().inject({
      method: 'GET',

      url: '/follow-ups?limit=2',

      headers: {
        authorization: `Bearer ${prospectorAToken}`,
      },
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.payload) as {
      items: unknown[];
    };

    expect(body.items).toHaveLength(2);
  });

  it('rejects invalid queue filters', async () => {
    const invalidLimit = await getApp().inject({
      method: 'GET',

      url: '/follow-ups?limit=101',

      headers: {
        authorization: `Bearer ${prospectorAToken}`,
      },
    });

    expect(invalidLimit.statusCode).toBe(400);

    const invalidOverdue = await getApp().inject({
      method: 'GET',

      url: '/follow-ups?overdue=maybe',

      headers: {
        authorization: `Bearer ${prospectorAToken}`,
      },
    });

    expect(invalidOverdue.statusCode).toBe(400);
  });

  /*
   * Sanity check that the fixture's current
   * second assignment remains intact after the
   * stale-assignment test above.
   */
  it('preserves the current second campaign assignment fixture', async () => {
    const [current] = await getDatabase()
      .select()
      .from(campaignProspectAssignments)
      .where(eq(campaignProspectAssignments.id, secondAssignmentId));

    expect(current).toBeDefined();

    expect(current?.endedAt).toBeNull();
  });
});
