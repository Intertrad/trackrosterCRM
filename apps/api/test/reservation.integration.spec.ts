import { auditEvents } from '../src/database/schema/audit-events.js';
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
import { campaignProspectAssignments } from '../src/database/schema/campaign-prospect-assignments.js';
import { campaignProspects } from '../src/database/schema/campaign-prospects.js';
import { campaigns } from '../src/database/schema/campaigns.js';
import { establishments } from '../src/database/schema/establishments.js';
import { organizations } from '../src/database/schema/organizations.js';
import { prospectActivities } from '../src/database/schema/prospect-activities.js';
import { prospectFollowUps } from '../src/database/schema/prospect-follow-ups.js';
import { teams } from '../src/database/schema/teams.js';
import { tenants } from '../src/database/schema/tenants.js';
import { users } from '../src/database/schema/users.js';
import { RedisService } from '../src/redis/redis.service.js';
import { ReservationRepository } from '../src/reservations/reservation.repository.js';
import { TenantService } from '../src/tenants/tenant.service.js';
import { UserRepository } from '../src/users/user.repository.js';
import { getSeedDatabase } from './support/seed.js';

describe('Reservation HTTP integration', () => {
  let app: NestFastifyApplication | undefined;

  let database: Database | undefined;

  let redisService: RedisService | undefined;

  let reservationRepository: ReservationRepository | undefined;

  let tenantId = '';
  let organizationId = '';
  let teamId = '';
  let establishmentId = '';

  let campaignId = '';
  let prospectId = '';
  let assignmentId = '';

  let secondCampaignId = '';
  let secondProspectId = '';
  let secondAssignmentId = '';

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

  function activityUrl(): string {
    return `/campaigns/${campaignId}` + `/prospects/${prospectId}` + '/activities';
  }
  function timelineUrl(): string {
    return `/campaigns/${campaignId}` + `/prospects/${prospectId}` + '/timeline';
  }

  function secondReservationUrl(): string {
    return `/campaigns/${secondCampaignId}` + `/prospects/${secondProspectId}` + '/reservation';
  }

  function collisionDecisionUrl(): string {
    return `/campaigns/${campaignId}` + `/prospects/${prospectId}` + '/collision-decision';
  }

  function secondCollisionDecisionUrl(): string {
    return (
      `/campaigns/${secondCampaignId}` + `/prospects/${secondProspectId}` + '/collision-decision'
    );
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
    if (
      !redisService ||
      !tenantId ||
      !organizationId ||
      !campaignId ||
      !prospectId ||
      !secondCampaignId ||
      !secondProspectId ||
      !establishmentId
    ) {
      return;
    }

    const firstReservationKey = getReservationRepository().buildKey(
      tenantId,
      campaignId,
      prospectId,
    );

    const secondReservationKey = getReservationRepository().buildKey(
      tenantId,
      secondCampaignId,
      secondProspectId,
    );

    /*
     * Keep removing the legacy TR-016 key during
     * the transition so an earlier failed test or
     * pre-TR-017 reservation cannot contaminate
     * the suite.
     */
    const legacyCollisionKey = getReservationRepository().buildCollisionKey(
      tenantId,
      establishmentId,
    );

    const organizationCollisionKey = getReservationRepository().buildOrganizationCollisionKey(
      tenantId,
      organizationId,
      establishmentId,
    );

    await getRedis()
      .getClient()
      .del([
        firstReservationKey,
        secondReservationKey,
        legacyCollisionKey,
        organizationCollisionKey,
      ]);
  }

  async function clearActivityHistory(): Promise<void> {
    if (!database || !tenantId) {
      return;
    }

    await getDatabase().delete(prospectActivities).where(eq(prospectActivities.tenantId, tenantId));
  }

  async function clearFollowUps(): Promise<void> {
    if (!database || !tenantId) {
      return;
    }

    await getDatabase().delete(prospectFollowUps).where(eq(prospectFollowUps.tenantId, tenantId));
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

    redisService = application.get(RedisService);

    reservationRepository = application.get(ReservationRepository);

    const tenantService = application.get(TenantService);

    const userRepository = application.get(UserRepository);

    const passwordService = application.get(PasswordService);

    const grantRepository = application.get(UserAccessGrantRepository);

    const suffix = randomUUID().replaceAll('-', '').slice(0, 10);

    /*
     * Tenant
     */
    const tenant = await tenantService.create({
      name: `Reservation Tenant ${suffix}`,

      slug: `reservation-${suffix}`,
    });

    tenantId = tenant.id;

    /*
     * Organization
     */
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

    /*
     * Team
     */
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

    /*
     * First campaign
     */
    const [campaign] = await getDatabase()
      .insert(campaigns)
      .values({
        tenantId,

        organizationId,

        name: 'Paris Campaign',

        status: 'active',
      })
      .returning();

    /*
     * Canonical establishment shared
     * by both campaigns.
     */
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

    establishmentId = establishment.id;

    /*
     * First campaign prospect.
     */
    const [prospect] = await getDatabase()
      .insert(campaignProspects)
      .values({
        tenantId,

        campaignId,

        establishmentId,

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
     * Both prospectors are eligible
     * to compete.
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

    /*
     * Second campaign.
     */
    const [secondCampaign] = await getDatabase()
      .insert(campaigns)
      .values({
        tenantId,

        organizationId,

        name: 'Second Paris Campaign',

        status: 'active',
      })
      .returning();

    if (!secondCampaign) {
      throw new Error('Failed to create second campaign');
    }

    secondCampaignId = secondCampaign.id;

    /*
     * Second campaign prospect deliberately
     * points to the SAME canonical establishment.
     */
    const [secondProspect] = await getDatabase()
      .insert(campaignProspects)
      .values({
        tenantId,

        campaignId: secondCampaignId,

        establishmentId,

        status: 'active',
      })
      .returning();

    if (!secondProspect) {
      throw new Error('Failed to create second campaign prospect');
    }

    secondProspectId = secondProspect.id;

    /*
     * Team-only assignment for
     * the second campaign too.
     */
    const [secondAssignment] = await getDatabase()
      .insert(campaignProspectAssignments)
      .values({
        tenantId,

        campaignId: secondCampaignId,

        campaignProspectId: secondProspectId,

        organizationId,

        teamId,

        assignedUserId: null,
      })
      .returning();

    if (!secondAssignment) {
      throw new Error('Failed to create second assignment');
    }

    secondAssignmentId = secondAssignment.id;

    /*
     * Two prospectors on the same team.
     */
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
    await clearActivityHistory();
    await clearFollowUps();
  });

  afterAll(async () => {
    try {
      await clearReservation();

      if (database && tenantId) {
        /*
         * Child records must be deleted before
         * the rows they reference.
         */
        await database.delete(prospectFollowUps).where(eq(prospectFollowUps.tenantId, tenantId));

        await database.delete(prospectActivities).where(eq(prospectActivities.tenantId, tenantId));

        await database
          .delete(campaignProspectAssignments)
          .where(eq(campaignProspectAssignments.tenantId, tenantId));

        await database.delete(campaignProspects).where(eq(campaignProspects.tenantId, tenantId));

        await database.delete(campaigns).where(eq(campaigns.tenantId, tenantId));

        await database.delete(establishments).where(eq(establishments.tenantId, tenantId));

        await database.delete(teams).where(eq(teams.tenantId, tenantId));

        await database.delete(auditEvents).where(eq(auditEvents.tenantId, tenantId));
        await clearSessionEvidenceForUsers(database, eq(users.tenantId, tenantId));
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

      establishmentId: string;

      expiresAt: string;
    };

    expect(body.userId).toBe(prospectorAId);

    expect(body.assignmentId).toBe(assignmentId);

    expect(body.establishmentId).toBe(establishmentId);

    const reservationTtl = await getReservationRepository().ttl(tenantId, campaignId, prospectId);

    const collisionTtl = await getReservationRepository().organizationCollisionTtl(
      tenantId,
      organizationId,
      establishmentId,
    );

    /*
     * Allow a few seconds for test execution.
     */
    expect(reservationTtl).toBeGreaterThan(1190);

    expect(reservationTtl).toBeLessThanOrEqual(1200);

    expect(collisionTtl).toBeGreaterThan(1190);

    expect(collisionTtl).toBeLessThanOrEqual(1200);
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

  it('allows exactly one of two concurrent prospectors to reserve the same campaign prospect', async () => {
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
  it('returns owned reservation state to the reservation owner', async () => {
    await clearReservation();

    const acquired = await getApp().inject({
      method: 'POST',

      url: reservationUrl(),

      headers: {
        authorization: `Bearer ${prospectorAToken}`,
      },
    });

    expect(acquired.statusCode).toBe(201);

    const acquiredBody = JSON.parse(acquired.payload) as {
      reservationId: string;

      acquiredAt: string;

      expiresAt: string;
    };

    const response = await getApp().inject({
      method: 'GET',

      url: reservationUrl(),

      headers: {
        authorization: `Bearer ${prospectorAToken}`,
      },
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.payload) as Record<string, unknown>;

    expect(body).toEqual({
      state: 'owned',

      reservationId: acquiredBody.reservationId,

      acquiredAt: acquiredBody.acquiredAt,

      expiresAt: acquiredBody.expiresAt,
    });

    expect(body).not.toHaveProperty('tenantId');
    expect(body).not.toHaveProperty('organizationId');
    expect(body).not.toHaveProperty('campaignId');
    expect(body).not.toHaveProperty('campaignProspectId');
    expect(body).not.toHaveProperty('establishmentId');
    expect(body).not.toHaveProperty('assignmentId');
    expect(body).not.toHaveProperty('teamId');
    expect(body).not.toHaveProperty('userId');
  });

  it('returns reserved state to another eligible prospector without leaking reservation ownership', async () => {
    await clearReservation();

    const acquired = await getApp().inject({
      method: 'POST',

      url: reservationUrl(),

      headers: {
        authorization: `Bearer ${prospectorAToken}`,
      },
    });

    expect(acquired.statusCode).toBe(201);

    const acquiredBody = JSON.parse(acquired.payload) as {
      expiresAt: string;
    };

    const response = await getApp().inject({
      method: 'GET',

      url: reservationUrl(),

      headers: {
        authorization: `Bearer ${prospectorBToken}`,
      },
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.payload) as Record<string, unknown>;

    expect(body).toEqual({
      state: 'reserved',

      expiresAt: acquiredBody.expiresAt,
    });

    expect(body).not.toHaveProperty('reservationId');
    expect(body).not.toHaveProperty('acquiredAt');
    expect(body).not.toHaveProperty('tenantId');
    expect(body).not.toHaveProperty('organizationId');
    expect(body).not.toHaveProperty('campaignId');
    expect(body).not.toHaveProperty('campaignProspectId');
    expect(body).not.toHaveProperty('establishmentId');
    expect(body).not.toHaveProperty('assignmentId');
    expect(body).not.toHaveProperty('teamId');
    expect(body).not.toHaveProperty('userId');
  });

  it('masks another user reservation ownership exactly like an absent reservation', async () => {
    await clearReservation();

    const acquired = await getApp().inject({
      method: 'POST',

      url: reservationUrl(),

      headers: {
        authorization: `Bearer ${prospectorAToken}`,
      },
    });

    expect(acquired.statusCode).toBe(201);

    const body = JSON.parse(acquired.payload) as {
      reservationId: string;
    };

    /*
     * B knows the real reservation ID but does not own it.
     */
    const foreignOwnerResponse = await getApp().inject({
      method: 'DELETE',

      url: `${reservationUrl()}/${body.reservationId}`,

      headers: {
        authorization: `Bearer ${prospectorBToken}`,
      },
    });

    expect(foreignOwnerResponse.statusCode).toBe(404);

    /*
     * Failed foreign release must not mutate A's reservation.
     */
    const current = await getReservationRepository().findCurrent(tenantId, campaignId, prospectId);

    expect(current?.reservationId).toBe(body.reservationId);

    /*
     * Remove the reservation directly so the second request
     * exercises the genuinely-absent-resource case.
     */
    await clearReservation();

    const absentResponse = await getApp().inject({
      method: 'DELETE',

      url: `${reservationUrl()}/${body.reservationId}`,

      headers: {
        authorization: `Bearer ${prospectorBToken}`,
      },
    });

    expect(absentResponse.statusCode).toBe(404);

    const foreignOwnerBody = JSON.parse(foreignOwnerResponse.payload) as {
      statusCode: number;

      code: string;

      message: string;

      error: string;

      requestId: string;
    };

    const absentBody = JSON.parse(absentResponse.payload) as {
      statusCode: number;

      code: string;

      message: string;

      error: string;

      requestId: string;
    };

    expect(foreignOwnerBody).toMatchObject({
      statusCode: 404,

      code: 'NOT_FOUND',

      message: 'Reservation not found',

      error: 'Not Found',
    });

    expect(absentBody).toMatchObject({
      statusCode: 404,

      code: 'NOT_FOUND',

      message: 'Reservation not found',

      error: 'Not Found',
    });

    expect({
      statusCode: foreignOwnerBody.statusCode,

      code: foreignOwnerBody.code,

      message: foreignOwnerBody.message,

      error: foreignOwnerBody.error,
    }).toEqual({
      statusCode: absentBody.statusCode,

      code: absentBody.code,

      message: absentBody.message,

      error: absentBody.error,
    });

    expect(foreignOwnerBody.requestId).not.toBe(absentBody.requestId);
  });

  it('releases the reservation and organization collision lock for its owner', async () => {
    await clearReservation();

    const acquired = await getApp().inject({
      method: 'POST',

      url: reservationUrl(),

      headers: {
        authorization: `Bearer ${prospectorAToken}`,
      },
    });

    expect(acquired.statusCode).toBe(201);

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

    const collision = await getReservationRepository().findCurrentByOrganizationEstablishment(
      tenantId,
      organizationId,
      establishmentId,
    );

    expect(collision).toBeNull();
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

    const reservationKey = getReservationRepository().buildKey(tenantId, campaignId, prospectId);

    const collisionKey = getReservationRepository().buildOrganizationCollisionKey(
      tenantId,
      organizationId,
      establishmentId,
    );

    /*
     * Shorten both TTLs for this integration test.
     * Production remains 20 minutes.
     */
    await Promise.all([
      getRedis().getClient().expire(reservationKey, 1),

      getRedis().getClient().expire(collisionKey, 1),
    ]);

    await new Promise((resolve) => setTimeout(resolve, 1_200));

    const expired = await getReservationRepository().findCurrent(tenantId, campaignId, prospectId);

    expect(expired).toBeNull();

    const expiredCollision =
      await getReservationRepository().findCurrentByOrganizationEstablishment(
        tenantId,
        organizationId,
        establishmentId,
      );

    expect(expiredCollision).toBeNull();

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

    /*
     * Reservation #1.
     */
    const first = await getApp().inject({
      method: 'POST',

      url: reservationUrl(),

      headers: {
        authorization: `Bearer ${prospectorAToken}`,
      },
    });

    expect(first.statusCode).toBe(201);

    const firstBody = JSON.parse(first.payload) as {
      reservationId: string;
    };

    /*
     * TR-017 reservations own two Redis keys:
     *
     * 1. Exact campaign-prospect reservation key
     * 2. Organization-scoped establishment lock
     *
     * Both must expire together when simulating TTL
     * expiry in this integration test.
     */
    const reservationKey = getReservationRepository().buildKey(tenantId, campaignId, prospectId);

    const organizationCollisionKey = getReservationRepository().buildOrganizationCollisionKey(
      tenantId,
      organizationId,
      establishmentId,
    );

    await Promise.all([
      getRedis().getClient().expire(reservationKey, 1),

      getRedis().getClient().expire(organizationCollisionKey, 1),
    ]);

    await new Promise((resolve) => setTimeout(resolve, 1_200));

    /*
     * The first reservation should now be fully
     * expired.
     */
    const expiredReservation = await getReservationRepository().findCurrent(
      tenantId,
      campaignId,
      prospectId,
    );

    expect(expiredReservation).toBeNull();

    const expiredCollision =
      await getReservationRepository().findCurrentByOrganizationEstablishment(
        tenantId,
        organizationId,
        establishmentId,
      );

    expect(expiredCollision).toBeNull();

    /*
     * Reservation #2.
     */
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

    /*
     * Try releasing Reservation #2 using the stale
     * ID belonging to Reservation #1.
     *
     * This must never remove the newer reservation.
     */
    const staleRelease = await getApp().inject({
      method: 'DELETE',

      url: `${reservationUrl()}/` + firstBody.reservationId,

      headers: {
        authorization: `Bearer ${prospectorAToken}`,
      },
    });

    expect(staleRelease.statusCode).toBe(409);

    /*
     * Exact reservation must still be Reservation #2.
     */
    const current = await getReservationRepository().findCurrent(tenantId, campaignId, prospectId);

    expect(current?.reservationId).toBe(secondBody.reservationId);

    /*
     * Organization-scoped establishment lock must
     * also still belong to Reservation #2.
     */
    const collision = await getReservationRepository().findCurrentByOrganizationEstablishment(
      tenantId,
      organizationId,
      establishmentId,
    );

    expect(collision?.reservationId).toBe(secondBody.reservationId);
  });

  /*
   * TR-016:
   * Sequential cross-campaign collision.
   */
  it('blocks another campaign from reserving the same canonical establishment', async () => {
    await clearReservation();

    const first = await getApp().inject({
      method: 'POST',

      url: reservationUrl(),

      headers: {
        authorization: `Bearer ${prospectorAToken}`,
      },
    });

    expect(first.statusCode).toBe(201);

    const second = await getApp().inject({
      method: 'POST',

      url: secondReservationUrl(),

      headers: {
        authorization: `Bearer ${prospectorBToken}`,
      },
    });

    expect(second.statusCode).toBe(409);

    const secondReservation = await getReservationRepository().findCurrent(
      tenantId,
      secondCampaignId,
      secondProspectId,
    );

    expect(secondReservation).toBeNull();

    const canonicalReservation =
      await getReservationRepository().findCurrentByOrganizationEstablishment(
        tenantId,
        organizationId,
        establishmentId,
      );

    expect(canonicalReservation?.campaignId).toBe(campaignId);

    expect(canonicalReservation?.campaignProspectId).toBe(prospectId);
  });

  /*
   * TR-016:
   * Concurrent cross-campaign collision.
   */
  it('allows exactly one concurrent reservation across campaigns for the same establishment', async () => {
    await clearReservation();

    const firstRequest = getApp().inject({
      method: 'POST',

      url: reservationUrl(),

      headers: {
        authorization: `Bearer ${prospectorAToken}`,
      },
    });

    const secondRequest = getApp().inject({
      method: 'POST',

      url: secondReservationUrl(),

      headers: {
        authorization: `Bearer ${prospectorBToken}`,
      },
    });

    const [first, second] = await Promise.all([firstRequest, secondRequest]);

    const statusCodes = [first.statusCode, second.statusCode].sort((left, right) => left - right);

    expect(statusCodes).toEqual([201, 409]);

    const firstReservation = await getReservationRepository().findCurrent(
      tenantId,
      campaignId,
      prospectId,
    );

    const secondReservation = await getReservationRepository().findCurrent(
      tenantId,
      secondCampaignId,
      secondProspectId,
    );

    const activeReservations = [firstReservation, secondReservation].filter(
      (reservation) => reservation !== null,
    );

    expect(activeReservations).toHaveLength(1);

    const collision = await getReservationRepository().findCurrentByOrganizationEstablishment(
      tenantId,
      organizationId,
      establishmentId,
    );

    expect(collision).not.toBeNull();

    expect(activeReservations[0]?.reservationId).toBe(collision?.reservationId);

    expect([prospectId, secondProspectId]).toContain(activeReservations[0]?.campaignProspectId);
  });

  /*
   * TR-016:
   * Releasing one campaign frees the canonical
   * establishment for another campaign.
   */
  /*
   * Same-organization behavior:
   *
   * Releasing Campaign A's reservation must free the
   * organization's canonical establishment lock so
   * Campaign B can acquire it afterward.
   */
  it('allows another campaign to reserve after the first reservation is released', async () => {
    await clearReservation();

    /*
     * Campaign A reserves the establishment.
     */
    const first = await getApp().inject({
      method: 'POST',

      url: reservationUrl(),

      headers: {
        authorization: `Bearer ${prospectorAToken}`,
      },
    });

    expect(first.statusCode).toBe(201);

    const firstBody = JSON.parse(first.payload) as {
      reservationId: string;
    };

    /*
     * Release Campaign A.
     */
    const released = await getApp().inject({
      method: 'DELETE',

      url: `${reservationUrl()}/` + firstBody.reservationId,

      headers: {
        authorization: `Bearer ${prospectorAToken}`,
      },
    });

    expect(released.statusCode).toBe(200);

    /*
     * The organization-scoped canonical lock must
     * have been removed.
     */
    const collisionAfterRelease =
      await getReservationRepository().findCurrentByOrganizationEstablishment(
        tenantId,
        organizationId,
        establishmentId,
      );

    expect(collisionAfterRelease).toBeNull();

    /*
     * Campaign B should now be able to reserve the
     * same canonical establishment.
     */
    const second = await getApp().inject({
      method: 'POST',

      url: secondReservationUrl(),

      headers: {
        authorization: `Bearer ${prospectorBToken}`,
      },
    });

    expect(second.statusCode).toBe(201);

    /*
     * Verify Campaign B now owns the organization's
     * establishment lock.
     */
    const currentCollision =
      await getReservationRepository().findCurrentByOrganizationEstablishment(
        tenantId,
        organizationId,
        establishmentId,
      );

    expect(currentCollision).not.toBeNull();

    expect(currentCollision?.campaignId).toBe(secondCampaignId);

    expect(currentCollision?.campaignProspectId).toBe(secondProspectId);

    expect(currentCollision?.userId).toBe(prospectorBId);

    /*
     * Verify the exact Campaign B reservation too.
     */
    const secondReservation = await getReservationRepository().findCurrent(
      tenantId,
      secondCampaignId,
      secondProspectId,
    );

    expect(secondReservation?.reservationId).toBe(currentCollision?.reservationId);
  });

  it('rejects collision decision without authentication', async () => {
    await clearReservation();

    const response = await getApp().inject({
      method: 'GET',

      url: collisionDecisionUrl(),
    });

    expect(response.statusCode).toBe(401);
  });

  it('warns when the canonical establishment has another active assignment', async () => {
    await clearReservation();

    await clearActivityHistory();

    await clearFollowUps();

    const response = await getApp().inject({
      method: 'GET',

      url: collisionDecisionUrl(),

      headers: {
        authorization: `Bearer ${prospectorAToken}`,
      },
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.payload) as {
      decision: string;

      reasonCode: string;

      establishmentId: string;

      conflict: Record<string, unknown>;
    };

    expect(body).toEqual({
      decision: 'warn',

      reasonCode: 'ACTIVE_ASSIGNMENT',

      establishmentId,

      conflict: {
        assignedAt: expect.any(String),
      },
    });

    /*
     * Prospector-facing response must not
     * expose internal ownership details.
     */
    expect(body.conflict).not.toHaveProperty('assignmentId');

    expect(body.conflict).not.toHaveProperty('assignedUserId');

    expect(body.conflict).not.toHaveProperty('userId');

    expect(body.conflict).not.toHaveProperty('teamId');

    expect(body.conflict).not.toHaveProperty('organizationId');

    expect(body.conflict).not.toHaveProperty('campaignId');

    expect(body.conflict).not.toHaveProperty('campaignProspectId');
  });

  /*
   * TR-016:
   * A pending follow-up on another campaign
   * must become an authoritative planned-action
   * collision for the canonical establishment.
   */
  it('blocks collision decision and direct reservation when another campaign has a pending follow-up', async () => {
    await clearReservation();

    await clearActivityHistory();

    await clearFollowUps();

    const [followUp] = await getDatabase()
      .insert(prospectFollowUps)
      .values({
        tenantId,

        campaignId: secondCampaignId,

        campaignProspectId: secondProspectId,

        establishmentId,

        assignmentId: secondAssignmentId,

        assignedUserId: prospectorBId,

        createdBy: prospectorBId,

        dueAt: new Date('2026-09-10T10:00:00.000Z'),

        status: 'pending',
      })
      .returning();

    if (!followUp) {
      throw new Error('Failed to create planned-action fixture');
    }

    try {
      /*
       * Step 1:
       * Advisory endpoint must report
       * PLANNED_ACTION.
       */
      const collisionResponse = await getApp().inject({
        method: 'GET',

        url: collisionDecisionUrl(),

        headers: {
          authorization: `Bearer ${prospectorAToken}`,
        },
      });

      expect(collisionResponse.statusCode).toBe(200);

      const collisionDecision = JSON.parse(collisionResponse.payload) as {
        decision: string;

        reasonCode: string;

        establishmentId: string;

        conflict: Record<string, unknown>;
      };

      expect(collisionDecision).toEqual({
        decision: 'block',

        reasonCode: 'PLANNED_ACTION',

        establishmentId,

        conflict: {
          dueAt: expect.any(String),
        },
      });

      /*
       * Public response exposes only the
       * timing information necessary for the
       * prospector.
       */
      expect(collisionDecision.conflict).not.toHaveProperty('followUpId');

      expect(collisionDecision.conflict).not.toHaveProperty('assignedUserId');

      expect(collisionDecision.conflict).not.toHaveProperty('userId');

      expect(collisionDecision.conflict).not.toHaveProperty('teamId');

      expect(collisionDecision.conflict).not.toHaveProperty('organizationId');

      expect(collisionDecision.conflict).not.toHaveProperty('campaignId');

      expect(collisionDecision.conflict).not.toHaveProperty('campaignProspectId');

      expect(collisionDecision.conflict).not.toHaveProperty('assignmentId');

      /*
       * Step 2:
       * Calling POST /reservation directly
       * must not bypass collision protection.
       */
      const reservationResponse = await getApp().inject({
        method: 'POST',

        url: reservationUrl(),

        headers: {
          authorization: `Bearer ${prospectorAToken}`,
        },
      });

      expect(reservationResponse.statusCode).toBe(409);

      expect(JSON.parse(reservationResponse.payload)).toMatchObject({
        statusCode: 409,

        message: 'Establishment has a planned action',
      });

      /*
       * Redis acquisition must not have happened.
       */
      const currentReservation = await getReservationRepository().findCurrent(
        tenantId,
        campaignId,
        prospectId,
      );

      expect(currentReservation).toBeNull();

      const organizationReservation =
        await getReservationRepository().findCurrentByOrganizationEstablishment(
          tenantId,
          organizationId,
          establishmentId,
        );

      expect(organizationReservation).toBeNull();

      expect(organizationReservation).toBeNull();
    } finally {
      await clearReservation();

      await clearFollowUps();
    }
  });

  /*
   * TR-016:
   * A prospector must still be able to execute
   * their own exact scheduled follow-up.
   */
  it('allows the caller to work their own pending follow-up on the exact prospect', async () => {
    await clearReservation();

    await clearActivityHistory();

    await clearFollowUps();

    await getDatabase()
      .insert(prospectFollowUps)
      .values({
        tenantId,

        campaignId,

        campaignProspectId: prospectId,

        establishmentId,

        assignmentId,

        assignedUserId: prospectorAId,

        createdBy: prospectorAId,

        dueAt: new Date('2026-09-10T11:00:00.000Z'),

        status: 'pending',
      });

    try {
      /*
       * The caller's own follow-up must not
       * become PLANNED_ACTION.
       *
       * Campaign B still has another active
       * assignment, therefore WARN is expected.
       */
      const collisionResponse = await getApp().inject({
        method: 'GET',

        url: collisionDecisionUrl(),

        headers: {
          authorization: `Bearer ${prospectorAToken}`,
        },
      });

      expect(collisionResponse.statusCode).toBe(200);

      const collisionDecision = JSON.parse(collisionResponse.payload) as {
        decision: string;

        reasonCode: string;
      };

      expect(collisionDecision.reasonCode).not.toBe('PLANNED_ACTION');

      expect(collisionDecision).toMatchObject({
        decision: 'warn',

        reasonCode: 'ACTIVE_ASSIGNMENT',
      });

      /*
       * ACTIVE_ASSIGNMENT is advisory only,
       * so acquisition must still succeed.
       */
      const reservationResponse = await getApp().inject({
        method: 'POST',

        url: reservationUrl(),

        headers: {
          authorization: `Bearer ${prospectorAToken}`,
        },
      });

      expect(reservationResponse.statusCode).toBe(201);

      const reservation = JSON.parse(reservationResponse.payload) as {
        userId: string;

        campaignProspectId: string;

        establishmentId: string;
      };

      expect(reservation).toMatchObject({
        userId: prospectorAId,

        campaignProspectId: prospectId,

        establishmentId,
      });
    } finally {
      await clearReservation();

      await clearFollowUps();
    }
  });

  it('returns block when another campaign reserves the same canonical establishment', async () => {
    await clearReservation();

    await clearFollowUps();

    const acquired = await getApp().inject({
      method: 'POST',

      url: secondReservationUrl(),

      headers: {
        authorization: `Bearer ${prospectorBToken}`,
      },
    });

    expect(acquired.statusCode).toBe(201);

    const response = await getApp().inject({
      method: 'GET',

      url: collisionDecisionUrl(),

      headers: {
        authorization: `Bearer ${prospectorAToken}`,
      },
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.payload) as {
      decision: string;

      reasonCode: string;

      establishmentId: string;

      conflict: Record<string, unknown>;
    };

    expect(body.decision).toBe('block');

    expect(body.reasonCode).toBe('ACTIVE_RESERVATION');

    expect(body.establishmentId).toBe(establishmentId);

    /*
     * Prospector-facing API exposes only
     * information needed to understand
     * the temporary reservation block.
     */
    expect(body.conflict).toHaveProperty('expiresAt');

    expect(body.conflict).not.toHaveProperty('userId');

    expect(body.conflict).not.toHaveProperty('assignedUserId');

    expect(body.conflict).not.toHaveProperty('teamId');

    expect(body.conflict).not.toHaveProperty('organizationId');

    expect(body.conflict).not.toHaveProperty('assignmentId');

    expect(body.conflict).not.toHaveProperty('campaignId');

    expect(body.conflict).not.toHaveProperty('campaignProspectId');

    expect(body.conflict).not.toHaveProperty('reservationId');
  });

  /*
   * Immutable contact history requires
   * active reservation ownership.
   */
  it('rejects activity evidence tied to another campaign prospect assignment', async () => {
    await clearActivityHistory();

    await expect(
      getDatabase().insert(prospectActivities).values({
        tenantId,

        campaignId,

        campaignProspectId: prospectId,

        establishmentId,

        assignmentId: secondAssignmentId,

        userId: prospectorAId,

        reservationId: randomUUID(),

        type: 'call',
      }),
    ).rejects.toMatchObject({
      cause: {
        code: '23503',

        constraint: 'prospect_activities_tenant_prospect_assignment_fk',
      },
    });
  });

  it('rejects activity recording without an active reservation', async () => {
    await clearReservation();

    await clearActivityHistory();

    await clearFollowUps();

    const response = await getApp().inject({
      method: 'POST',

      url: activityUrl(),

      headers: {
        authorization: `Bearer ${prospectorAToken}`,

        'idempotency-key': randomUUID(),
      },

      payload: {
        type: 'call',
      },
    });

    console.log('ACTIVITY 400 PAYLOAD:', response.payload);

    expect(response.statusCode).toBe(409);

    expect(JSON.parse(response.payload)).toMatchObject({
      statusCode: 409,

      message: 'Active reservation required',
    });

    const storedActivities = await getDatabase()
      .select()
      .from(prospectActivities)
      .where(eq(prospectActivities.tenantId, tenantId));

    expect(storedActivities).toHaveLength(0);
  });

  /*
   * End-to-end recent-contact protection
   * across campaign contexts.
   */

  it('blocks a second campaign after recent contact with the same canonical establishment', async () => {
    await clearReservation();

    await clearActivityHistory();

    await clearFollowUps();

    try {
      /*
       * Step 1:
       * Prospector A reserves
       * Campaign A / Prospect A.
       *
       * Reservation uses its existing
       * domain-level idempotency behavior,
       * therefore no HTTP Idempotency-Key
       * is required here.
       */
      const reservationResponse = await getApp().inject({
        method: 'POST',

        url: reservationUrl(),

        headers: {
          authorization: `Bearer ${prospectorAToken}`,
        },
      });

      expect(reservationResponse.statusCode).toBe(201);

      const reservation = JSON.parse(reservationResponse.payload) as {
        reservationId: string;

        establishmentId: string;

        assignmentId: string;

        userId: string;
      };

      expect(reservation).toMatchObject({
        establishmentId,

        assignmentId,

        userId: prospectorAId,
      });

      /*
       * Step 2:
       * Prospector A records a real contact.
       *
       * Activity recording IS protected by
       * TR-026 HTTP idempotency.
       */
      const activityResponse = await getApp().inject({
        method: 'POST',

        url: activityUrl(),

        headers: {
          authorization: `Bearer ${prospectorAToken}`,

          'idempotency-key': randomUUID(),
        },

        payload: {
          type: 'call',
        },
      });

      console.log('ACTIVITY CREATE 400 PAYLOAD:', activityResponse.payload);

      expect(activityResponse.statusCode).toBe(201);

      const activity = JSON.parse(activityResponse.payload) as {
        id: string;

        tenantId: string;

        campaignId: string;

        campaignProspectId: string;

        establishmentId: string;

        assignmentId: string;

        userId: string;

        reservationId: string;

        type: string;
      };

      expect(activity).toMatchObject({
        tenantId,

        campaignId,

        campaignProspectId: prospectId,

        establishmentId,

        assignmentId,

        userId: prospectorAId,

        reservationId: reservation.reservationId,

        type: 'call',
      });

      /*
       * Step 3:
       * Release the temporary Redis
       * reservation.
       */
      const releaseResponse = await getApp().inject({
        method: 'DELETE',

        url: `${reservationUrl()}/${reservation.reservationId}`,

        headers: {
          authorization: `Bearer ${prospectorAToken}`,
        },
      });

      expect(releaseResponse.statusCode).toBe(200);

      /*
       * Step 4:
       * Immutable activity remains in
       * PostgreSQL after the Redis
       * reservation is released.
       */
      const [storedActivity] = await getDatabase()
        .select()
        .from(prospectActivities)
        .where(eq(prospectActivities.id, activity.id))
        .limit(1);

      expect(storedActivity).toBeDefined();

      expect(storedActivity).toMatchObject({
        id: activity.id,

        tenantId,

        campaignId,

        campaignProspectId: prospectId,

        establishmentId,

        assignmentId,

        userId: prospectorAId,

        reservationId: reservation.reservationId,

        type: 'call',
      });

      /*
       * Step 5:
       * Prospector B attempts direct
       * reservation in Campaign B.
       *
       * RECENT_CONTACT must remain
       * authoritative.
       */
      const blockedReservationResponse = await getApp().inject({
        method: 'POST',

        url: secondReservationUrl(),

        headers: {
          authorization: `Bearer ${prospectorBToken}`,
        },
      });

      expect(blockedReservationResponse.statusCode).toBe(409);

      expect(JSON.parse(blockedReservationResponse.payload)).toMatchObject({
        statusCode: 409,

        message: 'Establishment is in cooling-off period',
      });

      /*
       * Step 6:
       * Advisory endpoint must produce
       * the same RECENT_CONTACT result.
       */
      const collisionResponse = await getApp().inject({
        method: 'GET',

        url: secondCollisionDecisionUrl(),

        headers: {
          authorization: `Bearer ${prospectorBToken}`,
        },
      });

      expect(collisionResponse.statusCode).toBe(200);

      const collisionDecision = JSON.parse(collisionResponse.payload) as {
        decision: string;

        reasonCode: string;

        establishmentId: string;

        conflict: Record<string, unknown>;
      };

      expect(collisionDecision).toEqual({
        decision: 'block',

        reasonCode: 'RECENT_CONTACT',

        establishmentId,

        conflict: {
          expiresAt: expect.any(String),
        },
      });

      /*
       * Public response must not leak
       * internal activity/ownership
       * information.
       */
      expect(collisionDecision.conflict).not.toHaveProperty('userId');

      expect(collisionDecision.conflict).not.toHaveProperty('teamId');

      expect(collisionDecision.conflict).not.toHaveProperty('campaignId');

      expect(collisionDecision.conflict).not.toHaveProperty('campaignProspectId');

      expect(collisionDecision.conflict).not.toHaveProperty('assignmentId');

      expect(collisionDecision.conflict).not.toHaveProperty('activityId');

      expect(collisionDecision.conflict).not.toHaveProperty('activityType');

      expect(collisionDecision.conflict).not.toHaveProperty('occurredAt');
    } finally {
      await clearReservation();

      await clearActivityHistory();

      await clearFollowUps();
    }
  });

  it('rejects timeline reads without authentication', async () => {
    const response = await getApp().inject({
      method: 'GET',

      url: timelineUrl(),
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns immutable prospect activities newest first without leaking internal metadata', async () => {
    await clearActivityHistory();

    const oldestActivityId = randomUUID();
    const middleActivityId = randomUUID();
    const newestActivityId = randomUUID();

    await getDatabase()
      .insert(prospectActivities)
      .values([
        {
          id: oldestActivityId,

          tenantId,

          campaignId,

          campaignProspectId: prospectId,

          establishmentId,

          assignmentId,

          userId: prospectorAId,

          reservationId: randomUUID(),

          type: 'call',

          occurredAt: new Date('2026-09-09T08:00:00.000Z'),

          createdAt: new Date('2026-09-09T08:00:01.000Z'),
        },

        {
          id: middleActivityId,

          tenantId,

          campaignId,

          campaignProspectId: prospectId,

          establishmentId,

          assignmentId,

          userId: prospectorAId,

          reservationId: randomUUID(),

          type: 'email',

          occurredAt: new Date('2026-09-09T09:00:00.000Z'),

          createdAt: new Date('2026-09-09T09:00:01.000Z'),
        },

        {
          id: newestActivityId,

          tenantId,

          campaignId,

          campaignProspectId: prospectId,

          establishmentId,

          assignmentId,

          userId: prospectorBId,

          reservationId: randomUUID(),

          type: 'visit',

          occurredAt: new Date('2026-09-09T10:00:00.000Z'),

          createdAt: new Date('2026-09-09T10:00:01.000Z'),
        },
      ]);

    const response = await getApp().inject({
      method: 'GET',

      url: timelineUrl(),

      headers: {
        authorization: `Bearer ${prospectorAToken}`,
      },
    });

    expect(response.statusCode).toBe(200);

    const body = JSON.parse(response.payload) as {
      items: Array<{
        kind: string;

        id: string;

        occurredAt: string;

        activityType: string;

        actor: {
          userId: string;
        };

        context: {
          campaignId: string;

          campaignProspectId: string;

          establishmentId: string;

          assignmentId: string;
        };

        tenantId?: string;

        reservationId?: string;

        createdAt?: string;
      }>;

      nextCursor: string | null;
    };

    expect(body.items).toHaveLength(3);

    /*
     * Immutable timeline is newest first.
     */
    expect(body.items.map((item) => item.id)).toEqual([
      newestActivityId,
      middleActivityId,
      oldestActivityId,
    ]);

    expect(body.items[0]).toEqual({
      kind: 'activity',

      id: newestActivityId,

      occurredAt: '2026-09-09T10:00:00.000Z',

      activityType: 'visit',

      actor: {
        userId: prospectorBId,
      },

      context: {
        campaignId,

        campaignProspectId: prospectId,

        establishmentId,

        assignmentId,
      },
    });

    /*
     * Internal execution evidence stays private.
     */
    for (const item of body.items) {
      expect(item).not.toHaveProperty('tenantId');

      expect(item).not.toHaveProperty('reservationId');

      expect(item).not.toHaveProperty('createdAt');
    }

    expect(body.nextCursor).toBeNull();
  });

  it('paginates the prospect timeline with an opaque cursor', async () => {
    await clearActivityHistory();

    const oldestActivityId = randomUUID();
    const middleActivityId = randomUUID();
    const newestActivityId = randomUUID();

    await getDatabase()
      .insert(prospectActivities)
      .values([
        {
          id: oldestActivityId,

          tenantId,

          campaignId,

          campaignProspectId: prospectId,

          establishmentId,

          assignmentId,

          userId: prospectorAId,

          reservationId: randomUUID(),

          type: 'call',

          occurredAt: new Date('2026-09-08T08:00:00.000Z'),

          createdAt: new Date('2026-09-08T08:00:01.000Z'),
        },

        {
          id: middleActivityId,

          tenantId,

          campaignId,

          campaignProspectId: prospectId,

          establishmentId,

          assignmentId,

          userId: prospectorAId,

          reservationId: randomUUID(),

          type: 'email',

          occurredAt: new Date('2026-09-08T09:00:00.000Z'),

          createdAt: new Date('2026-09-08T09:00:01.000Z'),
        },

        {
          id: newestActivityId,

          tenantId,

          campaignId,

          campaignProspectId: prospectId,

          establishmentId,

          assignmentId,

          userId: prospectorAId,

          reservationId: randomUUID(),

          type: 'message',

          occurredAt: new Date('2026-09-08T10:00:00.000Z'),

          createdAt: new Date('2026-09-08T10:00:01.000Z'),
        },
      ]);

    /*
     * Page 1: newest two.
     */
    const firstResponse = await getApp().inject({
      method: 'GET',

      url: `${timelineUrl()}?limit=2`,

      headers: {
        authorization: `Bearer ${prospectorAToken}`,
      },
    });

    expect(firstResponse.statusCode).toBe(200);

    const firstPage = JSON.parse(firstResponse.payload) as {
      items: Array<{
        id: string;
      }>;

      nextCursor: string | null;
    };

    expect(firstPage.items.map((item) => item.id)).toEqual([newestActivityId, middleActivityId]);

    expect(firstPage.nextCursor).toEqual(expect.any(String));

    if (!firstPage.nextCursor) {
      throw new Error('Expected timeline cursor');
    }

    /*
     * Page 2: remaining oldest row.
     */
    const secondResponse = await getApp().inject({
      method: 'GET',

      url: `${timelineUrl()}?limit=2&cursor=` + encodeURIComponent(firstPage.nextCursor),

      headers: {
        authorization: `Bearer ${prospectorAToken}`,
      },
    });

    expect(secondResponse.statusCode).toBe(200);

    const secondPage = JSON.parse(secondResponse.payload) as {
      items: Array<{
        id: string;
      }>;

      nextCursor: string | null;
    };

    expect(secondPage.items.map((item) => item.id)).toEqual([oldestActivityId]);

    expect(secondPage.nextCursor).toBeNull();
  });

  it('masks timeline access without scope exactly like a nonexistent campaign prospect', async () => {
    const suffix = randomUUID().replaceAll('-', '').slice(0, 10);

    const passwordService = getApp().get(PasswordService);

    const userRepository = getApp().get(UserRepository);

    const email = `timeline-no-access-${suffix}@trackroster.test`;

    const passwordHash = await passwordService.hash(password);

    /*
     * Active authenticated user deliberately has
     * no grant for the target team.
     */
    await userRepository.create({
      tenantId,

      email,

      passwordHash,

      status: 'active',
    });

    const token = (await login(email)).accessToken;

    const outOfScopeResponse = await getApp().inject({
      method: 'GET',

      url: timelineUrl(),

      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    const nonexistentResponse = await getApp().inject({
      method: 'GET',

      url: `/campaigns/${campaignId}` + `/prospects/${randomUUID()}` + '/timeline',

      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(outOfScopeResponse.statusCode).toBe(404);

    expect(nonexistentResponse.statusCode).toBe(404);

    const outOfScopeBody = JSON.parse(outOfScopeResponse.payload) as {
      statusCode: number;

      code: string;

      message: string;

      error: string;

      requestId: string;
    };

    const nonexistentBody = JSON.parse(nonexistentResponse.payload) as {
      statusCode: number;

      code: string;

      message: string;

      error: string;

      requestId: string;
    };

    expect(outOfScopeBody).toMatchObject({
      statusCode: 404,

      code: 'NOT_FOUND',

      message: 'Campaign prospect not found',

      error: 'Not Found',
    });

    expect(nonexistentBody).toMatchObject({
      statusCode: 404,

      code: 'NOT_FOUND',

      message: 'Campaign prospect not found',

      error: 'Not Found',
    });

    expect({
      statusCode: outOfScopeBody.statusCode,

      code: outOfScopeBody.code,

      message: outOfScopeBody.message,

      error: outOfScopeBody.error,
    }).toEqual({
      statusCode: nonexistentBody.statusCode,

      code: nonexistentBody.code,

      message: nonexistentBody.message,

      error: nonexistentBody.error,
    });

    expect(outOfScopeBody.requestId).not.toBe(nonexistentBody.requestId);
  });
});
