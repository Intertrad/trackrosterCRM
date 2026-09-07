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
import { DATABASE } from '../src/database/database.constants.js';
import type { Database } from '../src/database/database.types.js';
import {
  establishmentContacts,
  type EstablishmentContact,
} from '../src/database/schema/establishment-contacts.js';
import { establishments } from '../src/database/schema/establishments.js';
import { tenants } from '../src/database/schema/tenants.js';
import { users } from '../src/database/schema/users.js';
import { EstablishmentRepository } from '../src/establishments/establishment.repository.js';
import { TenantService } from '../src/tenants/tenant.service.js';
import { UserRepository } from '../src/users/user.repository.js';

describe('Establishment contact HTTP integration', () => {
  let app: NestFastifyApplication | undefined;
  let database: Database | undefined;

  let tenantAId = '';
  let tenantBId = '';

  let establishmentAId = '';
  let establishmentA2Id = '';
  let establishmentBId = '';

  let adminEmail = '';
  let regularEmail = '';

  const adminPassword = 'ContactAdminPassword123!';

  const regularPassword = 'ContactRegularPassword123!';

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

    database = application.get<Database>(DATABASE);

    const tenantService = application.get(TenantService);

    const userRepository = application.get(UserRepository);

    const passwordService = application.get(PasswordService);

    const grantRepository = application.get(UserAccessGrantRepository);

    const establishmentRepository = application.get(EstablishmentRepository);

    const suffix = randomUUID().replaceAll('-', '').slice(0, 10);

    const tenantA = await tenantService.create({
      name: `Contact Tenant A ${suffix}`,
      slug: `contact-a-${suffix}`,
    });

    const tenantB = await tenantService.create({
      name: `Contact Tenant B ${suffix}`,
      slug: `contact-b-${suffix}`,
    });

    tenantAId = tenantA.id;
    tenantBId = tenantB.id;

    adminEmail = `contact-admin-${suffix}@trackroster.test`;

    regularEmail = `contact-regular-${suffix}@trackroster.test`;

    const adminPasswordHash = await passwordService.hash(adminPassword);

    const regularPasswordHash = await passwordService.hash(regularPassword);

    const admin = await userRepository.create({
      tenantId: tenantA.id,
      email: adminEmail,
      passwordHash: adminPasswordHash,
      status: 'active',
    });

    await userRepository.create({
      tenantId: tenantA.id,
      email: regularEmail,
      passwordHash: regularPasswordHash,
      status: 'active',
    });

    await grantRepository.create({
      tenantId: tenantA.id,
      userId: admin.id,
      role: 'client_admin',
      scopeType: 'tenant',
    });

    const establishmentA = await establishmentRepository.create({
      tenantId: tenantA.id,
      name: 'Contact Test Restaurant',
      normalizedName: 'contact test restaurant',
      countryCode: 'FR',
      status: 'active',
      source: 'manual',
    });

    establishmentAId = establishmentA.id;

    const establishmentA2 = await establishmentRepository.create({
      tenantId: tenantA.id,
      name: 'Second Contact Restaurant',
      normalizedName: 'second contact restaurant',
      countryCode: 'FR',
      status: 'active',
      source: 'manual',
    });

    establishmentA2Id = establishmentA2.id;

    const establishmentB = await establishmentRepository.create({
      tenantId: tenantB.id,
      name: 'Other Tenant Restaurant',
      normalizedName: 'other tenant restaurant',
      countryCode: 'FR',
      status: 'active',
      source: 'manual',
    });

    establishmentBId = establishmentB.id;
  });

  afterAll(async () => {
    try {
      if (database) {
        if (tenantAId) {
          await database
            .delete(establishmentContacts)
            .where(eq(establishmentContacts.tenantId, tenantAId));

          await database.delete(establishments).where(eq(establishments.tenantId, tenantAId));

          await database.delete(users).where(eq(users.tenantId, tenantAId));

          await database.delete(tenants).where(eq(tenants.id, tenantAId));
        }

        if (tenantBId) {
          await database
            .delete(establishmentContacts)
            .where(eq(establishmentContacts.tenantId, tenantBId));

          await database.delete(establishments).where(eq(establishments.tenantId, tenantBId));

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

  it('rejects unauthenticated contact access', async () => {
    const response = await getApp().inject({
      method: 'GET',
      url: `/establishments/${establishmentAId}/contacts`,
    });

    expect(response.statusCode).toBe(401);
  });

  it('rejects an authenticated non-admin', async () => {
    const tokens = await login(regularEmail, regularPassword);

    const response = await getApp().inject({
      method: 'GET',
      url: `/establishments/${establishmentAId}/contacts`,

      headers: {
        authorization: `Bearer ${tokens.accessToken}`,
      },
    });

    expect(response.statusCode).toBe(403);
  });

  it('allows a client admin to create and normalize a contact', async () => {
    const tokens = await login(adminEmail, adminPassword);

    const response = await getApp().inject({
      method: 'POST',

      url: `/establishments/${establishmentAId}/contacts`,

      headers: {
        authorization: `Bearer ${tokens.accessToken}`,
      },

      payload: {
        name: '  Marie Dupont  ',

        jobTitle: ' Purchasing Manager ',

        email: ' MARIE@EXAMPLE.COM ',

        phone: ' +33123456789 ',

        isPrimary: true,
      },
    });

    expect(response.statusCode).toBe(201);

    const contact = JSON.parse(response.payload) as EstablishmentContact;

    expect(contact.tenantId).toBe(tenantAId);

    expect(contact.establishmentId).toBe(establishmentAId);

    expect(contact.name).toBe('Marie Dupont');

    expect(contact.email).toBe('marie@example.com');

    expect(contact.jobTitle).toBe('Purchasing Manager');

    expect(contact.isPrimary).toBe(true);

    expect(contact.status).toBe('active');

    expect(contact.source).toBe('manual');
  });

  it('lists contacts for an establishment', async () => {
    const tokens = await login(adminEmail, adminPassword);

    const response = await getApp().inject({
      method: 'GET',

      url: `/establishments/${establishmentAId}/contacts`,

      headers: {
        authorization: `Bearer ${tokens.accessToken}`,
      },
    });

    expect(response.statusCode).toBe(200);

    const contacts = JSON.parse(response.payload) as EstablishmentContact[];

    expect(contacts.length).toBeGreaterThan(0);

    for (const contact of contacts) {
      expect(contact.tenantId).toBe(tenantAId);

      expect(contact.establishmentId).toBe(establishmentAId);
    }
  });

  it('rejects a cross-tenant establishment', async () => {
    const tokens = await login(adminEmail, adminPassword);

    const response = await getApp().inject({
      method: 'POST',

      url: `/establishments/${establishmentBId}/contacts`,

      headers: {
        authorization: `Bearer ${tokens.accessToken}`,
      },

      payload: {
        name: 'Should Not Exist',
      },
    });

    expect(response.statusCode).toBe(404);
  });

  it('returns conflict for a duplicate email within the same establishment', async () => {
    const tokens = await login(adminEmail, adminPassword);

    const response = await getApp().inject({
      method: 'POST',

      url: `/establishments/${establishmentAId}/contacts`,

      headers: {
        authorization: `Bearer ${tokens.accessToken}`,
      },

      payload: {
        name: 'Duplicate Marie',
        email: 'MARIE@EXAMPLE.COM',
      },
    });

    expect(response.statusCode).toBe(409);
  });

  it('allows the same email on another establishment', async () => {
    const tokens = await login(adminEmail, adminPassword);

    const response = await getApp().inject({
      method: 'POST',

      url: `/establishments/${establishmentA2Id}/contacts`,

      headers: {
        authorization: `Bearer ${tokens.accessToken}`,
      },

      payload: {
        name: 'Marie Other Location',

        email: 'marie@example.com',
      },
    });

    expect(response.statusCode).toBe(201);
  });

  it('rejects a second primary contact for the same establishment', async () => {
    const tokens = await login(adminEmail, adminPassword);

    const response = await getApp().inject({
      method: 'POST',

      url: `/establishments/${establishmentAId}/contacts`,

      headers: {
        authorization: `Bearer ${tokens.accessToken}`,
      },

      payload: {
        name: 'John Martin',
        email: 'john@example.com',
        isPrimary: true,
      },
    });

    expect(response.statusCode).toBe(409);
  });

  it('returns 404 when a contact is addressed through the wrong establishment', async () => {
    const tokens = await login(adminEmail, adminPassword);

    const createResponse = await getApp().inject({
      method: 'POST',

      url: `/establishments/${establishmentA2Id}/contacts`,

      headers: {
        authorization: `Bearer ${tokens.accessToken}`,
      },

      payload: {
        name: 'Wrong Route Test',
        email: 'wrong-route@example.com',
      },
    });

    expect(createResponse.statusCode).toBe(201);

    const contact = JSON.parse(createResponse.payload) as EstablishmentContact;

    const response = await getApp().inject({
      method: 'GET',

      url: `/establishments/${establishmentAId}/contacts/${contact.id}`,

      headers: {
        authorization: `Bearer ${tokens.accessToken}`,
      },
    });

    expect(response.statusCode).toBe(404);
  });

  it('automatically removes primary status when archiving a primary contact', async () => {
    const tokens = await login(adminEmail, adminPassword);

    const listResponse = await getApp().inject({
      method: 'GET',

      url: `/establishments/${establishmentAId}/contacts`,

      headers: {
        authorization: `Bearer ${tokens.accessToken}`,
      },
    });

    expect(listResponse.statusCode).toBe(200);

    const contacts = JSON.parse(listResponse.payload) as EstablishmentContact[];

    const primary = contacts.find((contact) => contact.isPrimary);

    expect(primary).toBeDefined();

    if (!primary) {
      throw new Error('Expected primary contact');
    }

    const response = await getApp().inject({
      method: 'PATCH',

      url: `/establishments/${establishmentAId}/contacts/${primary.id}`,

      headers: {
        authorization: `Bearer ${tokens.accessToken}`,
      },

      payload: {
        status: 'archived',
      },
    });

    expect(response.statusCode).toBe(200);

    const updated = JSON.parse(response.payload) as EstablishmentContact;

    expect(updated.status).toBe('archived');

    expect(updated.isPrimary).toBe(false);
  });

  it('rejects a contact with no useful identity', async () => {
    const tokens = await login(adminEmail, adminPassword);

    const response = await getApp().inject({
      method: 'POST',

      url: `/establishments/${establishmentAId}/contacts`,

      headers: {
        authorization: `Bearer ${tokens.accessToken}`,
      },

      payload: {
        name: '   ',
        phone: '   ',
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('rejects tenantId supplied by the client', async () => {
    const tokens = await login(adminEmail, adminPassword);

    const response = await getApp().inject({
      method: 'POST',

      url: `/establishments/${establishmentAId}/contacts`,

      headers: {
        authorization: `Bearer ${tokens.accessToken}`,
      },

      payload: {
        tenantId: tenantBId,
        name: 'Malicious Contact',
      },
    });

    expect(response.statusCode).toBe(400);
  });
});
