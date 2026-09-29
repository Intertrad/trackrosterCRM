import { clearSessionEvidenceForUsers } from './support/session-evidence.js';
import { randomUUID } from 'node:crypto';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import type { AuthenticationTokens } from '../src/auth/auth.types.js';
import { PasswordService } from '../src/auth/password.service.js';
import { UserAccessGrantRepository } from '../src/authorization/user-access-grant.repository.js';
import type { Database } from '../src/database/database.types.js';
import { campaignProspectAssignments } from '../src/database/schema/campaign-prospect-assignments.js';
import { campaignProspects } from '../src/database/schema/campaign-prospects.js';
import { campaigns } from '../src/database/schema/campaigns.js';
import { establishments } from '../src/database/schema/establishments.js';
import { organizations } from '../src/database/schema/organizations.js';
import {
  prospectActivities,
  type ProspectActivityType,
} from '../src/database/schema/prospect-activities.js';
import { prospectFollowUps } from '../src/database/schema/prospect-follow-ups.js';
import { teams } from '../src/database/schema/teams.js';
import { tenants } from '../src/database/schema/tenants.js';
import { userAccessGrants } from '../src/database/schema/user-access-grants.js';
import { users } from '../src/database/schema/users.js';
import { TenantService } from '../src/tenants/tenant.service.js';
import { UserRepository } from '../src/users/user.repository.js';
import { getSeedDatabase } from './support/seed.js';

interface WorkItem {
  campaignId: string;

  campaignProspectId: string;

  establishmentId: string;

  assignmentId: string;

  organizationId: string;

  teamId: string;

  assignedUserId: string | null;
}

interface DashboardResponse {
  generatedAt: string;

  range: {
    from: string;

    to: string;
  };

  scope: {
    authority: 'client_admin' | 'director' | 'manager';

    organizationId: string | null;

    teamId: string | null;
  };

  filters: {
    organizationId: string | null;

    teamId: string | null;

    userId: string | null;

    campaignId: string | null;
  };

  activities: {
    total: number;

    byType: Record<string, number>;

    activeProspectors: number;
  };

  assignments: {
    current: number;

    individuallyAssigned: number;

    teamOwned: number;
  };

  followUps: {
    pending: number;

    overdue: number;

    dueInRange: number;

    completedInRange: number;

    cancelledInRange: number;
  };

  byProspector: Array<{
    userId: string;

    activities: number;

    currentAssignments: number;

    pendingFollowUps: number;

    overdueFollowUps: number;
  }>;
}

