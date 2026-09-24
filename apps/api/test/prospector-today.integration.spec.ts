import { clearSessionEvidenceForUsers } from './support/session-evidence.js';
import { randomUUID } from 'node:crypto';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import type { AuthenticationTokens } from '../src/auth/auth.types.js';
import { PasswordService } from '../src/auth/password.service.js';
import { UserAccessGrantRepository } from '../src/authorization/user-access-grant.repository.js';
import { DATABASE } from '../src/database/database.constants.js';
import type { Database } from '../src/database/database.types.js';
import { campaignProspectAssignments } from '../src/database/schema/campaign-prospect-assignments.js';
import {
  campaignProspects,
  type CampaignProspectStatus,
} from '../src/database/schema/campaign-prospects.js';
import { campaigns } from '../src/database/schema/campaigns.js';
import { establishments } from '../src/database/schema/establishments.js';
import { organizations } from '../src/database/schema/organizations.js';
import {
  prospectFollowUps,
  type ProspectFollowUpCategory,
  type ProspectFollowUpChannel,
  type ProspectFollowUpStatus,
} from '../src/database/schema/prospect-follow-ups.js';
import { teams } from '../src/database/schema/teams.js';
import { tenants } from '../src/database/schema/tenants.js';
import { userAccessGrants } from '../src/database/schema/user-access-grants.js';
import { users } from '../src/database/schema/users.js';
import type { ProspectorTodayResponse } from '../src/prospector-today/prospector-today.types.js';
import { TenantService } from '../src/tenants/tenant.service.js';
import { UserRepository } from '../src/users/user.repository.js';

interface AssignedProspectFixture {
  campaignId: string;

  prospectId: string;

  establishmentId: string;

  assignmentId: string;
}

const TIME_ZONE_CANDIDATES = [
  'Pacific/Pago_Pago',
  'Pacific/Honolulu',
  'America/Los_Angeles',
  'America/New_York',
  'UTC',
  'Europe/Paris',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Tokyo',
  'Pacific/Auckland',
  'Pacific/Kiritimati',
] as const;

function selectTestTimeZone(now = new Date()): string {
  /*
   * Pick the candidate closest to local midnight. This leaves a large,
   * deterministic part of the selected local day in which boundary and cap
   * fixtures can be inserted, regardless of the CI server's own time zone.
   */
  return TIME_ZONE_CANDIDATES.map((timeZone) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);

    const value = (type: Intl.DateTimeFormatPartTypes): number =>
      Number(parts.find((part) => part.type === type)?.value ?? 0);

    return {
      timeZone,
      secondsSinceMidnight: (value('hour') % 24) * 3_600 + value('minute') * 60 + value('second'),
    };
  }).sort((left, right) => left.secondsSinceMidnight - right.secondsSinceMidnight)[0]!.timeZone;
}

