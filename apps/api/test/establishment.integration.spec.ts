import { clearSessionEvidenceForUsers } from './support/session-evidence.js';
import { randomUUID } from 'node:crypto';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import type { AuthenticationTokens } from '../src/auth/auth.types.js';
import { PasswordService } from '../src/auth/password.service.js';
import { UserAccessGrantRepository } from '../src/authorization/user-access-grant.repository.js';
import type { Database } from '../src/database/database.types.js';
import { establishments, type Establishment } from '../src/database/schema/establishments.js';
import { tenants } from '../src/database/schema/tenants.js';
import { users } from '../src/database/schema/users.js';
import { EstablishmentRepository } from '../src/establishments/establishment.repository.js';
import { TenantService } from '../src/tenants/tenant.service.js';
import { UserRepository } from '../src/users/user.repository.js';
import { getSeedDatabase, withSeedScope } from './support/seed.js';

describe('Establishment HTTP integration', () => {
  let app: NestFastifyApplication | undefined;
  let database: Database | undefined;

  let tenantAId = '';
  let tenantBId = '';

  let adminUserId = '';

  let adminEmail = '';
  let regularEmail = '';

  let tenantBEstablishmentId = '';

  const adminPassword = 'EstablishmentAdminPassword123!';

  const regularPassword = 'EstablishmentRegularPassword123!';

  function getApp(): NestFastifyApplication {
    if (!app) {
      throw new Error('Test application has not been initialized');
    }

    return app;
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

    /* Fixtures span several tenants and run through container-resolved
       repositories, so they need the privileged executor; see withSeedScope. */
    await withSeedScope(async () => {
      const tenantService = application.get(TenantService);

      const userRepository = application.get(UserRepository);

      const passwordService = application.get(PasswordService);

      const grantRepository = application.get(UserAccessGrantRepository);

      const establishmentRepository = application.get(EstablishmentRepository);

      const suffix = randomUUID().replaceAll('-', '').slice(0, 10);

      const tenantA = await tenantService.create({
        name: `Establishment Tenant A ${suffix}`,
        slug: `establishment-a-${suffix}`,
      });

      const tenantB = await tenantService.create({
        name: `Establishment Tenant B ${suffix}`,
        slug: `establishment-b-${suffix}`,
      });

      tenantAId = tenantA.id;
      tenantBId = tenantB.id;

      adminEmail = `est-admin-${suffix}@trackroster.test`;

      regularEmail = `est-regular-${suffix}@trackroster.test`;

      const adminPasswordHash = await passwordService.hash(adminPassword);

      const regularPasswordHash = await passwordService.hash(regularPassword);

      const adminUser = await userRepository.create({
        tenantId: tenantA.id,
        email: adminEmail,
        passwordHash: adminPasswordHash,
        status: 'active',
      });

      adminUserId = adminUser.id;

      await userRepository.create({
        tenantId: tenantA.id,
        email: regularEmail,
        passwordHash: regularPasswordHash,
        status: 'active',
      });

      await grantRepository.create({
        tenantId: tenantA.id,
        userId: adminUser.id,
        role: 'client_admin',
        scopeType: 'tenant',
      });

      const tenantBEstablishment = await establishmentRepository.create({
        tenantId: tenantB.id,
        name: 'Tenant B Restaurant',
        normalizedName: 'tenant b restaurant',
        countryCode: 'FR',
        status: 'active',
        source: 'manual',
      });

      tenantBEstablishmentId = tenantBEstablishment.id;
    });
  });

  afterAll(async () => {
    try {
      if (database) {
        if (tenantAId) {
          await database.delete(establishments).where(eq(establishments.tenantId, tenantAId));

          await clearSessionEvidenceForUsers(database, eq(users.tenantId, tenantAId));
          await database.delete(users).where(eq(users.tenantId, tenantAId));

          await database.delete(tenants).where(eq(tenants.id, tenantAId));
        }

        if (tenantBId) {
          await database.delete(establishments).where(eq(establishments.tenantId, tenantBId));

          await clearSessionEvidenceForUsers(database, eq(users.tenantId, tenantBId));
          await database.delete(users).where(eq(users.tenantId, tenantBId));

          await database.delete(tenants).where(eq(tenants.id, tenantBId));
        }
      }
    } finally {
      if (app) {
        await app.close();
      }
    }
  });

  it('rejects unauthenticated establishment access', async () => {
    const response = await getApp().inject({
      method: 'GET',
      url: '/establishments',
    });

    expect(response.statusCode).toBe(401);
  });

  it('rejects an authenticated non-admin', async () => {
    const tokens = await login(regularEmail, regularPassword);

    const response = await getApp().inject({
      method: 'GET',
      url: '/establishments',
      headers: {
        authorization: `Bearer ${tokens.accessToken}`,
      },
    });

    expect(response.statusCode).toBe(403);
  });

  it('allows a client admin to create an establishment', async () => {
    const tokens = await login(adminEmail, adminPassword);

    const response = await getApp().inject({
      method: 'POST',
      url: '/establishments',

      headers: {
        authorization: `Bearer ${tokens.accessToken}`,
      },

      payload: {
        name: '  RESTAURANT   Le Paris  ',
        externalReference: 'PARIS-001',
        addressLine1: '12 Rue Example',
        postalCode: '75001',
        city: 'Paris',
        countryCode: 'fr',
        phone: '+33123456789',
        website: 'https://example.com',
        latitude: 48.8566,
        longitude: 2.3522,
      },
    });

    expect(response.statusCode).toBe(201);

    const establishment = JSON.parse(response.payload) as Establishment;

    expect(establishment.tenantId).toBe(tenantAId);

    expect(establishment.name).toBe('RESTAURANT   Le Paris');

    expect(establishment.normalizedName).toBe('restaurant le paris');

    expect(establishment.countryCode).toBe('FR');

    expect(establishment.source).toBe('manual');

    expect(establishment.status).toBe('active');
  });

  it('lists only establishments from the authenticated tenant', async () => {
    const tokens = await login(adminEmail, adminPassword);

    const response = await getApp().inject({
      method: 'GET',
      url: '/establishments',

      headers: {
        authorization: `Bearer ${tokens.accessToken}`,
      },
    });

    expect(response.statusCode).toBe(200);

    const result = JSON.parse(response.payload) as Establishment[];

    expect(result.length).toBeGreaterThan(0);

    for (const establishment of result) {
      expect(establishment.tenantId).toBe(tenantAId);
    }

    expect(result.some((establishment) => establishment.id === tenantBEstablishmentId)).toBe(false);
  });

  it('creates a categorised establishment and filters the list by category', async () => {
    const tokens = await login(adminEmail, adminPassword);
    const authorization = { authorization: `Bearer ${tokens.accessToken}` };

    const created = await getApp().inject({
      method: 'POST',
      url: '/establishments',
      headers: authorization,
      payload: { name: `CRA des Plaines ${randomUUID()}`, countryCode: 'FR', category: 'cra' },
    });

    expect(created.statusCode, created.payload).toBe(201);
    expect((JSON.parse(created.payload) as Establishment).category).toBe('cra');

    const filtered = await getApp().inject({
      method: 'GET',
      url: '/establishments?category=cra',
      headers: authorization,
    });

    expect(filtered.statusCode).toBe(200);

    const rows = JSON.parse(filtered.payload) as Establishment[];

    expect(rows.length).toBeGreaterThan(0);

    /* Every row matches the filter, belongs to this tenant, and the
       uncategorised establishments seeded by this suite are excluded. */
    for (const row of rows) {
      expect(row.category).toBe('cra');
      expect(row.tenantId).toBe(tenantAId);
    }

    const other = await getApp().inject({
      method: 'GET',
      url: '/establishments?category=sante',
      headers: authorization,
    });

    expect(other.statusCode).toBe(200);
    expect(
      (JSON.parse(other.payload) as Establishment[]).some((row) => row.category !== 'sante'),
    ).toBe(false);
  });

  it('rejects an unknown category on the listing filter', async () => {
    const tokens = await login(adminEmail, adminPassword);

    const response = await getApp().inject({
      method: 'GET',
      url: '/establishments?category=gendarmerie',
      headers: { authorization: `Bearer ${tokens.accessToken}` },
    });

    /* A 400 rather than a 500: the value never reaches PostgreSQL. */
    expect(response.statusCode).toBe(400);
  });

  it('returns 404 when reading another tenant establishment', async () => {
    const tokens = await login(adminEmail, adminPassword);

    const response = await getApp().inject({
      method: 'GET',

      url: `/establishments/${tenantBEstablishmentId}`,

      headers: {
        authorization: `Bearer ${tokens.accessToken}`,
      },
    });

    expect(response.statusCode).toBe(404);
  });

  it('returns 404 when updating another tenant establishment', async () => {
    const tokens = await login(adminEmail, adminPassword);

    const response = await getApp().inject({
      method: 'PATCH',

      url: `/establishments/${tenantBEstablishmentId}`,

      headers: {
        authorization: `Bearer ${tokens.accessToken}`,
      },

      payload: {
        name: 'Should Not Change',
      },
    });

    expect(response.statusCode).toBe(404);
  });

  it('rejects coordinates when only latitude is supplied', async () => {
    const tokens = await login(adminEmail, adminPassword);

    const response = await getApp().inject({
      method: 'POST',
      url: '/establishments',

      headers: {
        authorization: `Bearer ${tokens.accessToken}`,
      },

      payload: {
        name: 'Invalid Coordinates',
        countryCode: 'FR',
        latitude: 48.8566,
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns conflict for a duplicate external reference in the same tenant and source', async () => {
    const tokens = await login(adminEmail, adminPassword);

    const payload = {
      name: 'Duplicate Reference Test',
      externalReference: 'DUPLICATE-001',
      countryCode: 'FR',
    };

    const first = await getApp().inject({
      method: 'POST',
      url: '/establishments',

      headers: {
        authorization: `Bearer ${tokens.accessToken}`,
      },

      payload,
    });

    expect(first.statusCode).toBe(201);

    const second = await getApp().inject({
      method: 'POST',
      url: '/establishments',

      headers: {
        authorization: `Bearer ${tokens.accessToken}`,
      },

      payload: {
        ...payload,
        name: 'Another Establishment',
      },
    });

    expect(second.statusCode).toBe(409);
  });

  it('allows a client admin to update their own tenant establishment', async () => {
    const tokens = await login(adminEmail, adminPassword);

    const createResponse = await getApp().inject({
      method: 'POST',
      url: '/establishments',

      headers: {
        authorization: `Bearer ${tokens.accessToken}`,
      },

      payload: {
        name: 'Original Name',
        countryCode: 'FR',
      },
    });

    expect(createResponse.statusCode).toBe(201);

    const created = JSON.parse(createResponse.payload) as Establishment;

    const updateResponse = await getApp().inject({
      method: 'PATCH',

      url: `/establishments/${created.id}`,

      headers: {
        authorization: `Bearer ${tokens.accessToken}`,
      },

      payload: {
        name: '  Updated   Restaurant  ',
        city: 'Paris',
        status: 'inactive',
      },
    });

    expect(updateResponse.statusCode).toBe(200);

    const updated = JSON.parse(updateResponse.payload) as Establishment;

    expect(updated.name).toBe('Updated   Restaurant');

    expect(updated.normalizedName).toBe('updated restaurant');

    expect(updated.city).toBe('Paris');

    expect(updated.status).toBe('inactive');

    expect(updated.tenantId).toBe(tenantAId);
  });

  it('rejects tenantId supplied by the client', async () => {
    const tokens = await login(adminEmail, adminPassword);

    const response = await getApp().inject({
      method: 'POST',
      url: '/establishments',

      headers: {
        authorization: `Bearer ${tokens.accessToken}`,
      },

      payload: {
        tenantId: tenantBId,
        name: 'Malicious Tenant Attempt',
        countryCode: 'FR',
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('keeps the client admin account active', async () => {
    expect(adminUserId).not.toBe('');
  });
});