describe('Manager dashboard HTTP integration', () => {
  let app: NestFastifyApplication | undefined;

  let database: Database | undefined;

  let tenantId = '';

  let foreignTenantId = '';

  let organizationAId = '';

  let organizationBId = '';

  let teamAId = '';

  let teamA2Id = '';

  let teamBId = '';

  let foreignTeamId = '';

  let campaignAId = '';

  let campaignA2Id = '';

  let campaignBId = '';

  let managerId = '';

  let directorId = '';

  let clientAdminId = '';

  let observerId = '';

  let prospectorAId = '';

  let prospectorCId = '';

  let prospectorDId = '';

  let prospectorBId = '';

  let managerToken = '';

  let directorToken = '';

  let clientAdminToken = '';

  let observerToken = '';

  let prospectorAToken = '';

  let workA1: WorkItem;

  let workA2: WorkItem;

  let historicalWorkA: WorkItem;

  let workA2Team: WorkItem;

  let workB: WorkItem;

  const password = 'ManagerDashboard123!';

  /*
   * Keep the fixture safely away from the
   * boundary between overdue/future.
   */
  const fixtureNow = new Date();

  const rangeFrom = new Date(fixtureNow.getTime() - 24 * 60 * 60 * 1000);

  const rangeTo = new Date(fixtureNow.getTime() + 24 * 60 * 60 * 1000);

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

  function dashboardUrl(input?: {
    from?: Date;

    to?: Date;

    organizationId?: string;

    teamId?: string;

    userId?: string;

    campaignId?: string;
  }): string {
    const search = new URLSearchParams();

    if (input?.from) {
      search.set('from', input.from.toISOString());
    }

    if (input?.to) {
      search.set('to', input.to.toISOString());
    }

    if (input?.organizationId) {
      search.set('organizationId', input.organizationId);
    }

    if (input?.teamId) {
      search.set('teamId', input.teamId);
    }

    if (input?.userId) {
      search.set('userId', input.userId);
    }

    if (input?.campaignId) {
      search.set('campaignId', input.campaignId);
    }

    const query = search.toString();

    return query ? `/manager/dashboard?${query}` : '/manager/dashboard';
  }

  async function requestDashboard(token: string, input?: Parameters<typeof dashboardUrl>[0]) {
    return getApp().inject({
      method: 'GET',

      url: dashboardUrl(input),

      headers: {
        authorization: `Bearer ${token}`,
      },
    });
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

  async function createCampaign(organizationId: string, name: string): Promise<string> {
    const [campaign] = await getDatabase()
      .insert(campaigns)
      .values({
        tenantId,

        organizationId,

        name,

        status: 'active',
      })
      .returning();

    if (!campaign) {
      throw new Error('Failed to create campaign fixture');
    }

    return campaign.id;
  }

  async function createWorkItem(input: {
    campaignId: string;

    organizationId: string;

    teamId: string;

    assignedUserId: string | null;

    label: string;

    endedAt?: Date;
  }): Promise<WorkItem> {
    const suffix = randomUUID().replaceAll('-', '').slice(0, 8);

    const [establishment] = await getDatabase()
      .insert(establishments)
      .values({
        tenantId,

        name: `Dashboard ${input.label}`,

        normalizedName: `dashboard ${input.label.toLowerCase()} ${suffix}`,

        city: 'Paris',

        countryCode: 'FR',

        source: 'manual',

        status: 'active',
      })
      .returning();

    if (!establishment) {
      throw new Error('Failed to create establishment fixture');
    }

    const [prospect] = await getDatabase()
      .insert(campaignProspects)
      .values({
        tenantId,

        campaignId: input.campaignId,

        establishmentId: establishment.id,

        status: 'active',
      })
      .returning();

    if (!prospect) {
      throw new Error('Failed to create campaign prospect fixture');
    }

    const [assignment] = await getDatabase()
      .insert(campaignProspectAssignments)
      .values({
        tenantId,

        campaignId: input.campaignId,

        campaignProspectId: prospect.id,

        organizationId: input.organizationId,

        teamId: input.teamId,

        assignedUserId: input.assignedUserId,

        assignedAt: new Date(fixtureNow.getTime() - 7 * 24 * 60 * 60 * 1000),

        endedAt: input.endedAt ?? null,
      })
      .returning();

    if (!assignment) {
      throw new Error('Failed to create assignment fixture');
    }

    return {
      campaignId: input.campaignId,

      campaignProspectId: prospect.id,

      establishmentId: establishment.id,

      assignmentId: assignment.id,

      organizationId: input.organizationId,

      teamId: input.teamId,

      assignedUserId: input.assignedUserId,
    };
  }

  async function createActivity(
    work: WorkItem,
    userId: string,
    type: ProspectActivityType,
    occurredAt: Date,
  ): Promise<void> {
    await getDatabase().insert(prospectActivities).values({
      tenantId,

      campaignId: work.campaignId,

      campaignProspectId: work.campaignProspectId,

      establishmentId: work.establishmentId,

      assignmentId: work.assignmentId,

      userId,

      reservationId: randomUUID(),

      type,

      occurredAt,

      createdAt: occurredAt,
    });
  }

  async function createPendingFollowUp(
    work: WorkItem,
    assignedUserId: string,
    dueAt: Date,
  ): Promise<void> {
    const createdAt = new Date(fixtureNow.getTime() - 2 * 24 * 60 * 60 * 1000);

    await getDatabase().insert(prospectFollowUps).values({
      tenantId,

      campaignId: work.campaignId,

      campaignProspectId: work.campaignProspectId,

      establishmentId: work.establishmentId,

      assignmentId: work.assignmentId,

      assignedUserId,

      createdBy: assignedUserId,

      dueAt,

      status: 'pending',

      createdAt,

      updatedAt: createdAt,
    });
  }

  async function createCompletedFollowUp(
    work: WorkItem,
    userId: string,
    completedAt: Date,
  ): Promise<void> {
    const createdAt = new Date(fixtureNow.getTime() - 2 * 24 * 60 * 60 * 1000);

    await getDatabase().insert(prospectFollowUps).values({
      tenantId,

      campaignId: work.campaignId,

      campaignProspectId: work.campaignProspectId,

      establishmentId: work.establishmentId,

      assignmentId: work.assignmentId,

      assignedUserId: userId,

      createdBy: userId,

      dueAt: completedAt,

      status: 'completed',

      completedAt,

      cancelledAt: null,

      createdAt,

      updatedAt: completedAt,
    });
  }

  async function createCancelledFollowUp(
    work: WorkItem,
    userId: string,
    cancelledAt: Date,
  ): Promise<void> {
    const createdAt = new Date(fixtureNow.getTime() - 2 * 24 * 60 * 60 * 1000);

    await getDatabase().insert(prospectFollowUps).values({
      tenantId,

      campaignId: work.campaignId,

      campaignProspectId: work.campaignProspectId,

      establishmentId: work.establishmentId,

      assignmentId: work.assignmentId,

      assignedUserId: userId,

      createdBy: userId,

      dueAt: cancelledAt,

      status: 'cancelled',

      completedAt: null,

      cancelledAt,

      createdAt,

      updatedAt: cancelledAt,
    });
  }

  function findProspectorRow(body: DashboardResponse, userId: string) {
    return body.byProspector.find((row) => row.userId === userId);
  }

  async function cleanupTenant(targetTenantId: string): Promise<void> {
    if (!database || !targetTenantId) {
      return;
    }

    await getDatabase()
      .delete(prospectFollowUps)
      .where(eq(prospectFollowUps.tenantId, targetTenantId));

    await getDatabase()
      .delete(prospectActivities)
      .where(eq(prospectActivities.tenantId, targetTenantId));

    await getDatabase()
      .delete(campaignProspectAssignments)
      .where(eq(campaignProspectAssignments.tenantId, targetTenantId));

    await getDatabase()
      .delete(campaignProspects)
      .where(eq(campaignProspects.tenantId, targetTenantId));

    await getDatabase().delete(campaigns).where(eq(campaigns.tenantId, targetTenantId));

    await getDatabase().delete(establishments).where(eq(establishments.tenantId, targetTenantId));

    await getDatabase()
      .delete(userAccessGrants)
      .where(eq(userAccessGrants.tenantId, targetTenantId));

    await getDatabase().delete(teams).where(eq(teams.tenantId, targetTenantId));

    await clearSessionEvidenceForUsers(getDatabase(), eq(users.tenantId, targetTenantId));
    await getDatabase().delete(users).where(eq(users.tenantId, targetTenantId));

    await getDatabase().delete(organizations).where(eq(organizations.tenantId, targetTenantId));

    await getDatabase().delete(tenants).where(eq(tenants.id, targetTenantId));
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

    database = getSeedDatabase();

    const tenantService = application.get(TenantService);

    const userRepository = application.get(UserRepository);

    const passwordService = application.get(PasswordService);

    const grantRepository = application.get(UserAccessGrantRepository);

    const suffix = randomUUID().replaceAll('-', '').slice(0, 10);

    /*
     * --------------------------------------------
     * PRIMARY TENANT
     * --------------------------------------------
     */
    const tenant = await tenantService.create({
      name: `Dashboard Tenant ${suffix}`,

      slug: `dashboard-${suffix}`,
    });

    tenantId = tenant.id;

    /*
     * Organization A contains TWO teams.
     *
     * This lets the suite prove:
     *
     * manager -> exact team
     * director -> whole organization
     */
    const [organizationA] = await getDatabase()
      .insert(organizations)
      .values({
        tenantId,

        name: 'Dashboard France',

        slug: `dashboard-france-${suffix}`,

        status: 'active',
      })
      .returning();

    const [organizationB] = await getDatabase()
      .insert(organizations)
      .values({
        tenantId,

        name: 'Dashboard Belgium',

        slug: `dashboard-belgium-${suffix}`,

        status: 'active',
      })
      .returning();

    if (!organizationA || !organizationB) {
      throw new Error('Failed to create dashboard organizations');
    }

    organizationAId = organizationA.id;

    organizationBId = organizationB.id;

    const [teamA] = await getDatabase()
      .insert(teams)
      .values({
        tenantId,

        organizationId: organizationAId,

        name: 'Paris Dashboard Team',

        slug: `dashboard-paris-${suffix}`,

        status: 'active',
      })
      .returning();

    const [teamA2] = await getDatabase()
      .insert(teams)
      .values({
        tenantId,

        organizationId: organizationAId,

        name: 'Lyon Dashboard Team',

        slug: `dashboard-lyon-${suffix}`,

        status: 'active',
      })
      .returning();

    const [teamB] = await getDatabase()
      .insert(teams)
      .values({
        tenantId,

        organizationId: organizationBId,

        name: 'Brussels Dashboard Team',

        slug: `dashboard-brussels-${suffix}`,

        status: 'active',
      })
      .returning();

    if (!teamA || !teamA2 || !teamB) {
      throw new Error('Failed to create dashboard teams');
    }

    teamAId = teamA.id;

    teamA2Id = teamA2.id;

    teamBId = teamB.id;

    /*
     * --------------------------------------------
     * USERS + ROLES
     * --------------------------------------------
     */
    const passwordHash = await passwordService.hash(password);

    const managerEmail = `dashboard-manager-${suffix}@trackroster.test`;

    const directorEmail = `dashboard-director-${suffix}@trackroster.test`;

    const adminEmail = `dashboard-admin-${suffix}@trackroster.test`;

    const observerEmail = `dashboard-observer-${suffix}@trackroster.test`;

    const prospectorAEmail = `dashboard-a-${suffix}@trackroster.test`;

    const prospectorCEmail = `dashboard-c-${suffix}@trackroster.test`;

    const prospectorDEmail = `dashboard-d-${suffix}@trackroster.test`;

    const prospectorBEmail = `dashboard-b-${suffix}@trackroster.test`;

    const manager = await userRepository.create({
      tenantId,

      email: managerEmail,

      passwordHash,

      status: 'active',
    });

    const director = await userRepository.create({
      tenantId,

      email: directorEmail,

      passwordHash,

      status: 'active',
    });

    const clientAdmin = await userRepository.create({
      tenantId,

      email: adminEmail,

      passwordHash,

      status: 'active',
    });

    const observer = await userRepository.create({
      tenantId,

      email: observerEmail,

      passwordHash,

      status: 'active',
    });

    const prospectorA = await userRepository.create({
      tenantId,

      email: prospectorAEmail,

      passwordHash,

      status: 'active',
    });

    const prospectorC = await userRepository.create({
      tenantId,

      email: prospectorCEmail,

      passwordHash,

      status: 'active',
    });

    const prospectorD = await userRepository.create({
      tenantId,

      email: prospectorDEmail,

      passwordHash,

      status: 'active',
    });

    const prospectorB = await userRepository.create({
      tenantId,

      email: prospectorBEmail,

      passwordHash,

      status: 'active',
    });

    managerId = manager.id;

    directorId = director.id;

    clientAdminId = clientAdmin.id;

    observerId = observer.id;

    prospectorAId = prospectorA.id;

    prospectorCId = prospectorC.id;

    prospectorDId = prospectorD.id;

    prospectorBId = prospectorB.id;

    await grantRepository.create({
      tenantId,

      userId: managerId,

      role: 'manager',

      scopeType: 'team',

      organizationId: organizationAId,

      teamId: teamAId,
    });

    await grantRepository.create({
      tenantId,

      userId: directorId,

      role: 'director',

      scopeType: 'organization',

      organizationId: organizationAId,
    });

    await grantRepository.create({
      tenantId,

      userId: clientAdminId,

      role: 'client_admin',

      scopeType: 'tenant',
    });

    await grantRepository.create({
      tenantId,

      userId: observerId,

      role: 'observer',

      scopeType: 'tenant',
    });

    await grantRepository.create({
      tenantId,

      userId: prospectorAId,

      role: 'prospector',

      scopeType: 'team',

      organizationId: organizationAId,

      teamId: teamAId,
    });

    await grantRepository.create({
      tenantId,

      userId: prospectorCId,

      role: 'prospector',

      scopeType: 'team',

      organizationId: organizationAId,

      teamId: teamAId,
    });

    await grantRepository.create({
      tenantId,

      userId: prospectorDId,

      role: 'prospector',

      scopeType: 'team',

      organizationId: organizationAId,

      teamId: teamA2Id,
    });

    await grantRepository.create({
      tenantId,

      userId: prospectorBId,

      role: 'prospector',

      scopeType: 'team',

      organizationId: organizationBId,

      teamId: teamBId,
    });

    /*
     * --------------------------------------------
     * CAMPAIGNS
     * --------------------------------------------
     */
    campaignAId = await createCampaign(organizationAId, 'Paris Dashboard Campaign');

    campaignA2Id = await createCampaign(organizationAId, 'Lyon Dashboard Campaign');

    campaignBId = await createCampaign(organizationBId, 'Brussels Dashboard Campaign');

    /*
     * --------------------------------------------
     * TEAM A CURRENT WORKLOAD
     * --------------------------------------------
     *
     * 3 current assignments:
     *
     * A1 -> Prospector A
     * A2 -> Prospector C
     * A3 -> team-owned
     */
    workA1 = await createWorkItem({
      campaignId: campaignAId,

      organizationId: organizationAId,

      teamId: teamAId,

      assignedUserId: prospectorAId,

      label: 'Paris A1',
    });

    workA2 = await createWorkItem({
      campaignId: campaignAId,

      organizationId: organizationAId,

      teamId: teamAId,

      assignedUserId: prospectorCId,

      label: 'Paris A2',
    });

    await createWorkItem({
      campaignId: campaignAId,

      organizationId: organizationAId,

      teamId: teamAId,

      assignedUserId: null,

      label: 'Paris Team Owned',
    });

    /*
     * Historical assignment.
     *
     * It must NOT count as current workload,
     * but activity recorded under it remains
     * historical Team A activity.
     */
    historicalWorkA = await createWorkItem({
      campaignId: campaignAId,

      organizationId: organizationAId,

      teamId: teamAId,

      assignedUserId: prospectorAId,

      label: 'Paris Historical',

      endedAt: new Date(fixtureNow.getTime() - 60 * 60 * 1000),
    });

    /*
     * Second team inside Organization A.
     */
    workA2Team = await createWorkItem({
      campaignId: campaignA2Id,

      organizationId: organizationAId,

      teamId: teamA2Id,

      assignedUserId: prospectorDId,

      label: 'Lyon A1',
    });

    /*
     * Organization B.
     */
    workB = await createWorkItem({
      campaignId: campaignBId,

      organizationId: organizationBId,

      teamId: teamBId,

      assignedUserId: prospectorBId,

      label: 'Brussels B1',
    });

    /*
     * --------------------------------------------
     * ACTIVITIES
     * --------------------------------------------
     *
     * Team A:
     *   call
     *   email
     *   historical visit
     *
     * Team A2:
     *   message
     *
     * Team B:
     *   call
     */
    await createActivity(
      workA1,
      prospectorAId,
      'call',
      new Date(fixtureNow.getTime() - 5 * 60 * 60 * 1000),
    );

    await createActivity(
      workA1,
      prospectorAId,
      'email',
      new Date(fixtureNow.getTime() - 4 * 60 * 60 * 1000),
    );

    await createActivity(
      historicalWorkA,
      prospectorAId,
      'visit',
      new Date(fixtureNow.getTime() - 2 * 60 * 60 * 1000),
    );

    await createActivity(
      workA2Team,
      prospectorDId,
      'message',
      new Date(fixtureNow.getTime() - 3 * 60 * 60 * 1000),
    );

    await createActivity(
      workB,
      prospectorBId,
      'call',
      new Date(fixtureNow.getTime() - 2 * 60 * 60 * 1000),
    );

    /*
     * Outside reporting range.
     *
     * Must not be counted.
     */
    await createActivity(
      workA1,
      prospectorAId,
      'message',
      new Date(fixtureNow.getTime() - 3 * 24 * 60 * 60 * 1000),
    );

    /*
     * --------------------------------------------
     * FOLLOW-UPS
     * --------------------------------------------
     */
    await createPendingFollowUp(
      workA1,
      prospectorAId,
      new Date(fixtureNow.getTime() - 6 * 60 * 60 * 1000),
    );

    await createPendingFollowUp(
      workA2,
      prospectorCId,
      new Date(fixtureNow.getTime() + 6 * 60 * 60 * 1000),
    );

    await createCompletedFollowUp(
      workA1,
      prospectorAId,
      new Date(fixtureNow.getTime() - 4 * 60 * 60 * 1000),
    );

    await createCancelledFollowUp(
      workA1,
      prospectorAId,
      new Date(fixtureNow.getTime() - 3 * 60 * 60 * 1000),
    );

    await createPendingFollowUp(
      workA2Team,
      prospectorDId,
      new Date(fixtureNow.getTime() - 5 * 60 * 60 * 1000),
    );

    await createPendingFollowUp(
      workB,
      prospectorBId,
      new Date(fixtureNow.getTime() + 5 * 60 * 60 * 1000),
    );

    /*
     * --------------------------------------------
     * FOREIGN TENANT
     * --------------------------------------------
     *
     * Used only to verify tenant-safe resource
     * lookup and non-disclosure.
     */
    const foreignTenant = await tenantService.create({
      name: `Foreign Dashboard Tenant ${suffix}`,

      slug: `foreign-dashboard-${suffix}`,
    });

    foreignTenantId = foreignTenant.id;

    const [foreignOrganization] = await getDatabase()
      .insert(organizations)
      .values({
        tenantId: foreignTenantId,

        name: 'Foreign Organization',

        slug: `foreign-dashboard-org-${suffix}`,

        status: 'active',
      })
      .returning();

    if (!foreignOrganization) {
      throw new Error('Failed to create foreign organization');
    }

    const [foreignTeam] = await getDatabase()
      .insert(teams)
      .values({
        tenantId: foreignTenantId,

        organizationId: foreignOrganization.id,

        name: 'Foreign Team',

        slug: `foreign-dashboard-team-${suffix}`,

        status: 'active',
      })
      .returning();

    if (!foreignTeam) {
      throw new Error('Failed to create foreign team');
    }

    foreignTeamId = foreignTeam.id;

    /*
     * Login only after all users/grants exist.
     */
    managerToken = (await login(managerEmail)).accessToken;

    directorToken = (await login(directorEmail)).accessToken;

    clientAdminToken = (await login(adminEmail)).accessToken;

    observerToken = (await login(observerEmail)).accessToken;

    prospectorAToken = (await login(prospectorAEmail)).accessToken;
  });

  afterAll(async () => {
    try {
      await cleanupTenant(foreignTenantId);

      await cleanupTenant(tenantId);
    } finally {
      if (app) {
        await app.close();
      }
    }
  });

  it('rejects unauthenticated manager dashboard access', async () => {
    const response = await getApp().inject({
      method: 'GET',

      url: '/manager/dashboard',
    });

    expect(response.statusCode).toBe(401);
  });

  it('rejects a prospector from the manager dashboard', async () => {
    const response = await requestDashboard(prospectorAToken);

    expect(response.statusCode).toBe(403);
  });

  it('rejects an observer from the manager dashboard', async () => {
    const response = await requestDashboard(observerToken);

    expect(response.statusCode).toBe(403);
  });

  it('returns only the exact managed team for a manager', async () => {
    const response = await requestDashboard(managerToken, {
      from: rangeFrom,

      to: rangeTo,
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.payload) as DashboardResponse;

    expect(body.scope).toEqual({
      authority: 'manager',

      organizationId: organizationAId,

      teamId: teamAId,
    });

    /*
     * Historical activity under an ended
     * assignment remains attributed to Team A.
     */
    expect(body.activities).toEqual({
      total: 3,

      byType: {
        call: 1,

        email: 1,

        visit: 1,
      },

      activeProspectors: 1,
    });

    /*
     * Historical assignment is excluded.
     */
    expect(body.assignments).toEqual({
      current: 3,

      individuallyAssigned: 2,

      teamOwned: 1,
    });

    expect(body.followUps).toEqual({
      pending: 2,

      overdue: 1,

      dueInRange: 2,

      completedInRange: 1,

      cancelledInRange: 1,
    });

    expect(body.byProspector).toHaveLength(2);

    expect(findProspectorRow(body, prospectorAId)).toEqual({
      userId: prospectorAId,

      activities: 3,

      currentAssignments: 1,

      pendingFollowUps: 1,

      overdueFollowUps: 1,
    });

    expect(findProspectorRow(body, prospectorCId)).toEqual({
      userId: prospectorCId,

      activities: 0,

      currentAssignments: 1,

      pendingFollowUps: 1,

      overdueFollowUps: 0,
    });

    /*
     * Team-owned assignment is deliberately
     * not attributed to a fake prospector row.
     */
    expect(body.byProspector.some((row) => !row.userId)).toBe(false);

    /*
     * No invented conversion KPI.
     */
    expect(JSON.stringify(body).toLowerCase()).not.toContain('conversion');
  });

  it('allows a director to report across their organization but not another organization', async () => {
    const response = await requestDashboard(directorToken, {
      from: rangeFrom,

      to: rangeTo,
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.payload) as DashboardResponse;

    expect(body.scope).toEqual({
      authority: 'director',

      organizationId: organizationAId,

      teamId: null,
    });

    expect(body.activities).toEqual({
      total: 4,

      byType: {
        call: 1,

        email: 1,

        visit: 1,

        message: 1,
      },

      activeProspectors: 2,
    });

    expect(body.assignments).toEqual({
      current: 4,

      individuallyAssigned: 3,

      teamOwned: 1,
    });

    expect(body.followUps).toEqual({
      pending: 3,

      overdue: 2,

      dueInRange: 3,

      completedInRange: 1,

      cancelledInRange: 1,
    });

    expect(findProspectorRow(body, prospectorDId)).toEqual({
      userId: prospectorDId,

      activities: 1,

      currentAssignments: 1,

      pendingFollowUps: 1,

      overdueFollowUps: 1,
    });

    expect(findProspectorRow(body, prospectorBId)).toBeUndefined();

    const forbidden = await requestDashboard(directorToken, {
      organizationId: organizationBId,

      from: rangeFrom,

      to: rangeTo,
    });

    expect(forbidden.statusCode).toBe(404);

    expect(JSON.parse(forbidden.payload)).toMatchObject({
      statusCode: 404,

      code: 'NOT_FOUND',

      message: 'Reporting resource not found',

      error: 'Not Found',
    });
  });

  it('allows a client admin to report across the entire tenant', async () => {
    const response = await requestDashboard(clientAdminToken, {
      from: rangeFrom,

      to: rangeTo,
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.payload) as DashboardResponse;

    expect(body.scope).toEqual({
      authority: 'client_admin',

      organizationId: null,

      teamId: null,
    });

    expect(body.activities).toEqual({
      total: 5,

      byType: {
        call: 2,

        email: 1,

        visit: 1,

        message: 1,
      },

      activeProspectors: 3,
    });

    expect(body.assignments).toEqual({
      current: 5,

      individuallyAssigned: 4,

      teamOwned: 1,
    });

    expect(body.followUps).toEqual({
      pending: 4,

      overdue: 2,

      dueInRange: 4,

      completedInRange: 1,

      cancelledInRange: 1,
    });

    expect(findProspectorRow(body, prospectorBId)).toEqual({
      userId: prospectorBId,

      activities: 1,

      currentAssignments: 1,

      pendingFollowUps: 1,

      overdueFollowUps: 0,
    });
  });

  it('allows a client admin to narrow reporting to one team', async () => {
    const response = await requestDashboard(clientAdminToken, {
      from: rangeFrom,

      to: rangeTo,

      teamId: teamA2Id,
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.payload) as DashboardResponse;

    expect(body.filters.teamId).toBe(teamA2Id);

    expect(body.activities.total).toBe(1);

    expect(body.assignments).toEqual({
      current: 1,

      individuallyAssigned: 1,

      teamOwned: 0,
    });

    expect(body.followUps.pending).toBe(1);

    expect(body.followUps.overdue).toBe(1);

    expect(body.byProspector).toEqual([
      {
        userId: prospectorDId,

        activities: 1,

        currentAssignments: 1,

        pendingFollowUps: 1,

        overdueFollowUps: 1,
      },
    ]);
  });

  it('allows a manager to filter the dashboard to an authorized prospector', async () => {
    const response = await requestDashboard(managerToken, {
      from: rangeFrom,

      to: rangeTo,

      userId: prospectorAId,
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.payload) as DashboardResponse;

    expect(body.filters.userId).toBe(prospectorAId);

    expect(body.activities).toEqual({
      total: 3,

      byType: {
        call: 1,

        email: 1,

        visit: 1,
      },

      activeProspectors: 1,
    });

    expect(body.assignments).toEqual({
      current: 1,

      individuallyAssigned: 1,

      teamOwned: 0,
    });

    expect(body.followUps).toEqual({
      pending: 1,

      overdue: 1,

      dueInRange: 1,

      completedInRange: 1,

      cancelledInRange: 1,
    });

    expect(body.byProspector).toEqual([
      {
        userId: prospectorAId,

        activities: 3,

        currentAssignments: 1,

        pendingFollowUps: 1,

        overdueFollowUps: 1,
      },
    ]);
  });

  it('masks an out-of-scope team exactly like a nonexistent team', async () => {
    const outOfScopeResponse = await requestDashboard(managerToken, {
      teamId: teamA2Id,

      from: rangeFrom,

      to: rangeTo,
    });

    const nonexistentResponse = await requestDashboard(managerToken, {
      teamId: randomUUID(),

      from: rangeFrom,

      to: rangeTo,
    });

    expect(outOfScopeResponse.statusCode).toBe(404);

    expect(nonexistentResponse.statusCode).toBe(404);

    const outOfScopeBody = JSON.parse(outOfScopeResponse.payload) as {
      statusCode: number;

      code: string;

      message: string;

      error: string;

      requestId: string;
    };

    const nonexistentBody = JSON.parse(nonexistentResponse.payload) as {
      statusCode: number;

      code: string;

      message: string;

      error: string;

      requestId: string;
    };

    expect(outOfScopeBody).toMatchObject({
      statusCode: 404,

      code: 'NOT_FOUND',

      message: 'Reporting resource not found',

      error: 'Not Found',
    });

    expect(nonexistentBody).toMatchObject({
      statusCode: 404,

      code: 'NOT_FOUND',

      message: 'Reporting resource not found',

      error: 'Not Found',
    });

    expect({
      statusCode: outOfScopeBody.statusCode,

      code: outOfScopeBody.code,

      message: outOfScopeBody.message,

      error: outOfScopeBody.error,
    }).toEqual({
      statusCode: nonexistentBody.statusCode,

      code: nonexistentBody.code,

      message: nonexistentBody.message,

      error: nonexistentBody.error,
    });

    expect(outOfScopeBody.requestId).not.toBe(nonexistentBody.requestId);
  });

  it('masks an out-of-scope prospector exactly like a nonexistent user', async () => {
    const outOfScopeResponse = await requestDashboard(managerToken, {
      userId: prospectorDId,

      from: rangeFrom,

      to: rangeTo,
    });

    const nonexistentResponse = await requestDashboard(managerToken, {
      userId: randomUUID(),

      from: rangeFrom,

      to: rangeTo,
    });

    expect(outOfScopeResponse.statusCode).toBe(404);

    expect(nonexistentResponse.statusCode).toBe(404);

    const outOfScopeBody = JSON.parse(outOfScopeResponse.payload) as {
      statusCode: number;

      code: string;

      message: string;

      error: string;

      requestId: string;
    };

    const nonexistentBody = JSON.parse(nonexistentResponse.payload) as {
      statusCode: number;

      code: string;

      message: string;

      error: string;

      requestId: string;
    };

    expect(outOfScopeBody).toMatchObject({
      statusCode: 404,

      code: 'NOT_FOUND',

      message: 'Reporting resource not found',

      error: 'Not Found',
    });

    expect(nonexistentBody).toMatchObject({
      statusCode: 404,

      code: 'NOT_FOUND',

      message: 'Reporting resource not found',

      error: 'Not Found',
    });

    expect({
      statusCode: outOfScopeBody.statusCode,

      code: outOfScopeBody.code,

      message: outOfScopeBody.message,

      error: outOfScopeBody.error,
    }).toEqual({
      statusCode: nonexistentBody.statusCode,

      code: nonexistentBody.code,

      message: nonexistentBody.message,

      error: nonexistentBody.error,
    });

    expect(outOfScopeBody.requestId).not.toBe(nonexistentBody.requestId);
  });

  it('masks an out-of-scope campaign exactly like a nonexistent campaign', async () => {
    const outOfScopeResponse = await requestDashboard(managerToken, {
      campaignId: campaignBId,

      from: rangeFrom,

      to: rangeTo,
    });

    const nonexistentResponse = await requestDashboard(managerToken, {
      campaignId: randomUUID(),

      from: rangeFrom,

      to: rangeTo,
    });

    expect(outOfScopeResponse.statusCode).toBe(404);

    expect(nonexistentResponse.statusCode).toBe(404);

    const outOfScopeBody = JSON.parse(outOfScopeResponse.payload) as {
      statusCode: number;

      code: string;

      message: string;

      error: string;

      requestId: string;
    };

    const nonexistentBody = JSON.parse(nonexistentResponse.payload) as {
      statusCode: number;

      code: string;

      message: string;

      error: string;

      requestId: string;
    };

    expect(outOfScopeBody).toMatchObject({
      statusCode: 404,

      code: 'NOT_FOUND',

      message: 'Reporting resource not found',

      error: 'Not Found',
    });

    expect(nonexistentBody).toMatchObject({
      statusCode: 404,

      code: 'NOT_FOUND',

      message: 'Reporting resource not found',

      error: 'Not Found',
    });

    expect({
      statusCode: outOfScopeBody.statusCode,

      code: outOfScopeBody.code,

      message: outOfScopeBody.message,

      error: outOfScopeBody.error,
    }).toEqual({
      statusCode: nonexistentBody.statusCode,

      code: nonexistentBody.code,

      message: nonexistentBody.message,

      error: nonexistentBody.error,
    });

    expect(outOfScopeBody.requestId).not.toBe(nonexistentBody.requestId);
  });

  it('masks a cross-tenant team exactly like a nonexistent team', async () => {
    const crossTenantResponse = await requestDashboard(managerToken, {
      teamId: foreignTeamId,

      from: rangeFrom,

      to: rangeTo,
    });

    const nonexistentResponse = await requestDashboard(managerToken, {
      teamId: randomUUID(),

      from: rangeFrom,

      to: rangeTo,
    });

    expect(crossTenantResponse.statusCode).toBe(404);

    expect(nonexistentResponse.statusCode).toBe(404);

    const crossTenantBody = JSON.parse(crossTenantResponse.payload) as {
      statusCode: number;

      code: string;

      message: string;

      error: string;

      requestId: string;
    };

    const nonexistentBody = JSON.parse(nonexistentResponse.payload) as {
      statusCode: number;

      code: string;

      message: string;

      error: string;

      requestId: string;
    };

    expect(crossTenantBody).toMatchObject({
      statusCode: 404,

      code: 'NOT_FOUND',

      message: 'Reporting resource not found',

      error: 'Not Found',
    });

    expect(nonexistentBody).toMatchObject({
      statusCode: 404,

      code: 'NOT_FOUND',

      message: 'Reporting resource not found',

      error: 'Not Found',
    });

    expect({
      statusCode: crossTenantBody.statusCode,

      code: crossTenantBody.code,

      message: crossTenantBody.message,

      error: crossTenantBody.error,
    }).toEqual({
      statusCode: nonexistentBody.statusCode,

      code: nonexistentBody.code,

      message: nonexistentBody.message,

      error: nonexistentBody.error,
    });

    expect(crossTenantBody.requestId).not.toBe(nonexistentBody.requestId);
  });

  it('rejects a one-sided reporting date range', async () => {
    const response = await requestDashboard(managerToken, {
      from: rangeFrom,
    });

    expect(response.statusCode).toBe(400);
  });

  it('rejects an inverted reporting date range', async () => {
    const response = await requestDashboard(managerToken, {
      from: rangeTo,

      to: rangeFrom,
    });

    expect(response.statusCode).toBe(400);
  });
});
