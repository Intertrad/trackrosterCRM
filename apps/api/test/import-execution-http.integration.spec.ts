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
import { establishmentContacts } from '../src/database/schema/establishment-contacts.js';
import { establishments } from '../src/database/schema/establishments.js';
import { tenants } from '../src/database/schema/tenants.js';
import { users } from '../src/database/schema/users.js';
import type { ImportExecutionResult } from '../src/imports/import-execution.types.js';
import { registerImportMultipart } from '../src/imports/import-multipart.js';
import { TenantService } from '../src/tenants/tenant.service.js';
import { UserRepository } from '../src/users/user.repository.js';

interface MultipartRequest {
  payload: string;
  contentType: string;
}

describe('Import execution HTTP integration', () => {
  let app: NestFastifyApplication | undefined;

  let database: Database | undefined;

  let tenantId = '';

  let adminAccessToken = '';
  let regularAccessToken = '';

  const adminPassword = 'ImportExecutionAdmin123!';

  const regularPassword = 'ImportExecutionRegular123!';

  function getApp(): NestFastifyApplication {
    if (!app) {
      throw new Error('Test application has not been initialized');
    }

    return app;
  }

  function getDatabase(): Database {
    if (!database) {
      throw new Error('Database has not been initialized');
    }

    return database;
  }

  function buildMultipartFile(
    filename: string,
    content: string,
    fieldname = 'file',
  ): MultipartRequest {
    const boundary = `----TrackRoster${randomUUID().replaceAll('-', '')}`;

    const payload = [
      `--${boundary}\r\n`,
      `Content-Disposition: form-data; name="${fieldname}"; filename="${filename}"\r\n`,
      'Content-Type: text/csv\r\n',
      '\r\n',
      content,
      '\r\n',
      `--${boundary}--\r\n`,
    ].join('');

    return {
      payload,

      contentType: `multipart/form-data; boundary=${boundary}`,
    };
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

    /*
     * main.ts does not run during
     * integration tests.
     */
    await registerImportMultipart(application);

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
      name: `Execution HTTP Tenant ${suffix}`,

      slug: `execution-http-${suffix}`,
    });

    tenantId = tenant.id;

    const adminEmail = `execution-admin-${suffix}@trackroster.test`;

    const regularEmail = `execution-user-${suffix}@trackroster.test`;

    const admin = await userRepository.create({
      tenantId,
      email: adminEmail,

      passwordHash: await passwordService.hash(adminPassword),

      status: 'active',
    });

    await userRepository.create({
      tenantId,
      email: regularEmail,

      passwordHash: await passwordService.hash(regularPassword),

      status: 'active',
    });

    await grantRepository.create({
      tenantId,
      userId: admin.id,

      role: 'client_admin',
      scopeType: 'tenant',
    });

    adminAccessToken = (await login(adminEmail, adminPassword)).accessToken;

    regularAccessToken = (await login(regularEmail, regularPassword)).accessToken;
  });

  afterAll(async () => {
    try {
      if (database && tenantId) {
        await database
          .delete(establishmentContacts)
          .where(eq(establishmentContacts.tenantId, tenantId));

        await database.delete(establishments).where(eq(establishments.tenantId, tenantId));

        await database.delete(users).where(eq(users.tenantId, tenantId));

        await database.delete(tenants).where(eq(tenants.id, tenantId));
      }
    } finally {
      if (app) {
        await app.close();
      }
    }
  });

  it('rejects execution without authentication', async () => {
    const multipart = buildMultipartFile(
      'establishments.csv',
      ['name,country_code', 'Restaurant Paris,FR'].join('\n'),
    );

    const response = await getApp().inject({
      method: 'POST',
      url: '/imports/execute',

      headers: {
        'content-type': multipart.contentType,
      },

      payload: multipart.payload,
    });

    expect(response.statusCode).toBe(401);
  });

  it('rejects execution for a non-admin user', async () => {
    const multipart = buildMultipartFile(
      'establishments.csv',
      ['name,country_code', 'Restaurant Paris,FR'].join('\n'),
    );

    const response = await getApp().inject({
      method: 'POST',
      url: '/imports/execute',

      headers: {
        authorization: `Bearer ${regularAccessToken}`,

        'content-type': multipart.contentType,
      },

      payload: multipart.payload,
    });

    expect(response.statusCode).toBe(403);
  });

  it('creates establishment and contact on first execution', async () => {
    const csv = [
      'external_reference,name,postal_code,city,country_code,contact_name,contact_email',

      'HTTP-001,HTTP Restaurant,75001,Paris,FR,Marie HTTP,marie-http@example.com',
    ].join('\n');

    const multipart = buildMultipartFile('establishments.csv', csv);

    const response = await getApp().inject({
      method: 'POST',
      url: '/imports/execute',

      headers: {
        authorization: `Bearer ${adminAccessToken}`,

        'content-type': multipart.contentType,
      },

      payload: multipart.payload,
    });

    expect(response.statusCode).toBe(200);

    const result = JSON.parse(response.payload) as ImportExecutionResult;

    expect(result.summary).toEqual({
      totalRows: 1,

      createdEstablishments: 1,
      reusedEstablishments: 0,

      createdContacts: 1,

      skippedRows: 0,
      failedRows: 0,
    });

    const storedEstablishments = await getDatabase()
      .select()
      .from(establishments)
      .where(eq(establishments.tenantId, tenantId));

    const storedContacts = await getDatabase()
      .select()
      .from(establishmentContacts)
      .where(eq(establishmentContacts.tenantId, tenantId));

    expect(storedEstablishments).toHaveLength(1);

    expect(storedContacts).toHaveLength(1);
  });

  it('reuses establishment and contact when the same CSV is executed again', async () => {
    const csv = [
      'external_reference,name,postal_code,city,country_code,contact_name,contact_email',

      'HTTP-001,HTTP Restaurant,75001,Paris,FR,Marie HTTP,marie-http@example.com',
    ].join('\n');

    const multipart = buildMultipartFile('establishments.csv', csv);

    const response = await getApp().inject({
      method: 'POST',
      url: '/imports/execute',

      headers: {
        authorization: `Bearer ${adminAccessToken}`,

        'content-type': multipart.contentType,
      },

      payload: multipart.payload,
    });

    expect(response.statusCode).toBe(200);

    const result = JSON.parse(response.payload) as ImportExecutionResult;

    expect(result.summary).toEqual({
      totalRows: 1,

      createdEstablishments: 0,
      reusedEstablishments: 1,

      createdContacts: 0,

      skippedRows: 0,
      failedRows: 0,
    });

    const storedEstablishments = await getDatabase()
      .select()
      .from(establishments)
      .where(eq(establishments.tenantId, tenantId));

    const storedContacts = await getDatabase()
      .select()
      .from(establishmentContacts)
      .where(eq(establishmentContacts.tenantId, tenantId));

    /*
     * HTTP idempotency-like proof:
     * same CSV twice does not duplicate.
     */
    expect(storedEstablishments).toHaveLength(1);

    expect(storedContacts).toHaveLength(1);
  });

  it('rejects non-multipart execution requests', async () => {
    const response = await getApp().inject({
      method: 'POST',
      url: '/imports/execute',

      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },

      payload: {
        csv: 'name,country_code',
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('rejects a non-CSV filename', async () => {
    const multipart = buildMultipartFile(
      'establishments.txt',
      ['name,country_code', 'Restaurant Lyon,FR'].join('\n'),
    );

    const response = await getApp().inject({
      method: 'POST',
      url: '/imports/execute',

      headers: {
        authorization: `Bearer ${adminAccessToken}`,

        'content-type': multipart.contentType,
      },

      payload: multipart.payload,
    });

    expect(response.statusCode).toBe(400);
  });
});
