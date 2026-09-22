import { randomUUID } from 'node:crypto';

import { ValidationPipe } from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { CampaignProspectAssignmentRepository } from '../src/assignments/campaign-prospect-assignment.repository.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import type { AuthenticationTokens } from '../src/auth/auth.types.js';
import { PasswordService } from '../src/auth/password.service.js';
import { UserAccessGrantRepository } from '../src/authorization/user-access-grant.repository.js';
import { DATABASE } from '../src/database/database.constants.js';
import type { Database } from '../src/database/database.types.js';
import { campaignProspectAssignments } from '../src/database/schema/campaign-prospect-assignments.js';
import { campaignProspects } from '../src/database/schema/campaign-prospects.js';
import { campaigns } from '../src/database/schema/campaigns.js';
import { establishments } from '../src/database/schema/establishments.js';
import { organizations } from '../src/database/schema/organizations.js';
import { teams } from '../src/database/schema/teams.js';
import { tenants } from '../src/database/schema/tenants.js';
import { users } from '../src/database/schema/users.js';
import { TenantService } from '../src/tenants/tenant.service.js';
import { UserRepository } from '../src/users/user.repository.js';
import { auditEvents } from '../src/database/schema/audit-events.js';
import { idempotencyRecords } from '../src/database/schema/idempotency-records.js';
import { userAccessGrants } from '../src/database/schema/user-access-grants.js';

