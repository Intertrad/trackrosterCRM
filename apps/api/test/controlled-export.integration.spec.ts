import 'reflect-metadata';

import { randomUUID } from 'node:crypto';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { and, eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';

import type { AuthenticationTokens } from '../src/auth/auth.types.js';

import { PasswordService } from '../src/auth/password.service.js';

import { UserAccessGrantRepository } from '../src/authorization/user-access-grant.repository.js';

import { DATABASE } from '../src/database/database.constants.js';

import type { Database } from '../src/database/database.types.js';

import { auditEvents } from '../src/database/schema/audit-events.js';

import { authSessions } from '../src/database/schema/auth-sessions.js';

import { campaignProspectAssignments } from '../src/database/schema/campaign-prospect-assignments.js';

import { campaignProspects } from '../src/database/schema/campaign-prospects.js';

import { campaigns } from '../src/database/schema/campaigns.js';

import { establishments } from '../src/database/schema/establishments.js';

import { organizations } from '../src/database/schema/organizations.js';

import { teams } from '../src/database/schema/teams.js';

import { tenants } from '../src/database/schema/tenants.js';

import { userAccessGrants } from '../src/database/schema/user-access-grants.js';

import { users } from '../src/database/schema/users.js';

import { TenantService } from '../src/tenants/tenant.service.js';

import { UserRepository } from '../src/users/user.repository.js';

describe('Controlled export HTTP integration', () => {
  let app: NestFastifyApplication | undefined;

  let database: Database | undefined;

  let tenantId = '';

  let organizationAId = '';
  let organizationBId = '';

  let teamA1Id = '';
  let teamA2Id = '';
  let teamBId = '';

  let campaignAId = '';
  let campaignBId = '';

  let assignmentA1Id = '';
  let assignmentA2Id = '';
  let assignmentBId = '';

  let managerUserId = '';
  let directorUserId = '';
  let prospectorUserId = '';

  let managerToken = '';
  let directorToken = '';
  let prospectorToken = '';

  const password = 'ControlledExport123!';

  function getApp(): NestFastifyApplication {
    if (!app) {
      throw new Error('Application is not initialized');
    }

    return app;
  }

  function getDatabase(): Database {
    if (!database) {
      throw new Error('Database is not initialized');
    }

    return database;
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

  async function clearAuditEvents(): Promise<void> {
    if (!tenantId) {
      return;
    }

    await getDatabase().delete(auditEvents).where(eq(auditEvents.tenantId, tenantId));
  }

  async function findExportAuditEvents(actorUserId: string) {
    return getDatabase()
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.tenantId, tenantId),

          eq(auditEvents.actorUserId, actorUserId),

          eq(auditEvents.action, 'export.generated'),
        ),
      );
  }

  async function createAssignmentFixture(input: {
    organizationId: string;
    teamId: string;
    campaignId: string;
    label: string;
  }): Promise<string> {
    const [establishment] = await getDatabase()
      .insert(establishments)
      .values({
        tenantId,

        name: `${input.label} Establishment`,

        normalizedName: `${input.label.toLowerCase()} establishment`,

        city: 'Paris',

        countryCode: 'FR',

        source: 'manual',

        status: 'active',
      })
      .returning();

    if (!establishment) {
      throw new Error('Failed to create export establishment fixture');
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
      throw new Error('Failed to create export campaign prospect fixture');
    }

    const [assignment] = await getDatabase()
      .insert(campaignProspectAssignments)
      .values({
        tenantId,

        campaignId: input.campaignId,

        campaignProspectId: prospect.id,

        organizationId: input.organizationId,

        teamId: input.teamId,

        assignedUserId: null,

        assignedAt: new Date(),
      })
      .returning();

    if (!assignment) {
      throw new Error('Failed to create export assignment fixture');
    }

    return assignment.id;
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
     * Tenant
     */
    const tenant = await tenantService.create({
      name: `Export Tenant ${suffix}`,

      slug: `export-${suffix}`,
    });

    tenantId = tenant.id;

    /*
     * Organizations
     */
    const createdOrganizations = await getDatabase()
      .insert(organizations)
      .values([
        {
          tenantId,

          name: 'Export Organization A',

          slug: `export-org-a-${suffix}`,

          status: 'active',
        },

        {
          tenantId,

          name: 'Export Organization B',

          slug: `export-org-b-${suffix}`,

          status: 'active',
        },
      ])
      .returning();

    const organizationA = createdOrganizations[0];

    const organizationB = createdOrganizations[1];

    if (!organizationA || !organizationB) {
      throw new Error('Failed to create export organizations');
    }

    organizationAId = organizationA.id;

    organizationBId = organizationB.id;

    /*
     * Teams
     *
     * A1 + A2 belong to organization A.
     * B belongs to organization B.
     */
    const createdTeams = await getDatabase()
      .insert(teams)
      .values([
        {
          tenantId,

          organizationId: organizationAId,

          name: 'Export Team A1',

          slug: `export-team-a1-${suffix}`,

          status: 'active',
        },

        {
          tenantId,

          organizationId: organizationAId,

          name: 'Export Team A2',

          slug: `export-team-a2-${suffix}`,

          status: 'active',
        },

        {
          tenantId,

          organizationId: organizationBId,

          name: 'Export Team B',

          slug: `export-team-b-${suffix}`,

          status: 'active',
        },
      ])
      .returning();

    const teamA1 = createdTeams[0];

    const teamA2 = createdTeams[1];

    const teamB = createdTeams[2];

    if (!teamA1 || !teamA2 || !teamB) {
      throw new Error('Failed to create export teams');
    }

    teamA1Id = teamA1.id;

    teamA2Id = teamA2.id;

    teamBId = teamB.id;

    /*
     * Campaigns
     */
    const createdCampaigns = await getDatabase()
      .insert(campaigns)
      .values([
        {
          tenantId,

          organizationId: organizationAId,

          name: 'Export Campaign A',

          status: 'active',
        },

        {
          tenantId,

          organizationId: organizationBId,

          name: 'Export Campaign B',

          status: 'active',
        },
      ])
      .returning();

    const campaignA = createdCampaigns[0];

    const campaignB = createdCampaigns[1];

    if (!campaignA || !campaignB) {
      throw new Error('Failed to create export campaigns');
    }

    campaignAId = campaignA.id;

    campaignBId = campaignB.id;

    /*
     * One assignment in each effective scope.
     */
    assignmentA1Id = await createAssignmentFixture({
      organizationId: organizationAId,

      teamId: teamA1Id,

      campaignId: campaignAId,

      label: 'A1',
    });

    assignmentA2Id = await createAssignmentFixture({
      organizationId: organizationAId,

      teamId: teamA2Id,

      campaignId: campaignAId,

      label: 'A2',
    });

    assignmentBId = await createAssignmentFixture({
      organizationId: organizationBId,

      teamId: teamBId,

      campaignId: campaignBId,

      label: 'B',
    });

    /*
     * Users
     */
    const passwordHash = await passwordService.hash(password);

    const managerEmail = `export-manager-${suffix}@trackroster.test`;

    const directorEmail = `export-director-${suffix}@trackroster.test`;

    const prospectorEmail = `export-prospector-${suffix}@trackroster.test`;

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

    const prospector = await userRepository.create({
      tenantId,

      email: prospectorEmail,

      passwordHash,

      status: 'active',
    });

    managerUserId = manager.id;

    directorUserId = director.id;

    prospectorUserId = prospector.id;

    /*
     * Authority grants
     */
    await grantRepository.create({
      tenantId,

      userId: managerUserId,

      role: 'manager',

      scopeType: 'team',

      organizationId: organizationAId,

      teamId: teamA1Id,
    });

    await grantRepository.create({
      tenantId,

      userId: directorUserId,

      role: 'director',

      scopeType: 'organization',

      organizationId: organizationAId,
    });

    await grantRepository.create({
      tenantId,

      userId: prospectorUserId,

      role: 'prospector',

      scopeType: 'team',

      organizationId: organizationAId,

      teamId: teamA1Id,
    });

    managerToken = (await login(managerEmail)).accessToken;

    directorToken = (await login(directorEmail)).accessToken;

    prospectorToken = (await login(prospectorEmail)).accessToken;
  });

  beforeEach(async () => {
    await clearAuditEvents();
  });

  afterAll(async () => {
    try {
      if (database && tenantId) {
        /*
         * Audit rows reference actor users with
         * ON DELETE RESTRICT, so delete them first.
         */
        await database.delete(auditEvents).where(eq(auditEvents.tenantId, tenantId));

        await database
          .delete(authSessions)
          .where(inArray(authSessions.userId, [managerUserId, directorUserId, prospectorUserId]));

        await database.delete(userAccessGrants).where(eq(userAccessGrants.tenantId, tenantId));

        /*
         * Assignments reference campaign prospects with
         * ON DELETE RESTRICT, so assignments must go first.
         */
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

  it('requires authentication', async () => {
    const response = await getApp().inject({
      method: 'GET',

      url: '/exports/assignments?format=csv',
    });

    expect(response.statusCode).toBe(401);

    const events = await getDatabase()
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.tenantId, tenantId));

    expect(events).toHaveLength(0);
  });

  it('exports only the manager exact-team scope and creates an audit event', async () => {
    const response = await getApp().inject({
      method: 'GET',

      url: '/exports/assignments?format=csv',

      headers: {
        authorization: `Bearer ${managerToken}`,
      },
    });

    expect(response.statusCode).toBe(200);

    expect(response.headers['content-type']).toContain('text/csv');

    expect(response.headers['content-disposition']).toContain(
      'attachment; filename="trackroster-assignments-',
    );

    /*
     * Manager sees A1 only.
     */
    expect(response.payload).toContain(assignmentA1Id);

    expect(response.payload).not.toContain(assignmentA2Id);

    expect(response.payload).not.toContain(assignmentBId);

    const events = await findExportAuditEvents(managerUserId);

    expect(events).toHaveLength(1);

    const event = events[0];

    expect(event).toBeDefined();

    expect(event?.resourceType).toBe('data_export');

    expect(event?.resourceId).toMatch(/^[0-9a-f-]{36}$/i);

    expect(event?.metadata).toMatchObject({
      exportType: 'assignments',

      format: 'csv',

      rowCount: 1,

      authority: 'manager',

      organizationId: organizationAId,

      teamId: teamA1Id,
    });
  });

  it('masks another team from a manager and does not audit a rejected export', async () => {
    const response = await getApp().inject({
      method: 'GET',

      url: `/exports/assignments?format=csv&teamId=${teamA2Id}`,

      headers: {
        authorization: `Bearer ${managerToken}`,
      },
    });

    expect(response.statusCode).toBe(404);

    expect(JSON.parse(response.payload)).toMatchObject({
      statusCode: 404,

      code: 'NOT_FOUND',

      message: 'Reporting resource not found',

      error: 'Not Found',
    });

    const events = await findExportAuditEvents(managerUserId);

    expect(events).toHaveLength(0);
  });

  it('allows a director to export both teams in the authorized organization only', async () => {
    const response = await getApp().inject({
      method: 'GET',

      url: '/exports/assignments?format=csv',

      headers: {
        authorization: `Bearer ${directorToken}`,
      },
    });

    expect(response.statusCode).toBe(200);

    /*
     * Director sees both teams inside org A.
     */
    expect(response.payload).toContain(assignmentA1Id);

    expect(response.payload).toContain(assignmentA2Id);

    /*
     * Organization B remains invisible.
     */
    expect(response.payload).not.toContain(assignmentBId);

    const events = await findExportAuditEvents(directorUserId);

    expect(events).toHaveLength(1);

    expect(events[0]?.metadata).toMatchObject({
      rowCount: 2,

      authority: 'director',

      organizationId: organizationAId,

      teamId: null,
    });
  });

  it('masks another organization from a director and does not audit a rejected export', async () => {
    const response = await getApp().inject({
      method: 'GET',

      url: `/exports/assignments?format=csv&organizationId=${organizationBId}`,

      headers: {
        authorization: `Bearer ${directorToken}`,
      },
    });

    expect(response.statusCode).toBe(404);

    expect(JSON.parse(response.payload)).toMatchObject({
      statusCode: 404,

      code: 'NOT_FOUND',

      message: 'Reporting resource not found',

      error: 'Not Found',
    });

    const events = await findExportAuditEvents(directorUserId);

    expect(events).toHaveLength(0);
  });

  it('rejects prospectors from controlled exports', async () => {
    const response = await getApp().inject({
      method: 'GET',

      url: '/exports/assignments?format=csv',

      headers: {
        authorization: `Bearer ${prospectorToken}`,
      },
    });

    expect(response.statusCode).toBe(403);

    const events = await findExportAuditEvents(prospectorUserId);

    expect(events).toHaveLength(0);
  });
});