describe('Prospector Today HTTP integration', () => {
  let app: NestFastifyApplication | undefined;
  let database: Database | undefined;

  let tenantId = '';
  let organizationId = '';
  let teamId = '';
  let otherTeamId = '';

  let prospectorId = '';
  let otherProspectorId = '';

  let prospectorToken = '';
  let otherProspectorToken = '';
  let managerToken = '';

  let activeCampaignId = '';
  let pausedCampaignId = '';

  let selfProspect!: AssignedProspectFixture;
  let teamProspect!: AssignedProspectFixture;
  let otherUserProspect!: AssignedProspectFixture;
  let otherTeamProspect!: AssignedProspectFixture;
  let endedProspect!: AssignedProspectFixture;
  let excludedProspect!: AssignedProspectFixture;
  let pausedCampaignProspect!: AssignedProspectFixture;

  const password = 'ProspectorTodayIntegration123!';
  const testTimeZone = selectTestTimeZone();

  function getApp(): NestFastifyApplication {
    if (!app) {
      throw new Error('Prospector Today test application has not been initialized');
    }

    return app;
  }

  function getDatabase(): Database {
    if (!database) {
      throw new Error('Prospector Today test database has not been initialized');
    }

    return database;
  }

  function todayUrl(requestedTeamId = teamId, timeZone = testTimeZone): string {
    const query = new URLSearchParams({
      teamId: requestedTeamId,
      timeZone,
    });

    return `/prospector/today?${query.toString()}`;
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

  async function requestToday(
    token = prospectorToken,
    requestedTeamId = teamId,
    timeZone = testTimeZone,
  ): Promise<{
    response: Awaited<ReturnType<NestFastifyApplication['inject']>>;
    body: ProspectorTodayResponse;
  }> {
    const response = await getApp().inject({
      method: 'GET',
      url: todayUrl(requestedTeamId, timeZone),
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    return {
      response,
      body: JSON.parse(response.payload) as ProspectorTodayResponse,
    };
  }

  async function insertAssignedProspect(input: {
    label: string;
    campaignId: string;
    teamId: string;
    assignedUserId: string | null;
    prospectStatus?: CampaignProspectStatus;
    endedAt?: Date;
  }): Promise<AssignedProspectFixture> {
    const suffix = randomUUID().replaceAll('-', '').slice(0, 10);

    const [establishment] = await getDatabase()
      .insert(establishments)
      .values({
        tenantId,
        name: input.label,
        normalizedName: input.label.toLowerCase(),
        city: 'Nancy',
        countryCode: 'FR',
        source: 'manual',
        status: 'active',
      })
      .returning();

    if (!establishment) {
      throw new Error(`Failed to create establishment ${input.label}`);
    }

    const [prospect] = await getDatabase()
      .insert(campaignProspects)
      .values({
        tenantId,
        campaignId: input.campaignId,
        establishmentId: establishment.id,
        status: input.prospectStatus ?? 'active',
      })
      .returning();

    if (!prospect) {
      throw new Error(`Failed to create campaign prospect ${input.label}`);
    }

    const assignedAt = new Date(Date.now() - 48 * 60 * 60 * 1_000);

    const [assignment] = await getDatabase()
      .insert(campaignProspectAssignments)
      .values({
        tenantId,
        campaignId: input.campaignId,
        campaignProspectId: prospect.id,
        organizationId,
        teamId: input.teamId,
        assignedUserId: input.assignedUserId,
        assignedAt,
        endedAt: input.endedAt,
      })
      .returning();

    if (!assignment) {
      throw new Error(`Failed to create assignment ${suffix}`);
    }

    return {
      campaignId: input.campaignId,
      prospectId: prospect.id,
      establishmentId: establishment.id,
      assignmentId: assignment.id,
    };
  }

  async function insertFollowUp(input: {
    fixture: AssignedProspectFixture;
    dueAt: Date;
    assignedUserId?: string | null;
    createdBy?: string;
    category?: ProspectFollowUpCategory;
    channel?: ProspectFollowUpChannel | null;
    status?: ProspectFollowUpStatus;
    id?: string;
  }): Promise<string> {
    const id = input.id ?? randomUUID();
    const status = input.status ?? 'pending';
    const terminalAt = new Date(input.dueAt.getTime() + 1_000);

    await getDatabase()
      .insert(prospectFollowUps)
      .values({
        id,
        tenantId,
        campaignId: input.fixture.campaignId,
        campaignProspectId: input.fixture.prospectId,
        establishmentId: input.fixture.establishmentId,
        assignmentId: input.fixture.assignmentId,
        assignedUserId: input.assignedUserId === undefined ? prospectorId : input.assignedUserId,
        createdBy: input.createdBy ?? prospectorId,
        dueAt: input.dueAt,
        category: input.category ?? 'follow_up',
        channel: input.channel === undefined ? null : input.channel,
        status,
        completedAt: status === 'completed' ? terminalAt : null,
        cancelledAt: status === 'cancelled' ? terminalAt : null,
      });

    return id;
  }

  async function emptyToday(): Promise<ProspectorTodayResponse> {
    const { response, body } = await requestToday();

    expect(response.statusCode).toBe(200);

    return body;
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

    const tenant = await tenantService.create({
      name: `Prospector Today Tenant ${suffix}`,
      slug: `prospector-today-${suffix}`,
    });

    tenantId = tenant.id;

    const [organization] = await getDatabase()
      .insert(organizations)
      .values({
        tenantId,
        name: 'Prospector Today France',
        slug: `prospector-today-france-${suffix}`,
        status: 'active',
      })
      .returning();

    if (!organization) {
      throw new Error('Failed to create Prospector Today organization');
    }

    organizationId = organization.id;

    const [team, otherTeam] = await getDatabase()
      .insert(teams)
      .values([
        {
          tenantId,
          organizationId,
          name: 'Prospector Today Team',
          slug: `prospector-today-team-${suffix}`,
          status: 'active' as const,
        },
        {
          tenantId,
          organizationId,
          name: 'Prospector Today Other Team',
          slug: `prospector-today-other-team-${suffix}`,
          status: 'active' as const,
        },
      ])
      .returning();

    if (!team || !otherTeam) {
      throw new Error('Failed to create Prospector Today teams');
    }

    teamId = team.id;
    otherTeamId = otherTeam.id;

    const passwordHash = await passwordService.hash(password);
    const prospectorEmail = `prospector-today-${suffix}@trackroster.test`;
    const otherProspectorEmail = `prospector-today-other-${suffix}@trackroster.test`;
    const managerEmail = `prospector-today-manager-${suffix}@trackroster.test`;

    const prospector = await userRepository.create({
      tenantId,
      email: prospectorEmail,
      passwordHash,
      status: 'active',
    });

    const otherProspector = await userRepository.create({
      tenantId,
      email: otherProspectorEmail,
      passwordHash,
      status: 'active',
    });

    const manager = await userRepository.create({
      tenantId,
      email: managerEmail,
      passwordHash,
      status: 'active',
    });

    prospectorId = prospector.id;
    otherProspectorId = otherProspector.id;

    await grantRepository.create({
      tenantId,
      userId: prospector.id,
      role: 'prospector',
      scopeType: 'team',
      organizationId,
      teamId,
    });

    await grantRepository.create({
      tenantId,
      userId: otherProspector.id,
      role: 'prospector',
      scopeType: 'team',
      organizationId,
      teamId,
    });

    await grantRepository.create({
      tenantId,
      userId: manager.id,
      role: 'manager',
      scopeType: 'team',
      organizationId,
      teamId,
    });

    const [activeCampaign, pausedCampaign] = await getDatabase()
      .insert(campaigns)
      .values([
        {
          tenantId,
          organizationId,
          name: 'Prospector Today Active Campaign',
          status: 'active' as const,
        },
        {
          tenantId,
          organizationId,
          name: 'Prospector Today Paused Campaign',
          status: 'paused' as const,
        },
      ])
      .returning();

    if (!activeCampaign || !pausedCampaign) {
      throw new Error('Failed to create Prospector Today campaigns');
    }

    activeCampaignId = activeCampaign.id;
    pausedCampaignId = pausedCampaign.id;

    selfProspect = await insertAssignedProspect({
      label: 'Today Self Prospect',
      campaignId: activeCampaignId,
      teamId,
      assignedUserId: prospectorId,
    });

    teamProspect = await insertAssignedProspect({
      label: 'Today Team Prospect',
      campaignId: activeCampaignId,
      teamId,
      assignedUserId: null,
    });

    otherUserProspect = await insertAssignedProspect({
      label: 'Today Other User Prospect',
      campaignId: activeCampaignId,
      teamId,
      assignedUserId: otherProspectorId,
    });

    otherTeamProspect = await insertAssignedProspect({
      label: 'Today Other Team Prospect',
      campaignId: activeCampaignId,
      teamId: otherTeamId,
      assignedUserId: prospectorId,
    });

    endedProspect = await insertAssignedProspect({
      label: 'Today Ended Prospect',
      campaignId: activeCampaignId,
      teamId,
      assignedUserId: prospectorId,
      endedAt: new Date(Date.now() - 60 * 60 * 1_000),
    });

    excludedProspect = await insertAssignedProspect({
      label: 'Today Excluded Prospect',
      campaignId: activeCampaignId,
      teamId,
      assignedUserId: prospectorId,
      prospectStatus: 'excluded',
    });

    pausedCampaignProspect = await insertAssignedProspect({
      label: 'Today Paused Campaign Prospect',
      campaignId: pausedCampaignId,
      teamId,
      assignedUserId: prospectorId,
    });

    prospectorToken = (await login(prospectorEmail)).accessToken;
    otherProspectorToken = (await login(otherProspectorEmail)).accessToken;
    managerToken = (await login(managerEmail)).accessToken;
  });

  beforeEach(async () => {
    if (database && tenantId) {
      await database.delete(prospectFollowUps).where(eq(prospectFollowUps.tenantId, tenantId));
    }
  });

  afterAll(async () => {
    try {
      if (database && tenantId) {
        await database.delete(prospectFollowUps).where(eq(prospectFollowUps.tenantId, tenantId));

        await database
          .delete(campaignProspectAssignments)
          .where(eq(campaignProspectAssignments.tenantId, tenantId));

        await database.delete(campaignProspects).where(eq(campaignProspects.tenantId, tenantId));

        await database.delete(campaigns).where(eq(campaigns.tenantId, tenantId));
        await database.delete(establishments).where(eq(establishments.tenantId, tenantId));
        await database.delete(userAccessGrants).where(eq(userAccessGrants.tenantId, tenantId));
        await clearSessionEvidenceForUsers(database, eq(users.tenantId, tenantId));
        await database.delete(users).where(eq(users.tenantId, tenantId));
        await database.delete(teams).where(eq(teams.tenantId, tenantId));
        await database.delete(organizations).where(eq(organizations.tenantId, tenantId));
        await database.delete(tenants).where(eq(tenants.id, tenantId));
      }
    } finally {
      if (app) {
        await app.close();
      }
    }
  });

  it('rejects unauthenticated access', async () => {
    const response = await getApp().inject({
      method: 'GET',
      url: todayUrl(),
    });

    expect(response.statusCode).toBe(401);
  });

  it('validates both required query fields and rejects unknown query fields', async () => {
    const urls = [
      '/prospector/today',
      `/prospector/today?teamId=${teamId}`,
      `/prospector/today?teamId=not-a-uuid&timeZone=UTC`,
      `/prospector/today?teamId=${teamId}&timeZone=Not%2FAZone`,
      `${todayUrl()}&unexpected=true`,
    ];

    for (const url of urls) {
      const response = await getApp().inject({
        method: 'GET',
        url,
        headers: {
          authorization: `Bearer ${prospectorToken}`,
        },
      });

      expect(response.statusCode, url).toBe(400);
    }
  });

  it('requires an exact Prospector team grant before reading operational data', async () => {
    const managerResponse = await getApp().inject({
      method: 'GET',
      url: todayUrl(),
      headers: {
        authorization: `Bearer ${managerToken}`,
      },
    });

    expect(managerResponse.statusCode).toBe(403);

    const wrongTeamResponse = await getApp().inject({
      method: 'GET',
      url: todayUrl(otherTeamId),
      headers: {
        authorization: `Bearer ${prospectorToken}`,
      },
    });

    expect(wrongTeamResponse.statusCode).toBe(403);
  });

  it('returns a timezone-qualified empty dashboard contract', async () => {
    const body = await emptyToday();

    expect(Number.isNaN(Date.parse(body.generatedAt))).toBe(false);
    expect(body.day.timeZone).toBe(testTimeZone);
    expect(body.day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Date.parse(body.day.startsAt)).toBeLessThanOrEqual(Date.parse(body.generatedAt));
    expect(Date.parse(body.generatedAt)).toBeLessThan(Date.parse(body.day.endsAt));
    expect(body.summary).toEqual({
      actionsLeft: 0,
      toDo: 0,
      followUps: 0,
      meetings: 0,
      overdue: 0,
      completedToday: 0,
    });
    expect(body.priorities).toEqual([]);
  });

  it('uses the request timezone day end and the server instant for exact summary boundaries', async () => {
    const initial = await emptyToday();
    const initialNow = Date.parse(initial.generatedAt);
    const endsAt = Date.parse(initial.day.endsAt);
    const remaining = endsAt - initialNow;

    expect(remaining).toBeGreaterThan(60 * 60 * 1_000);

    const overdueId = await insertFollowUp({
      fixture: selfProspect,
      dueAt: new Date(initialNow - 60_000),
      category: 'follow_up',
      channel: 'visit',
    });

    const todoId = await insertFollowUp({
      fixture: selfProspect,
      dueAt: new Date(initialNow + Math.floor(remaining / 4)),
      category: 'todo',
      channel: 'call',
    });

    const followUpId = await insertFollowUp({
      fixture: selfProspect,
      dueAt: new Date(initialNow + Math.floor(remaining / 2)),
      category: 'follow_up',
      channel: 'email',
    });

    const meetingId = await insertFollowUp({
      fixture: selfProspect,
      dueAt: new Date(endsAt - 1),
      category: 'meeting',
      channel: 'visit',
    });

    const exactEndId = await insertFollowUp({
      fixture: selfProspect,
      dueAt: new Date(endsAt),
      category: 'todo',
      channel: 'message',
    });

    const { response, body } = await requestToday();

    expect(response.statusCode).toBe(200);
    expect(body.summary).toEqual({
      actionsLeft: 4,
      toDo: 1,
      followUps: 1,
      meetings: 1,
      overdue: 1,
      completedToday: 0,
    });

    expect(body.priorities.map((priority) => priority.id)).toEqual([
      overdueId,
      todoId,
      followUpId,
      meetingId,
    ]);
    expect(body.priorities.some((priority) => priority.id === exactEndId)).toBe(false);
    expect(body.priorities[0]).toMatchObject({
      id: overdueId,
      isOverdue: true,
      category: 'follow_up',
      channel: 'visit',
      establishment: {
        id: selfProspect.establishmentId,
        name: 'Today Self Prospect',
        city: 'Nancy',
      },
    });
    expect(body.priorities.slice(1).every((priority) => !priority.isOverdue)).toBe(true);
  });

  it('enforces assignment, follow-up owner, team, lifecycle, and status scope', async () => {
    const initial = await emptyToday();
    const generatedAt = Date.parse(initial.generatedAt);
    const endsAt = Date.parse(initial.day.endsAt);
    const dueAt = new Date(generatedAt + Math.floor((endsAt - generatedAt) / 2));

    const selfPersonalId = await insertFollowUp({
      fixture: selfProspect,
      dueAt,
      assignedUserId: prospectorId,
      category: 'todo',
    });

    const teamOwnedOnSelfId = await insertFollowUp({
      fixture: selfProspect,
      dueAt,
      assignedUserId: null,
      category: 'follow_up',
    });

    const sharedTeamAssignmentId = await insertFollowUp({
      fixture: teamProspect,
      dueAt,
      assignedUserId: null,
      category: 'meeting',
    });

    const otherPersonalId = await insertFollowUp({
      fixture: otherUserProspect,
      dueAt,
      assignedUserId: otherProspectorId,
      createdBy: otherProspectorId,
    });

    const teamOwnedOnOtherId = await insertFollowUp({
      fixture: otherUserProspect,
      dueAt,
      assignedUserId: null,
      createdBy: otherProspectorId,
    });

    await insertFollowUp({
      fixture: selfProspect,
      dueAt,
      assignedUserId: otherProspectorId,
    });

    await insertFollowUp({
      fixture: otherUserProspect,
      dueAt,
      assignedUserId: prospectorId,
    });

    await insertFollowUp({
      fixture: otherTeamProspect,
      dueAt,
      assignedUserId: prospectorId,
    });

    await insertFollowUp({
      fixture: endedProspect,
      dueAt,
      assignedUserId: prospectorId,
    });

    await insertFollowUp({
      fixture: excludedProspect,
      dueAt,
      assignedUserId: prospectorId,
    });

    await insertFollowUp({
      fixture: pausedCampaignProspect,
      dueAt,
      assignedUserId: prospectorId,
    });

    await insertFollowUp({
      fixture: selfProspect,
      dueAt,
      assignedUserId: prospectorId,
      status: 'completed',
    });

    await insertFollowUp({
      fixture: selfProspect,
      dueAt,
      assignedUserId: prospectorId,
      status: 'cancelled',
    });

    const currentUserResult = await requestToday();

    expect(currentUserResult.response.statusCode).toBe(200);
    expect(currentUserResult.body.priorities.map((priority) => priority.id).sort()).toEqual(
      [selfPersonalId, teamOwnedOnSelfId, sharedTeamAssignmentId].sort(),
    );
    expect(currentUserResult.body.summary.actionsLeft).toBe(3);

    const otherUserResult = await requestToday(otherProspectorToken);

    expect(otherUserResult.response.statusCode).toBe(200);
    expect(otherUserResult.body.priorities.map((priority) => priority.id).sort()).toEqual(
      [otherPersonalId, teamOwnedOnOtherId, sharedTeamAssignmentId].sort(),
    );
    expect(otherUserResult.body.summary.actionsLeft).toBe(3);
  });

  it('caps priority rows at 25 while keeping summary counts authoritative', async () => {
    const initial = await emptyToday();
    const generatedAt = Date.parse(initial.generatedAt);
    const endsAt = Date.parse(initial.day.endsAt);
    const interval = Math.floor((endsAt - generatedAt) / 29);

    expect(interval).toBeGreaterThan(0);

    const expectedIds: string[] = [];

    for (let index = 0; index < 27; index += 1) {
      expectedIds.push(
        await insertFollowUp({
          fixture: selfProspect,
          dueAt: new Date(generatedAt + interval * (index + 1)),
          assignedUserId: prospectorId,
          category: index % 3 === 0 ? 'todo' : index % 3 === 1 ? 'follow_up' : 'meeting',
          channel: 'call',
        }),
      );
    }

    const { response, body } = await requestToday();

    expect(response.statusCode).toBe(200);
    expect(body.summary).toEqual({
      actionsLeft: 27,
      toDo: 9,
      followUps: 9,
      meetings: 9,
      overdue: 0,
      completedToday: 0,
    });
    expect(body.priorities).toHaveLength(25);
    expect(body.priorities.map((priority) => priority.id)).toEqual(expectedIds.slice(0, 25));
    expect(body.priorities.some((priority) => expectedIds.slice(25).includes(priority.id))).toBe(
      false,
    );
  });
});