describe('Campaign prospect assignment HTTP integration', () => {
  let app: NestFastifyApplication | undefined;

  let database: Database | undefined;

  let tenantAId = '';
  let tenantBId = '';

  let organizationAId = '';

  let teamAId = '';
  let teamBId = '';

  let campaignId = '';
  let prospectId = '';

  let prospectorAId = '';
  let prospectorBId = '';

  let adminAccessToken = '';
  let regularAccessToken = '';

  const adminPassword = 'AssignmentAdmin123!';

  const regularPassword = 'AssignmentRegular123!';

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

    database = application.get<Database>(DATABASE);

    const tenantService = application.get(TenantService);

    const userRepository = application.get(UserRepository);

    const passwordService = application.get(PasswordService);

    const grantRepository = application.get(UserAccessGrantRepository);

    const suffix = randomUUID().replaceAll('-', '').slice(0, 10);

    const tenantA = await tenantService.create({
      name: `Assignment Tenant A ${suffix}`,

      slug: `assignment-a-${suffix}`,
    });

    const tenantB = await tenantService.create({
      name: `Assignment Tenant B ${suffix}`,

      slug: `assignment-b-${suffix}`,
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

    organizationAId = organizationA.id;

    const [teamA] = await getDatabase()
      .insert(teams)
      .values({
        tenantId: tenantAId,

        organizationId: organizationA.id,

        name: 'Paris Team',

        slug: `paris-${suffix}`,

        status: 'active',
      })
      .returning();

    const [teamB] = await getDatabase()
      .insert(teams)
      .values({
        tenantId: tenantBId,

        organizationId: organizationB.id,

        name: 'Brussels Team',

        slug: `brussels-${suffix}`,

        status: 'active',
      })
      .returning();

    if (!teamA || !teamB) {
      throw new Error('Failed to create teams');
    }

    teamAId = teamA.id;

    teamBId = teamB.id;

    const [campaign] = await getDatabase()
      .insert(campaigns)
      .values({
        tenantId: tenantAId,

        organizationId: organizationA.id,

        name: 'Paris Prospecting',

        status: 'active',
      })
      .returning();

    const [establishment] = await getDatabase()
      .insert(establishments)
      .values({
        tenantId: tenantAId,

        name: 'Paris Restaurant',

        normalizedName: 'paris restaurant',

        city: 'Paris',

        countryCode: 'FR',

        source: 'manual',

        status: 'active',
      })
      .returning();

    if (!campaign || !establishment) {
      throw new Error('Failed to create campaign fixtures');
    }

    campaignId = campaign.id;

    const [prospect] = await getDatabase()
      .insert(campaignProspects)
      .values({
        tenantId: tenantAId,

        campaignId: campaign.id,

        establishmentId: establishment.id,

        status: 'active',
      })
      .returning();

    if (!prospect) {
      throw new Error('Failed to create campaign prospect');
    }

    prospectId = prospect.id;

    const adminEmail = `assignment-admin-${suffix}@trackroster.test`;

    const regularEmail = `assignment-regular-${suffix}@trackroster.test`;

    const prospectorAEmail = `prospector-a-${suffix}@trackroster.test`;

    const prospectorBEmail = `prospector-b-${suffix}@trackroster.test`;

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

    const prospectorA = await userRepository.create({
      tenantId: tenantAId,

      email: prospectorAEmail,

      passwordHash: await passwordService.hash('ProspectorA123!'),

      status: 'active',
    });

    const prospectorB = await userRepository.create({
      tenantId: tenantAId,

      email: prospectorBEmail,

      passwordHash: await passwordService.hash('ProspectorB123!'),

      status: 'active',
    });

    prospectorAId = prospectorA.id;

    prospectorBId = prospectorB.id;

    await grantRepository.create({
      tenantId: tenantAId,

      userId: admin.id,

      role: 'client_admin',

      scopeType: 'tenant',
    });

    await grantRepository.create({
      tenantId: tenantAId,

      userId: prospectorA.id,

      role: 'prospector',

      scopeType: 'team',

      organizationId: organizationA.id,

      teamId: teamA.id,
    });

    /*
     * Prospector B intentionally has no
     * team grant at first.
     */

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

          await database
            .delete(campaignProspectAssignments)
            .where(eq(campaignProspectAssignments.tenantId, tenantId));

          await database.delete(campaignProspects).where(eq(campaignProspects.tenantId, tenantId));

          await database.delete(campaigns).where(eq(campaigns.tenantId, tenantId));

          await database.delete(establishments).where(eq(establishments.tenantId, tenantId));

          await database.delete(auditEvents).where(eq(auditEvents.tenantId, tenantId));

          await database
            .delete(idempotencyRecords)
            .where(eq(idempotencyRecords.tenantId, tenantId));

          await database.delete(userAccessGrants).where(eq(userAccessGrants.tenantId, tenantId));

          await database.delete(users).where(eq(users.tenantId, tenantId));

          await database.delete(teams).where(eq(teams.tenantId, tenantId));

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

  it('rejects assignment without authentication', async () => {
    const response = await getApp().inject({
      method: 'POST',

      url: `/campaigns/${campaignId}/prospects/${prospectId}/assignment`,

      payload: {
        teamId: teamAId,
      },
    });

    expect(response.statusCode).toBe(401);
  });

  it('rejects assignment for a user without assignment authority', async () => {
    const response = await getApp().inject({
      method: 'POST',

      url: `/campaigns/${campaignId}/prospects/${prospectId}/assignment`,

      headers: {
        authorization: `Bearer ${regularAccessToken}`,
        'idempotency-key': randomUUID(),
      },

      payload: {
        teamId: teamAId,
      },
    });

    expect(response.statusCode).toBe(403);
  });

  it('rejects team from another tenant', async () => {
    const response = await getApp().inject({
      method: 'POST',

      url: `/campaigns/${campaignId}/prospects/${prospectId}/assignment`,

      headers: {
        authorization: `Bearer ${adminAccessToken}`,
        'idempotency-key': randomUUID(),
      },

      payload: {
        teamId: teamBId,
      },
    });

    expect(response.statusCode).toBe(404);
  });

  it('rejects user without exact-team prospector grant', async () => {
    const response = await getApp().inject({
      method: 'POST',

      url: `/campaigns/${campaignId}/prospects/${prospectId}/assignment`,

      headers: {
        authorization: `Bearer ${adminAccessToken}`,
        'idempotency-key': randomUUID(),
      },

      payload: {
        teamId: teamAId,

        assignedUserId: prospectorBId,
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('creates an assignment to an exact-team prospector', async () => {
    const response = await getApp().inject({
      method: 'POST',

      url: `/campaigns/${campaignId}/prospects/${prospectId}/assignment`,

      headers: {
        authorization: `Bearer ${adminAccessToken}`,
        'idempotency-key': randomUUID(),
      },

      payload: {
        teamId: teamAId,

        assignedUserId: prospectorAId,
      },
    });

    expect(response.statusCode).toBe(201);

    const body = JSON.parse(response.payload) as {
      tenantId: string;
      campaignId: string;
      campaignProspectId: string;
      organizationId: string;
      teamId: string;
      assignedUserId: string | null;
      endedAt: string | null;
    };

    expect(body).toMatchObject({
      tenantId: tenantAId,

      campaignId,

      campaignProspectId: prospectId,

      organizationId: organizationAId,

      teamId: teamAId,

      assignedUserId: prospectorAId,

      endedAt: null,
    });
  });

  it('rejects a second active assignment', async () => {
    const response = await getApp().inject({
      method: 'POST',

      url: `/campaigns/${campaignId}/prospects/${prospectId}/assignment`,

      headers: {
        authorization: `Bearer ${adminAccessToken}`,
        'idempotency-key': randomUUID(),
      },

      payload: {
        teamId: teamAId,
      },
    });

    expect(response.statusCode).toBe(409);
  });

  it('returns the current assignment', async () => {
    const response = await getApp().inject({
      method: 'GET',

      url: `/campaigns/${campaignId}/prospects/${prospectId}/assignment`,

      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.payload) as {
      assignedUserId: string;
      endedAt: null;
    };

    expect(body.assignedUserId).toBe(prospectorAId);

    expect(body.endedAt).toBeNull();
  });

  it('reassigns transactionally and preserves history', async () => {
    const grantRepository = getApp().get(UserAccessGrantRepository);

    await grantRepository.create({
      tenantId: tenantAId,

      userId: prospectorBId,

      role: 'prospector',

      scopeType: 'team',

      organizationId: organizationAId,

      teamId: teamAId,
    });

    const response = await getApp().inject({
      method: 'PUT',

      url: `/campaigns/${campaignId}/prospects/${prospectId}/assignment`,
      headers: {
        authorization: `Bearer ${adminAccessToken}`,
        'idempotency-key': randomUUID(),
      },

      payload: {
        teamId: teamAId,

        assignedUserId: prospectorBId,
      },
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.payload) as {
      assignedUserId: string | null;

      endedAt: string | null;
    };

    expect(body.assignedUserId).toBe(prospectorBId);

    expect(body.endedAt).toBeNull();

    const history = await getDatabase()
      .select()
      .from(campaignProspectAssignments)
      .where(
        and(
          eq(campaignProspectAssignments.tenantId, tenantAId),
          eq(campaignProspectAssignments.campaignProspectId, prospectId),
        ),
      );

    expect(history).toHaveLength(2);

    expect(history.filter((assignment) => assignment.endedAt === null)).toHaveLength(1);
  });

  it('returns complete assignment history', async () => {
    const response = await getApp().inject({
      method: 'GET',

      url: `/campaigns/${campaignId}/prospects/${prospectId}/assignment-history`,

      headers: {
        authorization: `Bearer ${adminAccessToken}`,
      },
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.payload) as Array<{
      assignedUserId: string | null;

      endedAt: string | null;
    }>;

    expect(body).toHaveLength(2);

    expect(body.filter((assignment) => assignment.endedAt === null)).toHaveLength(1);
  });

  it('unassigns without deleting assignment history', async () => {
    const response = await getApp().inject({
      method: 'DELETE',

      url: `/campaigns/${campaignId}/prospects/${prospectId}/assignment`,

      headers: {
        authorization: `Bearer ${adminAccessToken}`,
        'idempotency-key': randomUUID(),
      },
    });

    expect(response.statusCode).toBe(200);

    const current = await getDatabase()
      .select()
      .from(campaignProspectAssignments)
      .where(
        and(
          eq(campaignProspectAssignments.tenantId, tenantAId),
          eq(campaignProspectAssignments.campaignProspectId, prospectId),
          isNull(campaignProspectAssignments.endedAt),
        ),
      );

    expect(current).toHaveLength(0);

    const history = await getDatabase()
      .select()
      .from(campaignProspectAssignments)
      .where(
        and(
          eq(campaignProspectAssignments.tenantId, tenantAId),
          eq(campaignProspectAssignments.campaignProspectId, prospectId),
        ),
      );

    expect(history).toHaveLength(2);
  });

  it('allows only one concurrent active assignment', async () => {
    /*
     * Ensure the prospect starts unassigned.
     */
    await getDatabase()
      .update(campaignProspectAssignments)
      .set({
        endedAt: new Date(),
      })
      .where(
        and(
          eq(campaignProspectAssignments.tenantId, tenantAId),
          eq(campaignProspectAssignments.campaignProspectId, prospectId),
          isNull(campaignProspectAssignments.endedAt),
        ),
      );

    const request = () =>
      getApp().inject({
        method: 'POST',

        url: `/campaigns/${campaignId}/prospects/${prospectId}/assignment`,
        headers: {
          authorization: `Bearer ${adminAccessToken}`,
          'idempotency-key': randomUUID(),
        },

        payload: {
          teamId: teamAId,

          assignedUserId: prospectorAId,
        },
      });

    const [first, second] = await Promise.all([request(), request()]);

    const statusCodes = [first.statusCode, second.statusCode].sort();

    expect(statusCodes).toEqual([201, 409]);

    const current = await getDatabase()
      .select()
      .from(campaignProspectAssignments)
      .where(
        and(
          eq(campaignProspectAssignments.tenantId, tenantAId),
          eq(campaignProspectAssignments.campaignProspectId, prospectId),
          isNull(campaignProspectAssignments.endedAt),
        ),
      );

    expect(current).toHaveLength(1);
  });

  it('prevents concurrent assignment invalidation while the current row is locked', async () => {
    const assignmentRepository = getApp().get(CampaignProspectAssignmentRepository);

    const suffix = randomUUID().replaceAll('-', '').slice(0, 10);

    const [establishment] = await getDatabase()
      .insert(establishments)
      .values({
        tenantId: tenantAId,

        name: `Lock Test Establishment ${suffix}`,

        normalizedName: `lock test establishment ${suffix}`,

        city: 'Paris',

        countryCode: 'FR',

        source: 'manual',

        status: 'active',
      })
      .returning();

    if (!establishment) {
      throw new Error('Failed to create lock-test establishment');
    }

    const [prospect] = await getDatabase()
      .insert(campaignProspects)
      .values({
        tenantId: tenantAId,

        campaignId,

        establishmentId: establishment.id,

        status: 'active',
      })
      .returning();

    if (!prospect) {
      throw new Error('Failed to create lock-test campaign prospect');
    }

    const [assignment] = await getDatabase()
      .insert(campaignProspectAssignments)
      .values({
        tenantId: tenantAId,

        campaignId,

        campaignProspectId: prospect.id,

        organizationId: organizationAId,

        teamId: teamAId,

        assignedUserId: null,
      })
      .returning();

    if (!assignment) {
      throw new Error('Failed to create lock-test assignment');
    }

    let releaseLock!: () => void;

    let markLockAcquired!: () => void;

    let rejectLockAcquired!: (error: unknown) => void;

    const holdLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    const lockAcquired = new Promise<void>((resolve, reject) => {
      markLockAcquired = resolve;

      rejectLockAcquired = reject;
    });

    /*
     * Transaction A acquires the exact row lock used
     * by manager override / activity sensitive writes.
     *
     * It deliberately stays open until the test
     * releases holdLock.
     */
    const lockingTransaction = getDatabase().transaction(async (transaction) => {
      try {
        const lockedAssignment = await assignmentRepository.findCurrentForUpdate(
          tenantAId,

          campaignId,

          prospect.id,

          transaction,
        );

        expect(lockedAssignment).toBeDefined();

        expect(lockedAssignment?.id).toBe(assignment.id);

        markLockAcquired();

        await holdLock;
      } catch (error) {
        rejectLockAcquired(error);

        throw error;
      }
    });

    try {
      /*
       * Never race Transaction B against lock acquisition.
       * The explicit promise means B starts only after
       * SELECT ... FOR UPDATE has completed.
       */
      await lockAcquired;

      let concurrentError: unknown;

      try {
        await getDatabase().transaction(async (transaction) => {
          /*
           * Do not use arbitrary sleeps to infer that
           * blocking happened.
           *
           * PostgreSQL itself terminates this statement
           * if it cannot acquire the row lock.
           */
          await transaction.execute(sql`SET LOCAL lock_timeout = '250ms'`);

          await transaction
            .update(campaignProspectAssignments)
            .set({
              endedAt: new Date(),
            })
            .where(eq(campaignProspectAssignments.id, assignment.id));
        });
      } catch (error) {
        concurrentError = error;
      }

      expect(concurrentError).toBeDefined();

      /*
       * Drizzle/node-postgres may wrap the underlying
       * PostgreSQL error, so walk the cause chain.
       */
      function findPostgresErrorCode(error: unknown): string | undefined {
        const seen = new Set<object>();

        let current: unknown = error;

        while (typeof current === 'object' && current !== null && !seen.has(current)) {
          seen.add(current);

          const candidate = current as {
            code?: unknown;

            cause?: unknown;
          };

          if (typeof candidate.code === 'string') {
            return candidate.code;
          }

          current = candidate.cause;
        }

        return undefined;
      }

      /*
       * PostgreSQL 55P03 = lock_not_available.
       *
       * lock_timeout reports this when Transaction B
       * cannot obtain the row lock held by Transaction A.
       */
      expect(findPostgresErrorCode(concurrentError)).toBe('55P03');

      /*
       * The concurrent mutation never changed the row.
       */
      const [whileLocked] = await getDatabase()
        .select()
        .from(campaignProspectAssignments)
        .where(eq(campaignProspectAssignments.id, assignment.id))
        .limit(1);

      expect(whileLocked).toBeDefined();

      expect(whileLocked?.endedAt).toBeNull();
    } finally {
      /*
       * Always release Transaction A, even when an
       * assertion fails, so the suite cannot deadlock.
       */
      releaseLock();

      await lockingTransaction;
    }

    /*
     * Once the protecting transaction commits, the
     * exact same row may be mutated normally.
     */
    const [endedAssignment] = await getDatabase()
      .update(campaignProspectAssignments)
      .set({
        endedAt: new Date(),
      })
      .where(eq(campaignProspectAssignments.id, assignment.id))
      .returning();

    expect(endedAssignment).toBeDefined();

    expect(endedAssignment?.endedAt).not.toBeNull();

    /*
     * Remove the isolated fixture immediately so this
     * concurrency proof cannot affect other tests.
     */
    await getDatabase()
      .delete(campaignProspectAssignments)
      .where(eq(campaignProspectAssignments.id, assignment.id));

    await getDatabase().delete(campaignProspects).where(eq(campaignProspects.id, prospect.id));

    await getDatabase().delete(establishments).where(eq(establishments.id, establishment.id));
  });
});
