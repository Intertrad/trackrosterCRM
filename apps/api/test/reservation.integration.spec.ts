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
import { campaignProspectAssignments } from '../src/database/schema/campaign-prospect-assignments.js';
import { campaignProspects } from '../src/database/schema/campaign-prospects.js';
import { campaigns } from '../src/database/schema/campaigns.js';
import { establishments } from '../src/database/schema/establishments.js';
import { organizations } from '../src/database/schema/organizations.js';
import { teams } from '../src/database/schema/teams.js';
import { tenants } from '../src/database/schema/tenants.js';
import { users } from '../src/database/schema/users.js';
import { RedisService } from '../src/redis/redis.service.js';
import { ReservationRepository } from '../src/reservations/reservation.repository.js';
import { TenantService } from '../src/tenants/tenant.service.js';
import { UserRepository } from '../src/users/user.repository.js';

describe('Reservation HTTP integration', () => {
  let app: NestFastifyApplication | undefined;

  let database: Database | undefined;

  let redisService: RedisService | undefined;

  let reservationRepository: ReservationRepository | undefined;

  let tenantId = '';
  let organizationId = '';
  let teamId = '';
  let campaignId = '';
  let prospectId = '';
  let assignmentId = '';

  let prospectorAId = '';
  let prospectorBId = '';

  let prospectorAToken = '';
  let prospectorBToken = '';

  const password = 'ReservationProspector123!';

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

  function reservationUrl(): string {
    return `/campaigns/${campaignId}` + `/prospects/${prospectId}` + '/reservation';
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

  async function clearReservation(): Promise<void> {
    if (!redisService || !tenantId || !campaignId || !prospectId) {
      return;
    }

    const key = getReservationRepository().buildKey(tenantId, campaignId, prospectId);

    await getRedis().getClient().del(key);
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
      name: `Reservation Tenant ${suffix}`,

      slug: `reservation-${suffix}`,
    });

    tenantId = tenant.id;

    const [organization] = await getDatabase()
      .insert(organizations)
      .values({
        tenantId,

        name: 'France Sales',

        slug: `france-${suffix}`,

        status: 'active',
      })
      .returning();

    if (!organization) {
      throw new Error('Failed to create organization');
    }

    organizationId = organization.id;

    const [team] = await getDatabase()
      .insert(teams)
      .values({
        tenantId,

        organizationId,

        name: 'Paris Prospecting',

        slug: `paris-${suffix}`,

        status: 'active',
      })
      .returning();

    if (!team) {
      throw new Error('Failed to create team');
    }

    teamId = team.id;

    const [campaign] = await getDatabase()
      .insert(campaigns)
      .values({
        tenantId,

        organizationId,

        name: 'Paris Campaign',

        status: 'active',
      })
      .returning();

    const [establishment] = await getDatabase()
      .insert(establishments)
      .values({
        tenantId,

        name: 'Paris Restaurant',

        normalizedName: 'paris restaurant',

        city: 'Paris',

        countryCode: 'FR',

        source: 'manual',

        status: 'active',
      })
      .returning();

    if (!campaign || !establishment) {
      throw new Error('Failed to create reservation fixtures');
    }

    campaignId = campaign.id;

    const [prospect] = await getDatabase()
      .insert(campaignProspects)
      .values({
        tenantId,

        campaignId,

        establishmentId: establishment.id,

        status: 'active',
      })
      .returning();

    if (!prospect) {
      throw new Error('Failed to create campaign prospect');
    }

    prospectId = prospect.id;

    /*
     * Team-only assignment intentionally.
     *
     * Both prospectors will therefore be
     * eligible to compete for the reservation.
     */
    const [assignment] = await getDatabase()
      .insert(campaignProspectAssignments)
      .values({
        tenantId,

        campaignId,

        campaignProspectId: prospectId,

        organizationId,

        teamId,

        assignedUserId: null,
      })
      .returning();

    if (!assignment) {
      throw new Error('Failed to create assignment');
    }

    assignmentId = assignment.id;

    const prospectorAEmail = `reservation-a-${suffix}@trackroster.test`;

    const prospectorBEmail = `reservation-b-${suffix}@trackroster.test`;

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

    await clearReservation();
  });

  afterAll(async () => {
    try {
      await clearReservation();

      if (database && tenantId) {
        await database
          .delete(campaignProspectAssignments)
          .where(eq(campaignProspectAssignments.tenantId, tenantId));

        await database.delete(campaignProspects).where(eq(campaignProspects.tenantId, tenantId));

        await database.delete(campaigns).where(eq(campaigns.tenantId, tenantId));

        await database.delete(establishments).where(eq(establishments.tenantId, tenantId));

        await database.delete(teams).where(eq(teams.tenantId, tenantId));

        await database.delete(users).where(eq(users.tenantId, tenantId));

        await database.delete(organizations).where(eq(organizations.tenantId, tenantId));

        await database.delete(tenants).where(eq(tenants.id, tenantId));
      }
    } finally {
      if (app) {
        await app.close();
      }
    }
  });

  it('rejects reservation acquisition without authentication', async () => {
    await clearReservation();

    const response = await getApp().inject({
      method: 'POST',

      url: reservationUrl(),
    });

    expect(response.statusCode).toBe(401);
  });

  it('acquires a 20 minute reservation', async () => {
    await clearReservation();

    const response = await getApp().inject({
      method: 'POST',

      url: reservationUrl(),

      headers: {
        authorization: `Bearer ${prospectorAToken}`,
      },
    });

    expect(response.statusCode).toBe(201);

    const body = JSON.parse(response.payload) as {
      reservationId: string;

      userId: string;

      assignmentId: string;

      expiresAt: string;
    };

    expect(body.userId).toBe(prospectorAId);

    expect(body.assignmentId).toBe(assignmentId);

    const ttl = await getReservationRepository().ttl(tenantId, campaignId, prospectId);

    /*
     * Allow a few seconds for test execution.
     */
    expect(ttl).toBeGreaterThan(1190);

    expect(ttl).toBeLessThanOrEqual(1200);
  });

  it('returns the same reservation for an idempotent retry', async () => {
    await clearReservation();

    const first = await getApp().inject({
      method: 'POST',

      url: reservationUrl(),

      headers: {
        authorization: `Bearer ${prospectorAToken}`,
      },
    });

    const second = await getApp().inject({
      method: 'POST',

      url: reservationUrl(),

      headers: {
        authorization: `Bearer ${prospectorAToken}`,
      },
    });

    expect(first.statusCode).toBe(201);

    expect(second.statusCode).toBe(201);

    const firstBody = JSON.parse(first.payload) as {
      reservationId: string;
    };

    const secondBody = JSON.parse(second.payload) as {
      reservationId: string;
    };

    expect(secondBody.reservationId).toBe(firstBody.reservationId);
  });

  it('allows exactly one of two concurrent prospectors to reserve', async () => {
    await clearReservation();

    const reserve = (token: string) =>
      getApp().inject({
        method: 'POST',

        url: reservationUrl(),

        headers: {
          authorization: `Bearer ${token}`,
        },
      });

    const [first, second] = await Promise.all([
      reserve(prospectorAToken),

      reserve(prospectorBToken),
    ]);

    const statusCodes = [first.statusCode, second.statusCode].sort((left, right) => left - right);

    expect(statusCodes).toEqual([201, 409]);

    const current = await getReservationRepository().findCurrent(tenantId, campaignId, prospectId);

    expect(current).not.toBeNull();

    expect([prospectorAId, prospectorBId]).toContain(current?.userId);
  });

  it('returns the current reservation', async () => {
    await clearReservation();

    const acquired = await getApp().inject({
      method: 'POST',

      url: reservationUrl(),

      headers: {
        authorization: `Bearer ${prospectorAToken}`,
      },
    });

    expect(acquired.statusCode).toBe(201);

    const response = await getApp().inject({
      method: 'GET',

      url: reservationUrl(),

      headers: {
        authorization: `Bearer ${prospectorBToken}`,
      },
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.payload) as {
      userId: string;

      campaignProspectId: string;
    };

    expect(body.userId).toBe(prospectorAId);

    expect(body.campaignProspectId).toBe(prospectId);
  });

  it('prevents another user from releasing the reservation', async () => {
    await clearReservation();

    const acquired = await getApp().inject({
      method: 'POST',

      url: reservationUrl(),

      headers: {
        authorization: `Bearer ${prospectorAToken}`,
      },
    });

    const body = JSON.parse(acquired.payload) as {
      reservationId: string;
    };

    const response = await getApp().inject({
      method: 'DELETE',

      url: `${reservationUrl()}/${body.reservationId}`,

      headers: {
        authorization: `Bearer ${prospectorBToken}`,
      },
    });

    expect(response.statusCode).toBe(403);

    const current = await getReservationRepository().findCurrent(tenantId, campaignId, prospectId);

    expect(current?.reservationId).toBe(body.reservationId);
  });

  it('releases the reservation for its owner', async () => {
    await clearReservation();

    const acquired = await getApp().inject({
      method: 'POST',

      url: reservationUrl(),

      headers: {
        authorization: `Bearer ${prospectorAToken}`,
      },
    });

    const body = JSON.parse(acquired.payload) as {
      reservationId: string;
    };

    const released = await getApp().inject({
      method: 'DELETE',

      url: `${reservationUrl()}/${body.reservationId}`,

      headers: {
        authorization: `Bearer ${prospectorAToken}`,
      },
    });

    expect(released.statusCode).toBe(200);

    const current = await getReservationRepository().findCurrent(tenantId, campaignId, prospectId);

    expect(current).toBeNull();
  });

  it('becomes reservable again after Redis TTL expiry', async () => {
    await clearReservation();

    const first = await getApp().inject({
      method: 'POST',

      url: reservationUrl(),

      headers: {
        authorization: `Bearer ${prospectorAToken}`,
      },
    });

    expect(first.statusCode).toBe(201);

    const key = getReservationRepository().buildKey(tenantId, campaignId, prospectId);

    /*
     * Shorten TTL for the integration test.
     * Production TTL remains 20 minutes.
     */
    await getRedis().getClient().expire(key, 1);

    await new Promise((resolve) => setTimeout(resolve, 1_200));

    const expired = await getReservationRepository().findCurrent(tenantId, campaignId, prospectId);

    expect(expired).toBeNull();

    const second = await getApp().inject({
      method: 'POST',

      url: reservationUrl(),

      headers: {
        authorization: `Bearer ${prospectorBToken}`,
      },
    });

    expect(second.statusCode).toBe(201);
  });

  it('does not let a stale reservation id release a newer reservation', async () => {
    await clearReservation();

    const first = await getApp().inject({
      method: 'POST',

      url: reservationUrl(),

      headers: {
        authorization: `Bearer ${prospectorAToken}`,
      },
    });

    const firstBody = JSON.parse(first.payload) as {
      reservationId: string;
    };

    const key = getReservationRepository().buildKey(tenantId, campaignId, prospectId);

    await getRedis().getClient().expire(key, 1);

    await new Promise((resolve) => setTimeout(resolve, 1_200));

    const second = await getApp().inject({
      method: 'POST',

      url: reservationUrl(),

      headers: {
        authorization: `Bearer ${prospectorAToken}`,
      },
    });

    expect(second.statusCode).toBe(201);

    const secondBody = JSON.parse(second.payload) as {
      reservationId: string;
    };

    expect(secondBody.reservationId).not.toBe(firstBody.reservationId);

    const staleRelease = await getApp().inject({
      method: 'DELETE',

      url: `${reservationUrl()}/${firstBody.reservationId}`,

      headers: {
        authorization: `Bearer ${prospectorAToken}`,
      },
    });

    expect(staleRelease.statusCode).toBe(409);

    const current = await getReservationRepository().findCurrent(tenantId, campaignId, prospectId);

    expect(current?.reservationId).toBe(secondBody.reservationId);
  });
});
