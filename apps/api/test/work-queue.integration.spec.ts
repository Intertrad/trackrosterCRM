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
import { teams } from '../src/database/schema/teams.js';
import { tenants } from '../src/database/schema/tenants.js';
import { userAccessGrants } from '../src/database/schema/user-access-grants.js';
import { users } from '../src/database/schema/users.js';
import { EstablishmentService } from '../src/establishments/establishment.service.js';
import { OrganizationService } from '../src/organizations/organization.service.js';
import { TeamService } from '../src/teams/team.service.js';
import { TenantService } from '../src/tenants/tenant.service.js';
import { UserRepository } from '../src/users/user.repository.js';
import { getSeedDatabase, withSeedScope } from './support/seed.js';

interface WorkQueueHttpResponse {
  items: Array<{
    campaignProspectId: string;

    lifecycleStage: string;

    campaign: {
      id: string;
      name: string;
    };

    assignment: {
      id: string;
      organizationId: string;
      teamId: string;
      assignedAt: string;
    };

    establishment: {
      id: string;
      regionId: string | null;
      name: string;
      addressLine1: string | null;
      postalCode: string | null;
      city: string | null;
      countryCode: string;
      phone: string | null;
      website: string | null;
      status: string;
    };
  }>;

  page: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
  };
}

interface WorkQueueProspectDetailHttpResponse {
  campaignProspectId: string;

  campaign: {
    id: string;
    name: string;
  };

  assignment: {
    id: string;
    organizationId: string;
    teamId: string;
    assignedAt: string;
  };

  establishment: {
    id: string;
    regionId: string | null;
    name: string;
    addressLine1: string | null;
    postalCode: string | null;
    city: string | null;
    countryCode: string;
    phone: string | null;
    website: string | null;
    status: string;
  };
}

