import { randomUUID } from 'node:crypto';
import { auditEvents } from '../src/database/schema/audit-events.js';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import type { AuthenticationTokens } from '../src/auth/auth.types.js';
import { PasswordService } from '../src/auth/password.service.js';
import { UserAccessGrantRepository } from '../src/authorization/user-access-grant.repository.js';
import type { Database } from '../src/database/database.types.js';
import { campaignProspects } from '../src/database/schema/campaign-prospects.js';
import { campaigns } from '../src/database/schema/campaigns.js';
import { establishments } from '../src/database/schema/establishments.js';
import { organizations } from '../src/database/schema/organizations.js';
import { tenants } from '../src/database/schema/tenants.js';
import { users } from '../src/database/schema/users.js';
import { TenantService } from '../src/tenants/tenant.service.js';
import { UserRepository } from '../src/users/user.repository.js';
import { getSeedDatabase } from './support/seed.js';

describe('Campaign prospect HTTP integration', () => {
  let app: NestFastifyApplication | undefined;

  let database: Database | undefined;

  let tenantAId = '';
  let tenantBId = '';

  let campaignAId = '';

  let establishmentAId = '';
  let establishmentBId = '';

  let prospectId = '';

  let adminAccessToken = '';
  let regularAccessToken = '';

  const adminPassword = 'CampaignProspectAdmin123!';

  const regularPassword = 'CampaignProspectUser123!';

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
      name: `Prospect Tenant A ${suffix}`,

      slug: `prospect-a-${suffix}`,
    });

    const tenantB = await tenantService.create({
      name: `Prospect Tenant B ${suffix}`,

      slug: `prospect-b-${suffix}`,
    });

    tenantAId = tenantA.id;
    tenantBId = tenantB.id;

    const [organizationA] = await getDatabase()
      .insert(organizations)
      .values({
        tenantId: tenantAId,

        name: 'France Sales',

        slug: `france-${suffix}`,

        status: 'active',
      })
      .returning();

    const [organizationB] = await getDatabase()
      .insert(organizations)
      .values({
        tenantId: tenantBId,

        name: 'Belgium Sales',

        slug: `belgium-${suffix}`,

        status: 'active',
      })
      .returning();

    if (!organizationA || !organizationB) {
      throw new Error('Failed to create organizations');
    }

    const [campaignA] = await getDatabase()
      .insert(campaigns)
      .values({
        tenantId: tenantAId,

        organizationId: organizationA.id,

        name: 'Paris Expansion',

        status: 'draft',
      })
      .returning();

    const [campaignB] = await getDatabase()
      .insert(campaigns)
      .values({
        tenantId: tenantBId,

        organizationId: organizationB.id,

        name: 'Belgium Expansion',

        status: 'draft',
      })
      .returning();

    if (!campaignA || !campaignB) {
      throw new Error('Failed to create campaigns');
    }

    campaignAId = campaignA.id;

    const [establishmentA] = await getDatabase()
      .insert(establishments)
      .values({
        tenantId: tenantAId,

        name: 'Restaurant Paris',

        normalizedName: 'restaurant paris',

        city: 'Paris',

        countryCode: 'FR',

        source: 'manual',

        status: 'active',
      })
      .returning();

    const [establishmentB] = await getDatabase()
      .insert(establishments)
      .values({
        tenantId: tenantBId,

        name: 'Restaurant Brussels',

        normalizedName: 'restaurant brussels',

        city: 'Brussels',

        countryCode: 'BE',

        source: 'manual',

        status: 'active',
      })
      .returning();

    if (!establishmentA || !establishmentB) {
      throw new Error('Failed to create establishments');
    }

    establishmentAId = establishmentA.id;

    establishmentBId = establishmentB.id;

    const adminEmail = `prospect-admin-${suffix}@trackroster.test`;

    const regularEmail = `prospect-user-${suffix}@trackroster.test`;

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
        for (const tenantId of [tenantAId, tenantBId]) {
          if (!tenantId) {
            continue;
          }

          await database.delete(campaignProspects).where(eq(campaignProspects.tenantId, tenantId));
          await database.delete(auditEvents).where(eq(auditEvents.tenantId, tenantId));

          await database.delete(users).where(eq(users.tenantId, tenantId));

          await database.delete(campaigns).where(eq(campaigns.tenantId, tenantId));

          await database.delete(establishments).where(eq(establishments.tenantId, tenantId));

          await database.delete(auditEvents).where(eq(auditEvents.tenantId, tenantId));

          await database.delete(users).where(eq(users.tenantId, tenantId));

          await database.delete(organizations).where(eq(organizations.tenantId, tenantId));

          await database.delete(tenants).where(eq(tenants.id, tenantId));
        }
      }
    } finally {
      if (app) {
        await app.close();
      }
    }
  });

  it('rejects adding a prospect without authentication', async () => {
    const response = await getApp().inject({
      method: 'POST',

      url: `/campaigns/${campaignAId}/prospects`,

      payload: {
        establishmentId: establishmentAId,
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it('rejects adding a prospect for a non-admin user', async () => {
    const response = await getApp().inject({
      method: 'POST',

      url: `/campaigns/${campaignAId}/prospects`,

      headers: {
        authorization: `Bearer ${regularAccessToken}`,
      },

      payload: {
        establishmentId: establishmentAId,
      },
    });

    expect(response.statusCode).toBe(403);
  });

  it('adds an establishment to a campaign', async () => {
    const response = await getApp().inject({
      method: 'POST',

      url: `/campaigns/${campaignAId}/prospects`,

      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },

      payload: {
        establishmentId: establishmentAId,
      },
    });

    expect(response.statusCode).toBe(201);

    const body = JSON.parse(response.payload) as {
      id: string;
      tenantId: string;
      campaignId: string;
      establishmentId: string;
      status: string;
    };

    prospectId = body.id;

    expect(body).toMatchObject({
      tenantId: tenantAId,

      campaignId: campaignAId,

      establishmentId: establishmentAId,

      status: 'active',
    });
  });

  it('rejects duplicate active membership', async () => {
    const response = await getApp().inject({
      method: 'POST',

      url: `/campaigns/${campaignAId}/prospects`,

      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },

      payload: {
        establishmentId: establishmentAId,
      },
    });

    expect(response.statusCode).toBe(409);
  });

  it('rejects an establishment belonging to another tenant', async () => {
    const response = await getApp().inject({
      method: 'POST',

      url: `/campaigns/${campaignAId}/prospects`,

      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },

      payload: {
        establishmentId: establishmentBId,
      },
    });

    expect(response.statusCode).toBe(404);
  });

  it('rejects tenantId supplied by the client', async () => {
    const response = await getApp().inject({
      method: 'POST',

      url: `/campaigns/${campaignAId}/prospects`,

      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },

      payload: {
        tenantId: tenantBId,

        establishmentId: establishmentAId,
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('lists campaign prospects', async () => {
    const response = await getApp().inject({
      method: 'GET',

      url: `/campaigns/${campaignAId}/prospects`,

      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.payload) as Array<{
      id: string;
      tenantId: string;
      campaignId: string;
    }>;

    expect(body).toHaveLength(1);

    expect(body[0]).toMatchObject({
      id: prospectId,

      tenantId: tenantAId,

      campaignId: campaignAId,
    });
  });

  it('gets a campaign prospect by id', async () => {
    const response = await getApp().inject({
      method: 'GET',

      url: `/campaigns/${campaignAId}/prospects/${prospectId}`,

      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.payload) as {
      id: string;
    };

    expect(body.id).toBe(prospectId);
  });

  it('returns 404 when the prospect is addressed through another campaign', async () => {
    const [secondCampaign] = await getDatabase()
      .insert(campaigns)
      .values({
        tenantId: tenantAId,

        organizationId: (
          await getDatabase()
            .select()
            .from(organizations)
            .where(eq(organizations.tenantId, tenantAId))
            .limit(1)
        )[0]!.id,

        name: 'Second Campaign',

        status: 'draft',
      })
      .returning();

    if (!secondCampaign) {
      throw new Error('Failed to create second campaign');
    }

    const response = await getApp().inject({
      method: 'GET',

      url: `/campaigns/${secondCampaign.id}/prospects/${prospectId}`,

      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },
    });

    expect(response.statusCode).toBe(404);
  });

  it('excludes a campaign prospect', async () => {
    const response = await getApp().inject({
      method: 'PATCH',

      url: `/campaigns/${campaignAId}/prospects/${prospectId}`,

      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },

      payload: {
        status: 'excluded',
      },
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.payload) as {
      id: string;
      status: string;
    };

    expect(body.id).toBe(prospectId);

    expect(body.status).toBe('excluded');
  });

  it('reactivates an excluded prospect without creating another membership', async () => {
    const response = await getApp().inject({
      method: 'POST',

      url: `/campaigns/${campaignAId}/prospects`,

      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },

      payload: {
        establishmentId: establishmentAId,
      },
    });

    expect(response.statusCode).toBe(201);

    const body = JSON.parse(response.payload) as {
      id: string;
      status: string;
    };

    /*
     * Same membership ID.
     */
    expect(body.id).toBe(prospectId);

    expect(body.status).toBe('active');

    const storedMemberships = await getDatabase()
      .select()
      .from(campaignProspects)
      .where(
        and(
          eq(campaignProspects.tenantId, tenantAId),
          eq(campaignProspects.campaignId, campaignAId),
          eq(campaignProspects.establishmentId, establishmentAId),
        ),
      );

    expect(storedMemberships).toHaveLength(1);
  });

  it('blocks membership changes after campaign completion', async () => {
    await getDatabase()
      .update(campaigns)
      .set({
        status: 'completed',

        updatedAt: new Date(),
      })
      .where(and(eq(campaigns.tenantId, tenantAId), eq(campaigns.id, campaignAId)));

    const response = await getApp().inject({
      method: 'PATCH',

      url: `/campaigns/${campaignAId}/prospects/${prospectId}`,

      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },

      payload: {
        status: 'excluded',
      },
    });

    expect(response.statusCode).toBe(409);
  });
});
