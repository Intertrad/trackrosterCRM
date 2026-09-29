import { randomUUID } from 'node:crypto';

import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { PasswordService } from '../src/auth/password.service.js';
import { auditEvents, tenants, users } from '../src/database/schema/index.js';
import type { Database } from '../src/database/database.types.js';
import { TenantService } from '../src/tenants/tenant.service.js';
import { UserRepository } from '../src/users/user.repository.js';
import { getSeedDatabase } from './support/seed.js';

describe('audit events schema integration', () => {
  let app: NestFastifyApplication | undefined;

  let database: Database | undefined;

  let tenantAId = '';

  let tenantBId = '';

  let userAId = '';

  let userBId = '';

  function getDatabase(): Database {
    if (!database) {
      throw new Error('Database has not been initialized');
    }

    return database;
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

    await application.init();

    app = application;

    database = getSeedDatabase();

    const tenantService = application.get(TenantService);

    const userRepository = application.get(UserRepository);

    const passwordService = application.get(PasswordService);

    const suffix = randomUUID().replaceAll('-', '').slice(0, 10);

    const tenantA = await tenantService.create({
      name: `Audit Tenant A ${suffix}`,

      slug: `audit-a-${suffix}`,
    });

    const tenantB = await tenantService.create({
      name: `Audit Tenant B ${suffix}`,

      slug: `audit-b-${suffix}`,
    });

    tenantAId = tenantA.id;

    tenantBId = tenantB.id;

    const passwordHash = await passwordService.hash('AuditSchema123!');

    const userA = await userRepository.create({
      tenantId: tenantAId,

      email: `audit-a-${suffix}@trackroster.test`,

      passwordHash,

      status: 'active',
    });

    const userB = await userRepository.create({
      tenantId: tenantBId,

      email: `audit-b-${suffix}@trackroster.test`,

      passwordHash,

      status: 'active',
    });

    userAId = userA.id;

    userBId = userB.id;
  });

  afterAll(async () => {
    try {
      if (database) {
        if (tenantAId) {
          await getDatabase().delete(auditEvents).where(eq(auditEvents.tenantId, tenantAId));

          await getDatabase().delete(users).where(eq(users.tenantId, tenantAId));

          await getDatabase().delete(tenants).where(eq(tenants.id, tenantAId));
        }

        if (tenantBId) {
          await getDatabase().delete(auditEvents).where(eq(auditEvents.tenantId, tenantBId));

          await getDatabase().delete(users).where(eq(users.tenantId, tenantBId));

          await getDatabase().delete(tenants).where(eq(tenants.id, tenantBId));
        }
      }
    } finally {
      if (app) {
        await app.close();
      }
    }
  });

  it('stores an authenticated user audit event with database defaults', async () => {
    const [event] = await getDatabase()
      .insert(auditEvents)
      .values({
        tenantId: tenantAId,

        actorType: 'user',

        actorUserId: userAId,

        action: 'campaign.updated',

        resourceType: 'campaign',

        resourceId: 'campaign:external:123',
      })
      .returning();

    expect(event).toBeDefined();

    expect(event).toMatchObject({
      tenantId: tenantAId,

      actorType: 'user',

      actorUserId: userAId,

      action: 'campaign.updated',

      resourceType: 'campaign',

      resourceId: 'campaign:external:123',

      metadata: {},
    });

    expect(event?.occurredAt).toBeInstanceOf(Date);
  });

  it('stores a system event without a user actor', async () => {
    const [event] = await getDatabase()
      .insert(auditEvents)
      .values({
        tenantId: tenantAId,

        actorType: 'system',

        actorUserId: null,

        action: 'system.test',

        resourceType: 'job',

        resourceId: 'scheduler:nightly',

        metadata: {
          source: 'integration-test',
        },
      })
      .returning();

    expect(event).toMatchObject({
      actorType: 'system',

      actorUserId: null,

      resourceId: 'scheduler:nightly',

      metadata: {
        source: 'integration-test',
      },
    });
  });

  it('rejects a user actor without actorUserId', async () => {
    await expect(
      getDatabase().insert(auditEvents).values({
        tenantId: tenantAId,

        actorType: 'user',

        actorUserId: null,

        action: 'campaign.updated',

        resourceType: 'campaign',

        resourceId: randomUUID(),
      }),
    ).rejects.toThrow();
  });

  it('rejects a system actor with actorUserId', async () => {
    await expect(
      getDatabase().insert(auditEvents).values({
        tenantId: tenantAId,

        actorType: 'system',

        actorUserId: userAId,

        action: 'system.test',

        resourceType: 'job',

        resourceId: 'scheduler:test',
      }),
    ).rejects.toThrow();
  });

  it('rejects an actor belonging to another tenant', async () => {
    await expect(
      getDatabase().insert(auditEvents).values({
        tenantId: tenantAId,

        actorType: 'user',

        /*
         * userB belongs to Tenant B.
         */
        actorUserId: userBId,

        action: 'campaign.updated',

        resourceType: 'campaign',

        resourceId: randomUUID(),
      }),
    ).rejects.toThrow();
  });

  it('rejects blank action and resource identifiers', async () => {
    await expect(
      getDatabase().insert(auditEvents).values({
        tenantId: tenantAId,

        actorType: 'user',

        actorUserId: userAId,

        action: '   ',

        resourceType: 'campaign',

        resourceId: randomUUID(),
      }),
    ).rejects.toThrow();

    await expect(
      getDatabase().insert(auditEvents).values({
        tenantId: tenantAId,

        actorType: 'user',

        actorUserId: userAId,

        action: 'campaign.updated',

        resourceType: '   ',

        resourceId: randomUUID(),
      }),
    ).rejects.toThrow();

    await expect(
      getDatabase().insert(auditEvents).values({
        tenantId: tenantAId,

        actorType: 'user',

        actorUserId: userAId,

        action: 'campaign.updated',

        resourceType: 'campaign',

        resourceId: '   ',
      }),
    ).rejects.toThrow();
  });

  it('keeps audit events tenant scoped when querying', async () => {
    const resourceId = randomUUID();

    await getDatabase()
      .insert(auditEvents)
      .values([
        {
          tenantId: tenantAId,

          actorType: 'user',

          actorUserId: userAId,

          action: 'campaign.updated',

          resourceType: 'campaign',

          resourceId,
        },

        {
          tenantId: tenantBId,

          actorType: 'user',

          actorUserId: userBId,

          action: 'campaign.updated',

          resourceType: 'campaign',

          resourceId,
        },
      ]);

    const tenantAEvents = await getDatabase()
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.tenantId, tenantAId),

          eq(auditEvents.resourceId, resourceId),
        ),
      );

    expect(tenantAEvents).toHaveLength(1);

    expect(tenantAEvents[0]).toMatchObject({
      tenantId: tenantAId,

      actorUserId: userAId,

      resourceId,
    });

    expect(tenantAEvents.some((event) => event.tenantId === tenantBId)).toBe(false);
  });
});