describe('Work Queue HTTP integration', () => {
  let app: NestFastifyApplication | undefined;
  let database: Database | undefined;

  let tenantId = '';
  let organizationId = '';
  let teamId = '';
  let otherTeamId = '';

  let campaignId = '';

  let prospectId = '';
  let otherProspectId = '';

  let assignmentId = '';

  let prospectorAccessToken = '';
  let managerAccessToken = '';

  const password = 'WorkQueueIntegration123!';

  function getApp(): NestFastifyApplication {
    if (!app) {
      throw new Error('Work Queue test application has not been initialized');
    }

    return app;
  }

  function getDatabase(): Database {
    if (!database) {
      throw new Error('Work Queue test database has not been initialized');
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

    /* Fixtures span several tenants and run through container-resolved
       repositories, so they need the privileged executor; see withSeedScope. */
    await withSeedScope(async () => {
      const tenantService = application.get(TenantService);

      const organizationService = application.get(OrganizationService);

      const teamService = application.get(TeamService);

      const userRepository = application.get(UserRepository);

      const passwordService = application.get(PasswordService);

      const grantRepository = application.get(UserAccessGrantRepository);

      const establishmentService = application.get(EstablishmentService);

      const suffix = randomUUID().replaceAll('-', '').slice(0, 10);

      /*
       * Tenant
       */
      const tenant = await tenantService.create({
        name: `Work Queue Tenant ${suffix}`,

        slug: `work-queue-${suffix}`,
      });

      tenantId = tenant.id;

      /*
       * Organization
       */
      const organization = await organizationService.create({
        tenantId,

        name: 'Work Queue France',

        slug: `work-queue-france-${suffix}`,
      });

      organizationId = organization.id;

      /*
       * Two teams let us prove that a team query
       * cannot escape the caller's real grant.
       */
      const team = await teamService.create({
        tenantId,

        organizationId,

        name: 'Paris Work Queue',

        slug: `paris-work-queue-${suffix}`,
      });

      teamId = team.id;

      const otherTeam = await teamService.create({
        tenantId,

        organizationId,

        name: 'Lyon Work Queue',

        slug: `lyon-work-queue-${suffix}`,
      });

      otherTeamId = otherTeam.id;

      /*
       * Users
       */
      const prospectorEmail = `work-queue-prospector-${suffix}@trackroster.test`;

      const otherProspectorEmail = `work-queue-other-${suffix}@trackroster.test`;

      const managerEmail = `work-queue-manager-${suffix}@trackroster.test`;

      const passwordHash = await passwordService.hash(password);

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

      /*
       * Real backend grants.
       */
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

      /*
       * Establishments
       */
      const establishment = await establishmentService.create({
        tenantId,

        name: 'Queue Clinic Paris',

        addressLine1: '10 Rue de Rivoli',

        postalCode: '75001',

        city: 'Paris',

        countryCode: 'FR',

        phone: '+33100000000',

        website: 'https://queue-clinic.example',

        source: 'manual',
      });

      const otherEstablishment = await establishmentService.create({
        tenantId,

        name: 'Other Queue Clinic',

        addressLine1: '20 Rue de Rivoli',

        postalCode: '75001',

        city: 'Paris',

        countryCode: 'FR',

        source: 'manual',
      });

      /*
       * Active campaign.
       */
      const [campaign] = await getDatabase()
        .insert(campaigns)
        .values({
          tenantId,

          organizationId,

          name: 'Work Queue Campaign',

          status: 'active',
        })
        .returning();

      if (!campaign) {
        throw new Error('Failed to create Work Queue campaign');
      }

      campaignId = campaign.id;

      /*
       * Two campaign prospects.
       */
      const [prospect] = await getDatabase()
        .insert(campaignProspects)
        .values({
          tenantId,

          campaignId,

          establishmentId: establishment.id,

          status: 'active',

          lifecycleStage: 'in_progress',
        })
        .returning();

      const [otherProspect] = await getDatabase()
        .insert(campaignProspects)
        .values({
          tenantId,

          campaignId,

          establishmentId: otherEstablishment.id,

          status: 'active',

          lifecycleStage: 'follow_up',
        })
        .returning();

      if (!prospect || !otherProspect) {
        throw new Error('Failed to create Work Queue prospects');
      }

      prospectId = prospect.id;
      otherProspectId = otherProspect.id;

      /*
       * One assignment belongs to our test
       * Prospector. The other belongs to another
       * Prospector in the same team.
       *
       * The queue must return only the first.
       */
      const [assignment] = await getDatabase()
        .insert(campaignProspectAssignments)
        .values({
          tenantId,

          campaignId,

          campaignProspectId: prospect.id,

          organizationId,

          teamId,

          assignedUserId: prospector.id,

          assignedAt: new Date('2026-09-16T08:00:00.000Z'),
        })
        .returning();

      await getDatabase()
        .insert(campaignProspectAssignments)
        .values({
          tenantId,

          campaignId,

          campaignProspectId: otherProspect.id,

          organizationId,

          teamId,

          assignedUserId: otherProspector.id,

          assignedAt: new Date('2026-09-16T07:00:00.000Z'),
        });

      if (!assignment) {
        throw new Error('Failed to create Work Queue assignment');
      }

      assignmentId = assignment.id;

      prospectorAccessToken = (await login(prospectorEmail)).accessToken;

      managerAccessToken = (await login(managerEmail)).accessToken;
    });
  });

  afterAll(async () => {
    try {
      if (database && tenantId) {
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

  it('rejects unauthenticated work queue access', async () => {
    const response = await getApp().inject({
      method: 'GET',

      url: `/work-queue?teamId=${teamId}`,
    });

    expect(response.statusCode).toBe(401);
  });

  it('rejects a request without the required teamId', async () => {
    const response = await getApp().inject({
      method: 'GET',

      url: '/work-queue',

      headers: {
        authorization: `Bearer ${prospectorAccessToken}`,
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('rejects a manager who does not have a prospector grant', async () => {
    const response = await getApp().inject({
      method: 'GET',

      url: `/work-queue?teamId=${teamId}`,

      headers: {
        authorization: `Bearer ${managerAccessToken}`,
      },
    });

    expect(response.statusCode).toBe(403);
  });

  it('rejects a prospector requesting a different team workspace', async () => {
    const response = await getApp().inject({
      method: 'GET',

      url: `/work-queue?teamId=${otherTeamId}`,

      headers: {
        authorization: `Bearer ${prospectorAccessToken}`,
      },
    });

    expect(response.statusCode).toBe(403);
  });

  it('returns only current prospects assigned to the authenticated prospector', async () => {
    const response = await getApp().inject({
      method: 'GET',

      url: `/work-queue?teamId=${teamId}`,

      headers: {
        authorization: `Bearer ${prospectorAccessToken}`,
      },
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.payload) as WorkQueueHttpResponse;

    expect(body.page).toEqual({
      limit: 25,

      hasMore: false,

      nextCursor: null,
    });

    expect(body.items).toHaveLength(1);

    expect(body.items[0]).toMatchObject({
      campaignProspectId: prospectId,

      lifecycleStage: 'in_progress',

      campaign: {
        id: campaignId,

        name: 'Work Queue Campaign',
      },

      assignment: {
        id: assignmentId,

        organizationId,

        teamId,

        assignedAt: '2026-09-16T08:00:00.000Z',
      },

      establishment: {
        name: 'Queue Clinic Paris',

        addressLine1: '10 Rue de Rivoli',

        postalCode: '75001',

        city: 'Paris',

        countryCode: 'FR',

        phone: '+33100000000',

        website: 'https://queue-clinic.example',

        status: 'active',
      },
    });

    /*
     * The other Prospector's assignment must
     * never leak into this user's queue.
     */
    expect(body.items.some((item) => item.campaignProspectId === otherProspectId)).toBe(false);

    /*
     * Internal authorization / persistence
     * fields are deliberately absent.
     */
    expect(body.items[0]).not.toHaveProperty('tenantId');

    expect(body.items[0]?.assignment).not.toHaveProperty('assignedUserId');
  });

  it('filters assigned prospects by lifecycle stage without escaping ownership', async () => {
    const matchingResponse = await getApp().inject({
      method: 'GET',

      url: `/work-queue?teamId=${teamId}&lifecycleStage=in_progress`,

      headers: {
        authorization: `Bearer ${prospectorAccessToken}`,
      },
    });

    expect(matchingResponse.statusCode).toBe(200);

    const matchingBody = JSON.parse(matchingResponse.payload) as WorkQueueHttpResponse;

    expect(matchingBody.items.map((item) => item.campaignProspectId)).toEqual([prospectId]);

    const maskedResponse = await getApp().inject({
      method: 'GET',

      url: `/work-queue?teamId=${teamId}&lifecycleStage=follow_up`,

      headers: {
        authorization: `Bearer ${prospectorAccessToken}`,
      },
    });

    expect(maskedResponse.statusCode).toBe(200);

    const maskedBody = JSON.parse(maskedResponse.payload) as WorkQueueHttpResponse;

    expect(maskedBody.items).toEqual([]);
  });

  it('rejects an invalid lifecycle stage', async () => {
    const response = await getApp().inject({
      method: 'GET',

      url: `/work-queue?teamId=${teamId}&lifecycleStage=active`,

      headers: {
        authorization: `Bearer ${prospectorAccessToken}`,
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('rejects unauthenticated prospect detail access', async () => {
    const response = await getApp().inject({
      method: 'GET',

      url: `/work-queue/${campaignId}/${prospectId}` + `?teamId=${teamId}`,
    });

    expect(response.statusCode).toBe(401);
  });

  it('rejects prospect detail without the required teamId', async () => {
    const response = await getApp().inject({
      method: 'GET',

      url: `/work-queue/${campaignId}/${prospectId}`,

      headers: {
        authorization: `Bearer ${prospectorAccessToken}`,
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('rejects prospect detail with a malformed teamId', async () => {
    const response = await getApp().inject({
      method: 'GET',

      url: `/work-queue/${campaignId}/${prospectId}` + '?teamId=not-a-uuid',

      headers: {
        authorization: `Bearer ${prospectorAccessToken}`,
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('rejects prospect detail with a malformed campaignId', async () => {
    const response = await getApp().inject({
      method: 'GET',

      url: `/work-queue/not-a-uuid/${prospectId}` + `?teamId=${teamId}`,

      headers: {
        authorization: `Bearer ${prospectorAccessToken}`,
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('rejects prospect detail with a malformed prospectId', async () => {
    const response = await getApp().inject({
      method: 'GET',

      url: `/work-queue/${campaignId}/not-a-uuid` + `?teamId=${teamId}`,

      headers: {
        authorization: `Bearer ${prospectorAccessToken}`,
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('rejects a manager from the prospect detail route when they lack a prospector grant', async () => {
    const response = await getApp().inject({
      method: 'GET',

      url: `/work-queue/${campaignId}/${prospectId}` + `?teamId=${teamId}`,

      headers: {
        authorization: `Bearer ${managerAccessToken}`,
      },
    });

    expect(response.statusCode).toBe(403);
  });

  it('rejects a prospector requesting prospect detail through a different team workspace', async () => {
    const response = await getApp().inject({
      method: 'GET',

      url: `/work-queue/${campaignId}/${prospectId}` + `?teamId=${otherTeamId}`,

      headers: {
        authorization: `Bearer ${prospectorAccessToken}`,
      },
    });

    expect(response.statusCode).toBe(403);
  });

  it('masks another users assigned prospect as not found', async () => {
    const response = await getApp().inject({
      method: 'GET',

      url: `/work-queue/${campaignId}/${otherProspectId}` + `?teamId=${teamId}`,

      headers: {
        authorization: `Bearer ${prospectorAccessToken}`,
      },
    });

    expect(response.statusCode).toBe(404);
  });

  it('masks a missing campaign prospect as not found', async () => {
    const missingProspectId = randomUUID();

    const response = await getApp().inject({
      method: 'GET',

      url: `/work-queue/${campaignId}/${missingProspectId}` + `?teamId=${teamId}`,

      headers: {
        authorization: `Bearer ${prospectorAccessToken}`,
      },
    });

    expect(response.statusCode).toBe(404);
  });

  it('masks a prospect requested through the wrong campaign as not found', async () => {
    const missingCampaignId = randomUUID();

    const response = await getApp().inject({
      method: 'GET',

      url: `/work-queue/${missingCampaignId}/${prospectId}` + `?teamId=${teamId}`,

      headers: {
        authorization: `Bearer ${prospectorAccessToken}`,
      },
    });

    expect(response.statusCode).toBe(404);
  });

  it('returns only the scoped prospect detail assigned to the authenticated prospector', async () => {
    const response = await getApp().inject({
      method: 'GET',

      url: `/work-queue/${campaignId}/${prospectId}` + `?teamId=${teamId}`,

      headers: {
        authorization: `Bearer ${prospectorAccessToken}`,
      },
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.payload) as WorkQueueProspectDetailHttpResponse;

    expect(body).toMatchObject({
      campaignProspectId: prospectId,

      campaign: {
        id: campaignId,

        name: 'Work Queue Campaign',
      },

      assignment: {
        id: assignmentId,

        organizationId,

        teamId,

        assignedAt: '2026-09-16T08:00:00.000Z',
      },

      establishment: {
        name: 'Queue Clinic Paris',

        addressLine1: '10 Rue de Rivoli',

        postalCode: '75001',

        city: 'Paris',

        countryCode: 'FR',

        phone: '+33100000000',

        website: 'https://queue-clinic.example',

        status: 'active',
      },
    });

    /*
     * Internal authorization / persistence fields
     * must never become part of the public detail
     * contract.
     */
    expect(body).not.toHaveProperty('tenantId');

    expect(body.assignment).not.toHaveProperty('assignedUserId');

    expect(body.establishment).not.toHaveProperty('normalizedName');
  });
});
