import { randomUUID } from 'node:crypto';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { and, eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { AuditService } from '../src/audit/audit.service.js';
import type { AuthenticationTokens } from '../src/auth/auth.types.js';
import { PasswordService } from '../src/auth/password.service.js';
import { UserAccessGrantRepository } from '../src/authorization/user-access-grant.repository.js';
import { DATABASE } from '../src/database/database.constants.js';
import {
  auditEvents,
  campaigns,
  organizations,
  tenants,
  users,
} from '../src/database/schema/index.js';
import type { Database } from '../src/database/database.types.js';
import { TenantService } from '../src/tenants/tenant.service.js';
import { UserRepository } from '../src/users/user.repository.js';

describe('audit mutation atomicity integration', () => {
  let app: NestFastifyApplication | undefined;

  let database: Database | undefined;

  let auditService: AuditService | undefined;

  let tenantId = '';

  let organizationId = '';

  let adminUserId = '';

  let adminAccessToken = '';

  const password = 'AuditAtomicity123!';

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

  function getAuditService(): AuditService {
    if (!auditService) {
      throw new Error('AuditService has not been initialized');
    }

    return auditService;
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

  async function findCampaignByName(name: string) {
    const [campaign] = await getDatabase()
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.tenantId, tenantId), eq(campaigns.name, name)))
      .limit(1);

    return campaign ?? null;
  }

  async function findCampaignCreatedAudit(campaignId: string) {
    const [event] = await getDatabase()
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.tenantId, tenantId),
          eq(auditEvents.action, 'campaign.created'),
          eq(auditEvents.resourceType, 'campaign'),
          eq(auditEvents.resourceId, campaignId),
        ),
      )
      .limit(1);

    return event ?? null;
  }

  async function countCampaignCreatedAudits(): Promise<number> {
    const events = await getDatabase()
      .select({
        id: auditEvents.id,
      })
      .from(auditEvents)
      .where(and(eq(auditEvents.tenantId, tenantId), eq(auditEvents.action, 'campaign.created')));

    return events.length;
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

    auditService = application.get(AuditService);

    const tenantService = application.get(TenantService);

    const userRepository = application.get(UserRepository);

    const passwordService = application.get(PasswordService);

    const grantRepository = application.get(UserAccessGrantRepository);

    const suffix = randomUUID().replaceAll('-', '').slice(0, 10);

    const tenant = await tenantService.create({
      name: `Audit Atomicity Tenant ${suffix}`,

      slug: `audit-atomicity-${suffix}`,
    });

    tenantId = tenant.id;

    const [organization] = await getDatabase()
      .insert(organizations)
      .values({
        tenantId,

        name: 'Audit Atomicity Organization',

        slug: `audit-atomicity-org-${suffix}`,

        status: 'active',
      })
      .returning();

    if (!organization) {
      throw new Error('Failed to create organization fixture');
    }

    organizationId = organization.id;

    const adminEmail = `audit-atomicity-admin-${suffix}` + '@trackroster.test';

    const admin = await userRepository.create({
      tenantId,

      email: adminEmail,

      passwordHash: await passwordService.hash(password),

      status: 'active',
    });

    adminUserId = admin.id;

    await grantRepository.create({
      tenantId,

      userId: adminUserId,

      role: 'client_admin',

      scopeType: 'tenant',
    });

    adminAccessToken = (await login(adminEmail)).accessToken;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    try {
      if (database && tenantId) {
        /*
         * Audit rows reference tenant/users,
         * so remove them before fixture users.
         */
        await getDatabase().delete(auditEvents).where(eq(auditEvents.tenantId, tenantId));

        await getDatabase().delete(campaigns).where(eq(campaigns.tenantId, tenantId));

        await getDatabase().delete(users).where(eq(users.tenantId, tenantId));

        await getDatabase().delete(organizations).where(eq(organizations.tenantId, tenantId));

        await getDatabase().delete(tenants).where(eq(tenants.id, tenantId));
      }
    } finally {
      if (app) {
        await app.close();
      }
    }
  });

  it('commits the campaign and audit event together on success', async () => {
    const campaignName = 'Atomicity Successful Campaign';

    const response = await getApp().inject({
      method: 'POST',

      url: '/campaigns',

      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },

      payload: {
        organizationId,

        name: campaignName,
      },
    });

    expect(response.statusCode).toBe(201);

    const body = JSON.parse(response.payload) as {
      id: string;
    };

    const persistedCampaign = await findCampaignByName(campaignName);

    expect(persistedCampaign).not.toBeNull();

    expect(persistedCampaign?.id).toBe(body.id);

    const auditEvent = await findCampaignCreatedAudit(body.id);

    expect(auditEvent).not.toBeNull();

    expect(auditEvent).toMatchObject({
      tenantId,

      actorType: 'user',

      actorUserId: adminUserId,

      action: 'campaign.created',

      resourceType: 'campaign',

      resourceId: body.id,

      metadata: {
        organizationId,

        status: 'draft',
      },
    });
  });

  it('does not persist an audit event when campaign validation fails', async () => {
    const beforeCount = await countCampaignCreatedAudits();

    const campaignName = 'Atomicity Invalid Campaign';

    const response = await getApp().inject({
      method: 'POST',

      url: '/campaigns',

      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },

      payload: {
        organizationId,

        name: campaignName,

        startsAt: '2026-12-31T00:00:00.000Z',

        endsAt: '2026-10-01T00:00:00.000Z',
      },
    });

    expect(response.statusCode).toBe(400);

    const persistedCampaign = await findCampaignByName(campaignName);

    expect(persistedCampaign).toBeNull();

    const afterCount = await countCampaignCreatedAudits();

    expect(afterCount).toBe(beforeCount);
  });

  it('rolls back the campaign when audit persistence fails', async () => {
    const beforeCount = await countCampaignCreatedAudits();

    const campaignName = 'Atomicity Rollback Campaign';

    const recordSpy = vi
      .spyOn(getAuditService(), 'record')
      .mockRejectedValueOnce(new Error('forced audit persistence failure'));

    const response = await getApp().inject({
      method: 'POST',

      url: '/campaigns',

      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },

      payload: {
        organizationId,

        name: campaignName,
      },
    });

    /*
     * The exact 5xx body is not part of
     * the atomicity contract.
     */
    expect(response.statusCode).toBeGreaterThanOrEqual(500);

    expect(recordSpy).toHaveBeenCalledTimes(1);

    /*
     * Most important assertion:
     *
     * CampaignRepository.create() executed
     * before AuditService.record(), but the
     * transaction callback rejected.
     *
     * Real PostgreSQL must therefore have
     * rolled the campaign INSERT back.
     */
    const persistedCampaign = await findCampaignByName(campaignName);

    expect(persistedCampaign).toBeNull();

    const afterCount = await countCampaignCreatedAudits();

    expect(afterCount).toBe(beforeCount);
  });
});
