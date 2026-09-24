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
import { establishmentContacts } from '../src/database/schema/establishment-contacts.js';
import { establishments } from '../src/database/schema/establishments.js';
import { tenants } from '../src/database/schema/tenants.js';
import { users } from '../src/database/schema/users.js';
import { registerImportMultipart } from '../src/imports/import-multipart.js';
import type { ImportPreviewResult } from '../src/imports/import-preview.types.js';
import { TenantService } from '../src/tenants/tenant.service.js';
import { UserRepository } from '../src/users/user.repository.js';
import { getSeedDatabase } from './support/seed.js';

interface MultipartRequest {
  payload: string;
  contentType: string;
}

describe('Import preview HTTP integration', () => {
  let app: NestFastifyApplication | undefined;

  let database: Database | undefined;

  let tenantId = '';

  let adminAccessToken = '';
  let regularAccessToken = '';

  const adminPassword = 'ImportAdminPassword123!';

  const regularPassword = 'ImportRegularPassword123!';

  function getApp(): NestFastifyApplication {
    if (!app) {
      throw new Error('Test application has not been initialized');
    }

    return app;
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

  function buildMultipartWithoutFile(): MultipartRequest {
    const boundary = `----TrackRoster${randomUUID().replaceAll('-', '')}`;

    const payload = [
      `--${boundary}\r\n`,
      'Content-Disposition: form-data; name="note"\r\n',
      '\r\n',
      'no file',
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

    database = getSeedDatabase();

    const tenantService = application.get(TenantService);

    const userRepository = application.get(UserRepository);

    const passwordService = application.get(PasswordService);

    const grantRepository = application.get(UserAccessGrantRepository);

    const suffix = randomUUID().replaceAll('-', '').slice(0, 10);

    const tenant = await tenantService.create({
      name: `Import Preview Tenant ${suffix}`,

      slug: `import-preview-${suffix}`,
    });

    tenantId = tenant.id;

    const adminEmail = `import-admin-${suffix}@trackroster.test`;

    const regularEmail = `import-regular-${suffix}@trackroster.test`;

    const adminPasswordHash = await passwordService.hash(adminPassword);

    const regularPasswordHash = await passwordService.hash(regularPassword);

    const admin = await userRepository.create({
      tenantId: tenant.id,
      email: adminEmail,
      passwordHash: adminPasswordHash,
      status: 'active',
    });

    await userRepository.create({
      tenantId: tenant.id,
      email: regularEmail,
      passwordHash: regularPasswordHash,
      status: 'active',
    });

    await grantRepository.create({
      tenantId: tenant.id,
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

        await clearSessionEvidenceForUsers(database, eq(users.tenantId, tenantId));
        await database.delete(users).where(eq(users.tenantId, tenantId));

        await database.delete(tenants).where(eq(tenants.id, tenantId));
      }
    } finally {
      if (app) {
        await app.close();
      }
    }
  });

  it('rejects preview without authentication', async () => {
    const multipart = buildMultipartFile(
      'prospects.csv',
      ['name,country_code', 'Restaurant Paris,FR'].join('\n'),
    );

    const response = await getApp().inject({
      method: 'POST',
      url: '/imports/preview',

      headers: {
        'content-type': multipart.contentType,
      },

      payload: multipart.payload,
    });

    expect(response.statusCode).toBe(401);
  });

  it('rejects an authenticated non-admin', async () => {
    const multipart = buildMultipartFile(
      'prospects.csv',
      ['name,country_code', 'Restaurant Paris,FR'].join('\n'),
    );

    const response = await getApp().inject({
      method: 'POST',
      url: '/imports/preview',

      headers: {
        authorization: `Bearer ${regularAccessToken}`,

        'content-type': multipart.contentType,
      },

      payload: multipart.payload,
    });

    expect(response.statusCode).toBe(403);
  });

  it('previews and normalizes a valid CSV upload', async () => {
    const csv = [
      'external_reference,name,city,country_code,contact_name,contact_email',

      'REST-001,Restaurant Paris,Paris,fr,Marie Dupont,MARIE@EXAMPLE.COM',
    ].join('\n');

    const multipart = buildMultipartFile('prospects.csv', csv);

    const response = await getApp().inject({
      method: 'POST',
      url: '/imports/preview',

      headers: {
        authorization: `Bearer ${adminAccessToken}`,

        'content-type': multipart.contentType,
      },

      payload: multipart.payload,
    });

    expect(response.statusCode).toBe(200);

    const result = JSON.parse(response.payload) as ImportPreviewResult;

    expect(result.summary).toEqual({
      totalRows: 1,
      validRows: 1,
      warningRows: 0,
      invalidRows: 0,
    });

    expect(result.rows[0]).toMatchObject({
      rowNumber: 2,
      status: 'valid',

      establishment: {
        externalReference: 'REST-001',

        name: 'Restaurant Paris',

        city: 'Paris',

        countryCode: 'FR',
      },

      contact: {
        name: 'Marie Dupont',

        email: 'marie@example.com',
      },

      issues: [],
    });
  });

  it('reports invalid rows without failing the whole preview', async () => {
    const csv = ['name,country_code', 'Restaurant Paris,FR', ',FR', 'Restaurant Lyon,FRA'].join(
      '\n',
    );

    const multipart = buildMultipartFile('prospects.csv', csv);

    const response = await getApp().inject({
      method: 'POST',
      url: '/imports/preview',

      headers: {
        authorization: `Bearer ${adminAccessToken}`,

        'content-type': multipart.contentType,
      },

      payload: multipart.payload,
    });

    expect(response.statusCode).toBe(200);

    const result = JSON.parse(response.payload) as ImportPreviewResult;

    expect(result.summary).toEqual({
      totalRows: 3,
      validRows: 1,
      warningRows: 0,
      invalidRows: 2,
    });

    expect(result.rows[1]?.status).toBe('invalid');

    expect(result.rows[2]?.status).toBe('invalid');
  });

  it('reports duplicate rows as warnings', async () => {
    const csv = [
      'external_reference,name,country_code',

      'REST-001,Restaurant Paris,FR',

      'REST-001,Restaurant Paris Duplicate,FR',
    ].join('\n');

    const multipart = buildMultipartFile('prospects.csv', csv);

    const response = await getApp().inject({
      method: 'POST',
      url: '/imports/preview',

      headers: {
        authorization: `Bearer ${adminAccessToken}`,

        'content-type': multipart.contentType,
      },

      payload: multipart.payload,
    });

    expect(response.statusCode).toBe(200);

    const result = JSON.parse(response.payload) as ImportPreviewResult;

    expect(result.summary).toEqual({
      totalRows: 2,
      validRows: 1,
      warningRows: 1,
      invalidRows: 0,
    });

    expect(result.rows[1]?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'duplicate_in_file',

          severity: 'warning',
        }),
      ]),
    );
  });

  it('rejects a request that is not multipart', async () => {
    const response = await getApp().inject({
      method: 'POST',
      url: '/imports/preview',

      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },

      payload: {
        csv: 'name,country_code',
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('rejects multipart requests without a CSV file', async () => {
    const multipart = buildMultipartWithoutFile();

    const response = await getApp().inject({
      method: 'POST',
      url: '/imports/preview',

      headers: {
        authorization: `Bearer ${adminAccessToken}`,

        'content-type': multipart.contentType,
      },

      payload: multipart.payload,
    });

    expect(response.statusCode).toBe(400);
  });

  it('rejects files using the wrong multipart field name', async () => {
    const multipart = buildMultipartFile(
      'prospects.csv',
      ['name,country_code', 'Restaurant Paris,FR'].join('\n'),
      'upload',
    );

    const response = await getApp().inject({
      method: 'POST',
      url: '/imports/preview',

      headers: {
        authorization: `Bearer ${adminAccessToken}`,

        'content-type': multipart.contentType,
      },

      payload: multipart.payload,
    });

    expect(response.statusCode).toBe(400);
  });

  it('rejects non-CSV filenames', async () => {
    const multipart = buildMultipartFile(
      'prospects.txt',
      ['name,country_code', 'Restaurant Paris,FR'].join('\n'),
    );

    const response = await getApp().inject({
      method: 'POST',
      url: '/imports/preview',

      headers: {
        authorization: `Bearer ${adminAccessToken}`,

        'content-type': multipart.contentType,
      },

      payload: multipart.payload,
    });

    expect(response.statusCode).toBe(400);
  });

  it('rejects unsupported CSV columns', async () => {
    const multipart = buildMultipartFile(
      'prospects.csv',
      ['name,country_code,password', 'Restaurant Paris,FR,secret'].join('\n'),
    );

    const response = await getApp().inject({
      method: 'POST',
      url: '/imports/preview',

      headers: {
        authorization: `Bearer ${adminAccessToken}`,

        'content-type': multipart.contentType,
      },

      payload: multipart.payload,
    });

    expect(response.statusCode).toBe(400);
  });

  it('rejects CSV files above the maximum row count', async () => {
    const rows = [
      'name,country_code',

      ...Array.from(
        {
          length: 10_001,
        },

        (_, index) => `Restaurant ${index},FR`,
      ),
    ];

    const multipart = buildMultipartFile('prospects.csv', rows.join('\n'));

    const response = await getApp().inject({
      method: 'POST',
      url: '/imports/preview',

      headers: {
        authorization: `Bearer ${adminAccessToken}`,

        'content-type': multipart.contentType,
      },

      payload: multipart.payload,
    });

    expect(response.statusCode).toBe(400);
  });

  it('does not create establishments or contacts during preview', async () => {
    if (!database) {
      throw new Error('Database has not been initialized');
    }

    const establishmentsBefore = await database
      .select({
        id: establishments.id,
      })
      .from(establishments)
      .where(eq(establishments.tenantId, tenantId));

    const contactsBefore = await database
      .select({
        id: establishmentContacts.id,
      })
      .from(establishmentContacts)
      .where(eq(establishmentContacts.tenantId, tenantId));

    const csv = [
      'external_reference,name,country_code,contact_name,contact_email',

      'NO-WRITE-001,Preview Restaurant,FR,Marie Dupont,marie-preview@example.com',
    ].join('\n');

    const multipart = buildMultipartFile('prospects.csv', csv);

    const response = await getApp().inject({
      method: 'POST',
      url: '/imports/preview',

      headers: {
        authorization: `Bearer ${adminAccessToken}`,

        'content-type': multipart.contentType,
      },

      payload: multipart.payload,
    });

    expect(response.statusCode).toBe(200);

    const establishmentsAfter = await database
      .select({
        id: establishments.id,
      })
      .from(establishments)
      .where(eq(establishments.tenantId, tenantId));

    const contactsAfter = await database
      .select({
        id: establishmentContacts.id,
      })
      .from(establishmentContacts)
      .where(eq(establishmentContacts.tenantId, tenantId));

    expect(establishmentsAfter.length).toBe(establishmentsBefore.length);

    expect(contactsAfter.length).toBe(contactsBefore.length);
  });
});
