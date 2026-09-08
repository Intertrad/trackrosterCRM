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
import { prospectActivities } from '../src/database/schema/prospect-activities.js';
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
  let establishmentId = '';

  let campaignId = '';
  let prospectId = '';
  let assignmentId = '';

  let secondCampaignId = '';
  let secondProspectId = '';

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

    const collisionKey = getReservationRepository().buildCollisionKey(tenantId, establishmentId);

    await getRedis().getClient().del([firstReservationKey, secondReservationKey, collisionKey]);
  }

  async function clearActivityHistory(): Promise<void> {
    if (!database || !tenantId) {
      return;
    }

    await getDatabase().delete(prospectActivities).where(eq(prospectActivities.tenantId, tenantId));
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
     * Canonical establishment shared by both campaigns.
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
     * Both prospectors are eligible to compete.
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
     * Second campaign prospect deliberately points
     * to the SAME canonical establishment.
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
     * Team-only assignment for the second campaign too.
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
  });

  afterAll(async () => {
    try {
      await clearReservation();

      if (database && tenantId) {
        await database.delete(prospectActivities).where(eq(prospectActivities.tenantId, tenantId));

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

      establishmentId: string;

      expiresAt: string;
    };

    expect(body.userId).toBe(prospectorAId);

    expect(body.assignmentId).toBe(assignmentId);

    expect(body.establishmentId).toBe(establishmentId);

    const reservationTtl = await getReservationRepository().ttl(tenantId, campaignId, prospectId);

    const collisionTtl = await getReservationRepository().collisionTtl(tenantId, establishmentId);

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

    expect(acquired.statusCode).toBe(201);

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

  it('releases the reservation and canonical collision lock for its owner', async () => {
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

    const collision = await getReservationRepository().findCurrentByEstablishment(
      tenantId,
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

    const collisionKey = getReservationRepository().buildCollisionKey(tenantId, establishmentId);

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

    const expiredCollision = await getReservationRepository().findCurrentByEstablishment(
      tenantId,
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

    const reservationKey = getReservationRepository().buildKey(tenantId, campaignId, prospectId);

    const collisionKey = getReservationRepository().buildCollisionKey(tenantId, establishmentId);

    await Promise.all([
      getRedis().getClient().expire(reservationKey, 1),

      getRedis().getClient().expire(collisionKey, 1),
    ]);

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

    const collision = await getReservationRepository().findCurrentByEstablishment(
      tenantId,
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

    const canonicalReservation = await getReservationRepository().findCurrentByEstablishment(
      tenantId,
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

    const collision = await getReservationRepository().findCurrentByEstablishment(
      tenantId,
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
  it('allows another campaign to reserve after the first reservation is released', async () => {
    await clearReservation();

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

    const released = await getApp().inject({
      method: 'DELETE',

      url: `${reservationUrl()}/${firstBody.reservationId}`,

      headers: {
        authorization: `Bearer ${prospectorAToken}`,
      },
    });

    expect(released.statusCode).toBe(200);

    const collisionAfterRelease = await getReservationRepository().findCurrentByEstablishment(
      tenantId,
      establishmentId,
    );

    expect(collisionAfterRelease).toBeNull();

    const second = await getApp().inject({
      method: 'POST',

      url: secondReservationUrl(),

      headers: {
        authorization: `Bearer ${prospectorBToken}`,
      },
    });

    expect(second.statusCode).toBe(201);

    const currentCollision = await getReservationRepository().findCurrentByEstablishment(
      tenantId,
      establishmentId,
    );

    expect(currentCollision?.campaignId).toBe(secondCampaignId);

    expect(currentCollision?.campaignProspectId).toBe(secondProspectId);

    expect(currentCollision?.userId).toBe(prospectorBId);
  });

  it('rejects collision decision without authentication', async () => {
    await clearReservation();

    const response = await getApp().inject({
      method: 'GET',

      url: collisionDecisionUrl(),
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns allow when the canonical establishment is not reserved', async () => {
    await clearReservation();

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
      conflict: unknown;
    };

    expect(body).toEqual({
      decision: 'allow',

      reasonCode: 'NO_COLLISION',

      establishmentId,

      conflict: null,
    });
  });

  it('returns block when another campaign reserves the same canonical establishment', async () => {
    await clearReservation();

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
     * The prospector-facing API exposes only
     * information needed to understand the block.
     */
    expect(body.conflict).toHaveProperty('expiresAt');

    expect(body.conflict).not.toHaveProperty('userId');

    expect(body.conflict).not.toHaveProperty('teamId');

    expect(body.conflict).not.toHaveProperty('assignmentId');

    expect(body.conflict).not.toHaveProperty('campaignId');

    expect(body.conflict).not.toHaveProperty('reservationId');
  });

  /*
   * TR-017:
   * A prospector cannot create contact history without
   * owning an active reservation.
   */
  it('rejects activity recording without an active reservation', async () => {
    await clearReservation();
    await clearActivityHistory();

    const response = await getApp().inject({
      method: 'POST',

      url: activityUrl(),

      headers: {
        authorization: `Bearer ${prospectorAToken}`,
      },

      payload: {
        type: 'call',
      },
    });

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
   * TR-017:
   * End-to-end recent-contact protection across campaigns.
   */
  it('blocks a second campaign after recent contact with the same canonical establishment', async () => {
    await clearReservation();
    await clearActivityHistory();

    try {
      /*
       * Step 1:
       * Prospector A reserves Campaign A / Prospect A.
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
       * The client sends only the activity type.
       * Reservation/user/assignment/establishment
       * context is derived by the backend.
       */
      const activityResponse = await getApp().inject({
        method: 'POST',

        url: activityUrl(),

        headers: {
          authorization: `Bearer ${prospectorAToken}`,
        },

        payload: {
          type: 'call',
        },
      });

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
       * Release the temporary Redis reservation.
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
       * The immutable activity remains in PostgreSQL
       * after the Redis reservation is released.
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
       * Prospector B directly attempts reservation
       * in Campaign B without calling collision-decision.
       *
       * The same canonical establishment must still
       * be protected by the cooling-off rule.
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
       * The advisory collision endpoint must reach
       * the same RECENT_CONTACT decision.
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
       * Prospector-facing collision responses must not
       * leak internal ownership or activity metadata.
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
    }
  });
});
