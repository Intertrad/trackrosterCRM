import { randomUUID } from 'node:crypto';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import type { AuthenticationTokens } from '../src/auth/auth.types.js';
import { PasswordService } from '../src/auth/password.service.js';
import { UserAccessGrantRepository } from '../src/authorization/user-access-grant.repository.js';
import { DATABASE } from '../src/database/database.constants.js';
import {
  auditEvents,
  campaignProspectAssignments,
  campaignProspects,
  campaigns,
  establishments,
  idempotencyRecords,
  organizations,
  prospectActivities,
  teams,
  tenants,
  userAccessGrants,
  users,
} from '../src/database/schema/index.js';
import type { Database } from '../src/database/database.types.js';
import { RedisService } from '../src/redis/redis.service.js';
import { ReservationRepository } from '../src/reservations/reservation.repository.js';
import { TenantService } from '../src/tenants/tenant.service.js';
import { UserRepository } from '../src/users/user.repository.js';

describe('HTTP idempotency integration', () => {
  let app: NestFastifyApplication | undefined;
  let database: Database | undefined;
  let redisService: RedisService | undefined;
  let reservationRepository: ReservationRepository | undefined;

  let tenantId = '';
  let organizationId = '';
  let teamId = '';
  let campaignId = '';

  let establishmentAId = '';
  let establishmentBId = '';

  let prospectAId = '';
  let prospectBId = '';

  let prospectorAId = '';
  let prospectorBId = '';

  let prospectorAToken = '';
  let prospectorBToken = '';

  const password = 'IdempotencyHttp123!';

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

  function getRedis(): RedisService {
    if (!redisService) {
      throw new Error('Redis has not been initialized');
    }

    return redisService;
  }

  function getReservationRepository(): ReservationRepository {
    if (!reservationRepository) {
      throw new Error('Reservation repository has not been initialized');
    }

    return reservationRepository;
  }

  function reservationUrl(prospectId: string): string {
    return `/campaigns/${campaignId}/prospects/${prospectId}/reservation`;
  }

  function activityUrl(prospectId: string): string {
    return `/campaigns/${campaignId}/prospects/${prospectId}/activities`;
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

  async function clearReservations(): Promise<void> {
    if (
      !redisService ||
      !tenantId ||
      !organizationId ||
      !campaignId ||
      !prospectAId ||
      !prospectBId ||
      !establishmentAId ||
      !establishmentBId
    ) {
      return;
    }

    const repository = getReservationRepository();

    const keys = [
      repository.buildKey(tenantId, campaignId, prospectAId),
      repository.buildKey(tenantId, campaignId, prospectBId),

      /*
       * Keep clearing the legacy canonical-establishment keys
       * as well as the organization-scoped collision keys.
       */
      repository.buildCollisionKey(tenantId, establishmentAId),
      repository.buildCollisionKey(tenantId, establishmentBId),

      repository.buildOrganizationCollisionKey(tenantId, organizationId, establishmentAId),

      repository.buildOrganizationCollisionKey(tenantId, organizationId, establishmentBId),
    ];

    await getRedis().getClient().del(keys);
  }

  async function clearMutableTestState(): Promise<void> {
    await clearReservations();

    if (!database || !tenantId) {
      return;
    }

    await getDatabase().delete(idempotencyRecords).where(eq(idempotencyRecords.tenantId, tenantId));

    await getDatabase().delete(prospectActivities).where(eq(prospectActivities.tenantId, tenantId));

    await getDatabase().delete(auditEvents).where(eq(auditEvents.tenantId, tenantId));
  }

  async function acquireReservation(token: string, prospectId: string): Promise<void> {
    const response = await getApp().inject({
      method: 'POST',
      url: reservationUrl(prospectId),
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(201);
  }

  async function findActivities() {
    return getDatabase()
      .select()
      .from(prospectActivities)
      .where(eq(prospectActivities.tenantId, tenantId));
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
    redisService = application.get(RedisService);
    reservationRepository = application.get(ReservationRepository);

    const tenantService = application.get(TenantService);
    const userRepository = application.get(UserRepository);
    const passwordService = application.get(PasswordService);
    const grantRepository = application.get(UserAccessGrantRepository);

    const suffix = randomUUID().replaceAll('-', '').slice(0, 10);

    const tenant = await tenantService.create({
      name: `Idempotency HTTP Tenant ${suffix}`,
      slug: `idempotency-http-${suffix}`,
    });

    tenantId = tenant.id;

    const [organization] = await getDatabase()
      .insert(organizations)
      .values({
        tenantId,
        name: 'Idempotency HTTP Organization',
        slug: `idempotency-http-org-${suffix}`,
        status: 'active',
      })
      .returning();

    if (!organization) {
      throw new Error('Failed to create organization fixture');
    }

    organizationId = organization.id;

    const [team] = await getDatabase()
      .insert(teams)
      .values({
        tenantId,
        organizationId,
        name: 'Idempotency HTTP Team',
        slug: `idempotency-http-team-${suffix}`,
        status: 'active',
      })
      .returning();

    if (!team) {
      throw new Error('Failed to create team fixture');
    }

    teamId = team.id;

    const [campaign] = await getDatabase()
      .insert(campaigns)
      .values({
        tenantId,
        organizationId,
        name: 'Idempotency HTTP Campaign',
        status: 'active',
      })
      .returning();

    if (!campaign) {
      throw new Error('Failed to create campaign fixture');
    }

    campaignId = campaign.id;

    const [establishmentA] = await getDatabase()
      .insert(establishments)
      .values({
        tenantId,
        name: 'Idempotency Restaurant A',
        normalizedName: 'idempotency restaurant a',
        city: 'Paris',
        countryCode: 'FR',
        source: 'manual',
        status: 'active',
      })
      .returning();

    const [establishmentB] = await getDatabase()
      .insert(establishments)
      .values({
        tenantId,
        name: 'Idempotency Restaurant B',
        normalizedName: 'idempotency restaurant b',
        city: 'Paris',
        countryCode: 'FR',
        source: 'manual',
        status: 'active',
      })
      .returning();

    if (!establishmentA || !establishmentB) {
      throw new Error('Failed to create establishment fixtures');
    }

    establishmentAId = establishmentA.id;
    establishmentBId = establishmentB.id;

    const [prospectA] = await getDatabase()
      .insert(campaignProspects)
      .values({
        tenantId,
        campaignId,
        establishmentId: establishmentAId,
        status: 'active',
      })
      .returning();

    const [prospectB] = await getDatabase()
      .insert(campaignProspects)
      .values({
        tenantId,
        campaignId,
        establishmentId: establishmentBId,
        status: 'active',
      })
      .returning();

    if (!prospectA || !prospectB) {
      throw new Error('Failed to create campaign prospect fixtures');
    }

    prospectAId = prospectA.id;
    prospectBId = prospectB.id;

    const [assignmentA] = await getDatabase()
      .insert(campaignProspectAssignments)
      .values({
        tenantId,
        campaignId,
        campaignProspectId: prospectAId,
        organizationId,
        teamId,
        assignedUserId: null,
      })
      .returning();

    const [assignmentB] = await getDatabase()
      .insert(campaignProspectAssignments)
      .values({
        tenantId,
        campaignId,
        campaignProspectId: prospectBId,
        organizationId,
        teamId,
        assignedUserId: null,
      })
      .returning();

    if (!assignmentA || !assignmentB) {
      throw new Error('Failed to create assignment fixtures');
    }

    const prospectorAEmail = `idempotency-http-a-${suffix}@trackroster.test`;
    const prospectorBEmail = `idempotency-http-b-${suffix}@trackroster.test`;

    const passwordHash = await passwordService.hash(password);

    const prospectorA = await userRepository.create({
      tenantId,
      email: prospectorAEmail,
      passwordHash,
      status: 'active',
    });

    const prospectorB = await userRepository.create({
      tenantId,
      email: prospectorBEmail,
      passwordHash,
      status: 'active',
    });

    prospectorAId = prospectorA.id;
    prospectorBId = prospectorB.id;

    for (const userId of [prospectorAId, prospectorBId]) {
      await grantRepository.create({
        tenantId,
        userId,
        role: 'prospector',
        scopeType: 'team',
        organizationId,
        teamId,
      });
    }

    prospectorAToken = (await login(prospectorAEmail)).accessToken;
    prospectorBToken = (await login(prospectorBEmail)).accessToken;

    await clearMutableTestState();
  });

  beforeEach(async () => {
    await clearMutableTestState();
  });

  afterAll(async () => {
    try {
      await clearReservations();

      if (database && tenantId) {
        await database.delete(idempotencyRecords).where(eq(idempotencyRecords.tenantId, tenantId));

        await database.delete(auditEvents).where(eq(auditEvents.tenantId, tenantId));

        await database.delete(prospectActivities).where(eq(prospectActivities.tenantId, tenantId));

        await database
          .delete(campaignProspectAssignments)
          .where(eq(campaignProspectAssignments.tenantId, tenantId));

        await database.delete(campaignProspects).where(eq(campaignProspects.tenantId, tenantId));

        await database.delete(campaigns).where(eq(campaigns.tenantId, tenantId));

        await database.delete(establishments).where(eq(establishments.tenantId, tenantId));

        await database.delete(userAccessGrants).where(eq(userAccessGrants.tenantId, tenantId));

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

  it('requires Idempotency-Key before executing a protected activity write', async () => {
    await acquireReservation(prospectorAToken, prospectAId);

    const response = await getApp().inject({
      method: 'POST',
      url: activityUrl(prospectAId),
      headers: {
        authorization: `Bearer ${prospectorAToken}`,
      },
      payload: {
        type: 'call',
      },
    });

    expect(response.statusCode).toBe(400);

    expect(JSON.parse(response.payload)).toMatchObject({
      statusCode: 400,
      code: 'IDEMPOTENCY_KEY_REQUIRED',
    });

    expect(await findActivities()).toHaveLength(0);
  });

  it('executes once and replays the original 201 response for the same request and key', async () => {
    await acquireReservation(prospectorAToken, prospectAId);

    const key = randomUUID();

    const request = {
      method: 'POST' as const,
      url: activityUrl(prospectAId),
      headers: {
        authorization: `Bearer ${prospectorAToken}`,
        'idempotency-key': key,
      },
      payload: {
        type: 'call',
      },
    };

    const first = await getApp().inject(request);
    const second = await getApp().inject(request);

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);

    expect(first.headers['idempotency-replayed']).toBe('false');
    expect(second.headers['idempotency-replayed']).toBe('true');

    const firstBody = JSON.parse(first.payload) as Record<string, unknown>;
    const secondBody = JSON.parse(second.payload) as Record<string, unknown>;

    expect(secondBody).toEqual(firstBody);

    expect(firstBody).toMatchObject({
      tenantId,
      campaignId,
      campaignProspectId: prospectAId,
      establishmentId: establishmentAId,
      userId: prospectorAId,
      type: 'call',
    });

    const activities = await findActivities();

    expect(activities).toHaveLength(1);
    expect(activities[0]?.id).toBe(firstBody.id);
  });

  it('rejects the same key when the request fingerprint changes', async () => {
    await acquireReservation(prospectorAToken, prospectAId);

    const key = randomUUID();

    const first = await getApp().inject({
      method: 'POST',
      url: activityUrl(prospectAId),
      headers: {
        authorization: `Bearer ${prospectorAToken}`,
        'idempotency-key': key,
      },
      payload: {
        type: 'call',
      },
    });

    expect(first.statusCode).toBe(201);

    const reused = await getApp().inject({
      method: 'POST',
      url: activityUrl(prospectAId),
      headers: {
        authorization: `Bearer ${prospectorAToken}`,
        'idempotency-key': key,
      },
      payload: {
        type: 'email',
      },
    });

    expect(reused.statusCode).toBe(409);

    expect(JSON.parse(reused.payload)).toMatchObject({
      statusCode: 409,
      code: 'IDEMPOTENCY_KEY_REUSED',
    });

    expect(await findActivities()).toHaveLength(1);
  });

  it('scopes the same raw key independently to different authenticated users', async () => {
    await acquireReservation(prospectorAToken, prospectAId);
    await acquireReservation(prospectorBToken, prospectBId);

    const sharedKey = randomUUID();

    const first = await getApp().inject({
      method: 'POST',
      url: activityUrl(prospectAId),
      headers: {
        authorization: `Bearer ${prospectorAToken}`,
        'idempotency-key': sharedKey,
      },
      payload: {
        type: 'call',
      },
    });

    const second = await getApp().inject({
      method: 'POST',
      url: activityUrl(prospectBId),
      headers: {
        authorization: `Bearer ${prospectorBToken}`,
        'idempotency-key': sharedKey,
      },
      payload: {
        type: 'email',
      },
    });

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);

    const firstBody = JSON.parse(first.payload) as {
      userId: string;
      campaignProspectId: string;
    };

    const secondBody = JSON.parse(second.payload) as {
      userId: string;
      campaignProspectId: string;
    };

    expect(firstBody).toMatchObject({
      userId: prospectorAId,
      campaignProspectId: prospectAId,
    });

    expect(secondBody).toMatchObject({
      userId: prospectorBId,
      campaignProspectId: prospectBId,
    });

    const activities = await findActivities();

    expect(activities).toHaveLength(2);
  });

  it('allows exactly one business mutation under concurrent requests with the same key', async () => {
    await acquireReservation(prospectorAToken, prospectAId);

    const key = randomUUID();

    const send = () =>
      getApp().inject({
        method: 'POST',
        url: activityUrl(prospectAId),
        headers: {
          authorization: `Bearer ${prospectorAToken}`,
          'idempotency-key': key,
        },
        payload: {
          type: 'message',
        },
      });

    const responses = await Promise.all(Array.from({ length: 8 }, () => send()));

    expect(responses.some((response) => response.statusCode === 201)).toBe(true);

    for (const response of responses) {
      expect([201, 409]).toContain(response.statusCode);

      if (response.statusCode === 409) {
        expect(JSON.parse(response.payload)).toMatchObject({
          statusCode: 409,
          code: 'IDEMPOTENCY_REQUEST_IN_PROGRESS',
        });
      }
    }

    const activities = await findActivities();

    expect(activities).toHaveLength(1);
    expect(activities[0]).toMatchObject({
      tenantId,
      campaignId,
      campaignProspectId: prospectAId,
      userId: prospectorAId,
      type: 'message',
    });

    const records = await getDatabase()
      .select()
      .from(idempotencyRecords)
      .where(
        and(
          eq(idempotencyRecords.tenantId, tenantId),
          eq(idempotencyRecords.userId, prospectorAId),
          eq(idempotencyRecords.operation, 'activity.record'),
        ),
      );

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      status: 'completed',
      responseStatus: 201,
    });
  });
});
