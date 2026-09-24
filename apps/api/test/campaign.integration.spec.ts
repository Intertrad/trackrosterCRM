import { randomUUID } from 'node:crypto';
import { auditEvents } from '../src/database/schema/audit-events.js';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { getSeedDatabase } from './support/seed.js';
import type { AuthenticationTokens } from '../src/auth/auth.types.js';
import { PasswordService } from '../src/auth/password.service.js';
import { UserAccessGrantRepository } from '../src/authorization/user-access-grant.repository.js';
import type { Database } from '../src/database/database.types.js';
import { campaigns } from '../src/database/schema/campaigns.js';
import { organizations } from '../src/database/schema/organizations.js';
import { tenants } from '../src/database/schema/tenants.js';
import { users } from '../src/database/schema/users.js';
import { TenantService } from '../src/tenants/tenant.service.js';
import { UserRepository } from '../src/users/user.repository.js';

describe('Campaign HTTP integration', () => {
  let app: NestFastifyApplication | undefined;

  let database: Database | undefined;

  let tenantAId = '';
  let tenantBId = '';

  let organizationAId = '';
  let organizationBId = '';

  let adminAccessToken = '';
  let regularAccessToken = '';

  let createdCampaignId = '';

  const adminPassword = 'CampaignAdminPassword123!';

  const regularPassword = 'CampaignRegularPassword123!';

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

  async function login(email: string, password: string): Promise<AuthenticationTokens> {
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

    const tenantService = application.get(TenantService);

    const userRepository = application.get(UserRepository);

    const passwordService = application.get(PasswordService);

    const grantRepository = application.get(UserAccessGrantRepository);

    const suffix = randomUUID().replaceAll('-', '').slice(0, 10);

    const tenantA = await tenantService.create({
      name: `Campaign Tenant A ${suffix}`,

      slug: `campaign-a-${suffix}`,
    });

    const tenantB = await tenantService.create({
      name: `Campaign Tenant B ${suffix}`,

      slug: `campaign-b-${suffix}`,
    });

    tenantAId = tenantA.id;
    tenantBId = tenantB.id;

    const [organizationA] = await getDatabase()
      .insert(organizations)
      .values({
        tenantId: tenantAId,

        name: 'France Sales',

        slug: `france-sales-${suffix}`,

        status: 'active',
      })
      .returning();

    const [organizationB] = await getDatabase()
      .insert(organizations)
      .values({
        tenantId: tenantBId,

        name: 'Belgium Sales',

        slug: `belgium-sales-${suffix}`,

        status: 'active',
      })
      .returning();

    if (!organizationA || !organizationB) {
      throw new Error('Failed to create test organizations');
    }

    organizationAId = organizationA.id;

    organizationBId = organizationB.id;

    const adminEmail = `campaign-admin-${suffix}@trackroster.test`;

    const regularEmail = `campaign-user-${suffix}@trackroster.test`;

    const admin = await userRepository.create({
      tenantId: tenantAId,

      email: adminEmail,

      passwordHash: await passwordService.hash(adminPassword),

      status: 'active',
    });

    await userRepository.create({
      tenantId: tenantAId,

      email: regularEmail,

      passwordHash: await passwordService.hash(regularPassword),

      status: 'active',
    });

    await grantRepository.create({
      tenantId: tenantAId,

      userId: admin.id,

      role: 'client_admin',

      scopeType: 'tenant',
    });

    adminAccessToken = (await login(adminEmail, adminPassword)).accessToken;

    regularAccessToken = (await login(regularEmail, regularPassword)).accessToken;
  });

  afterAll(async () => {
    try {
      if (database) {
        if (tenantAId) {
          await database.delete(campaigns).where(eq(campaigns.tenantId, tenantAId));

          await database.delete(auditEvents).where(eq(auditEvents.tenantId, tenantAId));

          await database.delete(users).where(eq(users.tenantId, tenantAId));

          await database.delete(organizations).where(eq(organizations.tenantId, tenantAId));

          await database.delete(tenants).where(eq(tenants.id, tenantAId));
        }

        if (tenantBId) {
          await database.delete(campaigns).where(eq(campaigns.tenantId, tenantBId));

          await database.delete(auditEvents).where(eq(auditEvents.tenantId, tenantBId));

          await database.delete(users).where(eq(users.tenantId, tenantBId));

          await database.delete(organizations).where(eq(organizations.tenantId, tenantBId));

          await database.delete(tenants).where(eq(tenants.id, tenantBId));
        }
      }
    } finally {
      if (app) {
        await app.close();
      }
    }
  });

  it('rejects campaign creation without authentication', async () => {
    const response = await getApp().inject({
      method: 'POST',
      url: '/campaigns',

      payload: {
        organizationId: organizationAId,

        name: 'Paris Expansion',
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it('rejects campaign creation for a non-admin user', async () => {
    const response = await getApp().inject({
      method: 'POST',
      url: '/campaigns',

      headers: {
        authorization: `Bearer ${regularAccessToken}`,
      },

      payload: {
        organizationId: organizationAId,

        name: 'Paris Expansion',
      },
    });

    expect(response.statusCode).toBe(403);
  });

  it('creates and normalizes a campaign', async () => {
    const response = await getApp().inject({
      method: 'POST',
      url: '/campaigns',

      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },

      payload: {
        organizationId: organizationAId,

        name: '  Paris Expansion  ',

        description: '  Paris prospecting campaign  ',

        startsAt: '2026-10-01T00:00:00.000Z',

        endsAt: '2026-12-31T00:00:00.000Z',
      },
    });

    expect(response.statusCode).toBe(201);

    const body = JSON.parse(response.payload) as {
      id: string;
      tenantId: string;
      organizationId: string;
      name: string;
      description: string | null;
      status: string;
    };

    createdCampaignId = body.id;

    expect(body).toMatchObject({
      tenantId: tenantAId,

      organizationId: organizationAId,

      name: 'Paris Expansion',

      description: 'Paris prospecting campaign',

      status: 'draft',
    });
  });

  it('rejects creation using an organization from another tenant', async () => {
    const response = await getApp().inject({
      method: 'POST',
      url: '/campaigns',

      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },

      payload: {
        organizationId: organizationBId,

        name: 'Cross Tenant Attack',
      },
    });

    expect(response.statusCode).toBe(404);
  });

  it('rejects an invalid campaign date range', async () => {
    const response = await getApp().inject({
      method: 'POST',
      url: '/campaigns',

      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },

      payload: {
        organizationId: organizationAId,

        name: 'Bad Dates',

        startsAt: '2026-12-31T00:00:00.000Z',

        endsAt: '2026-10-01T00:00:00.000Z',
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('rejects tenantId supplied by the client', async () => {
    const response = await getApp().inject({
      method: 'POST',
      url: '/campaigns',

      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },

      payload: {
        tenantId: tenantBId,

        organizationId: organizationAId,

        name: 'Malicious Campaign',
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('lists only campaigns belonging to the authenticated tenant', async () => {
    /*
     * Create another campaign directly
     * under Tenant B to prove isolation.
     */
    await getDatabase().insert(campaigns).values({
      tenantId: tenantBId,

      organizationId: organizationBId,

      name: 'Belgium Campaign',

      status: 'draft',
    });

    const response = await getApp().inject({
      method: 'GET',
      url: '/campaigns',

      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.payload) as Array<{
      id: string;
      tenantId: string;
      name: string;
    }>;

    expect(body.some((campaign) => campaign.name === 'Paris Expansion')).toBe(true);

    expect(body.some((campaign) => campaign.name === 'Belgium Campaign')).toBe(false);

    expect(body.every((campaign) => campaign.tenantId === tenantAId)).toBe(true);
  });

  it('returns a tenant campaign by id', async () => {
    const response = await getApp().inject({
      method: 'GET',

      url: `/campaigns/${createdCampaignId}`,

      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.payload) as {
      id: string;
      tenantId: string;
    };

    expect(body.id).toBe(createdCampaignId);

    expect(body.tenantId).toBe(tenantAId);
  });

  it('returns 404 for a campaign belonging to another tenant', async () => {
    const [foreignCampaign] = await getDatabase()
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.tenantId, tenantBId), eq(campaigns.name, 'Belgium Campaign')))
      .limit(1);

    if (!foreignCampaign) {
      throw new Error('Foreign campaign not found');
    }

    const response = await getApp().inject({
      method: 'GET',

      url: `/campaigns/${foreignCampaign.id}`,

      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },
    });

    expect(response.statusCode).toBe(404);
  });

  it('updates campaign status from draft to active', async () => {
    const response = await getApp().inject({
      method: 'PATCH',

      url: `/campaigns/${createdCampaignId}`,

      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },

      payload: {
        status: 'active',
      },
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.payload) as {
      status: string;
    };

    expect(body.status).toBe('active');
  });

  it('rejects an invalid campaign status value', async () => {
    const response = await getApp().inject({
      method: 'PATCH',

      url: `/campaigns/${createdCampaignId}`,

      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },

      payload: {
        status: 'deleted',
      },
    });

    expect(response.statusCode).toBe(400);
  });
});
