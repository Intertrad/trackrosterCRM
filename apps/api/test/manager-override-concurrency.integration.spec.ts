import { randomUUID } from 'node:crypto';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { auditEvents } from '../src/database/schema/audit-events.js';
import { idempotencyRecords } from '../src/database/schema/idempotency-records.js';

import { AppModule } from '../src/app.module.js';
import type { AuthenticationTokens } from '../src/auth/auth.types.js';
import { PasswordService } from '../src/auth/password.service.js';
import { UserAccessGrantRepository } from '../src/authorization/user-access-grant.repository.js';
import type { Database } from '../src/database/database.types.js';
import { campaignProspectAssignments } from '../src/database/schema/campaign-prospect-assignments.js';
import { campaignProspects } from '../src/database/schema/campaign-prospects.js';
import { campaigns } from '../src/database/schema/campaigns.js';
import { collisionOverrides } from '../src/database/schema/collision-overrides.js';
import { establishments } from '../src/database/schema/establishments.js';
import { organizations } from '../src/database/schema/organizations.js';
import { prospectFollowUps } from '../src/database/schema/prospect-follow-ups.js';
import { teams } from '../src/database/schema/teams.js';
import { tenants } from '../src/database/schema/tenants.js';
import { userAccessGrants } from '../src/database/schema/user-access-grants.js';
import { users } from '../src/database/schema/users.js';
import { RedisService } from '../src/redis/redis.service.js';
import { ReservationRepository } from '../src/reservations/reservation.repository.js';
import { TenantService } from '../src/tenants/tenant.service.js';
import { UserRepository } from '../src/users/user.repository.js';
import { getSeedDatabase } from './support/seed.js';

describe('Manager override reservation concurrency integration', () => {
  let app: NestFastifyApplication | undefined;

  let database: Database | undefined;

  let redisService: RedisService | undefined;

  let reservationRepository: ReservationRepository | undefined;

  let tenantId = '';

  let organizationId = '';

  let teamId = '';

  let establishmentId = '';

  let campaignId = '';

  let campaignProspectId = '';

  let assignmentId = '';

  let secondCampaignId = '';

  let secondCampaignProspectId = '';

  let secondAssignmentId = '';

  let prospectorAId = '';

  let prospectorBId = '';

  let managerId = '';

  let prospectorAToken = '';

  let prospectorBToken = '';

  let managerToken = '';

  const password = 'ManagerOverrideConcurrency123!';

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
    return `/campaigns/${campaignId}` + `/prospects/${campaignProspectId}` + '/reservation';
  }

  function collisionOverrideUrl(): string {
    return `/campaigns/${campaignId}` + `/prospects/${campaignProspectId}` + '/collision-overrides';
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
      !reservationRepository ||
      !tenantId ||
      !organizationId ||
      !establishmentId
    ) {
      return;
    }

    const keys: string[] = [];

    if (campaignId && campaignProspectId) {
      keys.push(getReservationRepository().buildKey(tenantId, campaignId, campaignProspectId));
    }

    if (secondCampaignId && secondCampaignProspectId) {
      keys.push(
        getReservationRepository().buildKey(tenantId, secondCampaignId, secondCampaignProspectId),
      );
    }

    /*
     * Legacy TR-016 collision key.
     */
    keys.push(getReservationRepository().buildCollisionKey(tenantId, establishmentId));

    /*
     * TR-017 organization-scoped collision key.
     */
    keys.push(
      getReservationRepository().buildOrganizationCollisionKey(
        tenantId,
        organizationId,
        establishmentId,
      ),
    );

    if (keys.length > 0) {
      await getRedis().getClient().del(keys);
    }
  }

  async function clearCollisionOverrides(): Promise<void> {
    if (!database || !tenantId) {
      return;
    }

    await getDatabase().delete(collisionOverrides).where(eq(collisionOverrides.tenantId, tenantId));
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
     * -------------------------------------------------
     * Tenant
     * -------------------------------------------------
     */
    const tenant = await tenantService.create({
      name: `Override Concurrency Tenant ${suffix}`,

      slug: `override-concurrency-${suffix}`,
    });

    tenantId = tenant.id;

    /*
     * -------------------------------------------------
     * Organization
     * -------------------------------------------------
     */
    const [organization] = await getDatabase()
      .insert(organizations)
      .values({
        tenantId,

        name: 'Override Concurrency Organization',

        slug: `override-org-${suffix}`,

        status: 'active',
      })
      .returning();

    if (!organization) {
      throw new Error('Failed to create organization fixture');
    }

    organizationId = organization.id;

    /*
     * -------------------------------------------------
     * Team
     * -------------------------------------------------
     */
    const [team] = await getDatabase()
      .insert(teams)
      .values({
        tenantId,

        organizationId,

        name: 'Override Concurrency Team',

        slug: `override-team-${suffix}`,

        status: 'active',
      })
      .returning();

    if (!team) {
      throw new Error('Failed to create team fixture');
    }

    teamId = team.id;

    /*
     * -------------------------------------------------
     * Canonical establishment
     * -------------------------------------------------
     */
    const [establishment] = await getDatabase()
      .insert(establishments)
      .values({
        tenantId,

        name: 'Override Concurrency Restaurant',

        normalizedName: 'override concurrency restaurant',

        city: 'Paris',

        countryCode: 'FR',

        source: 'manual',

        status: 'active',
      })
      .returning();

    if (!establishment) {
      throw new Error('Failed to create establishment fixture');
    }

    establishmentId = establishment.id;

    /*
     * -------------------------------------------------
     * First campaign
     * -------------------------------------------------
     */
    const [campaign] = await getDatabase()
      .insert(campaigns)
      .values({
        tenantId,

        organizationId,

        name: 'Override Concurrency Campaign A',

        status: 'active',
      })
      .returning();

    if (!campaign) {
      throw new Error('Failed to create first campaign fixture');
    }

    campaignId = campaign.id;

    /*
     * First campaign prospect.
     */
    const [campaignProspect] = await getDatabase()
      .insert(campaignProspects)
      .values({
        tenantId,

        campaignId,

        establishmentId,

        status: 'active',
      })
      .returning();

    if (!campaignProspect) {
      throw new Error('Failed to create first campaign prospect fixture');
    }

    campaignProspectId = campaignProspect.id;

    /*
     * Team-owned assignment.
     *
     * assignedUserId=null means either exact-team
     * prospector can attempt the reservation.
     */
    const [assignment] = await getDatabase()
      .insert(campaignProspectAssignments)
      .values({
        tenantId,

        campaignId,

        campaignProspectId,

        organizationId,

        teamId,

        assignedUserId: null,
      })
      .returning();

    if (!assignment) {
      throw new Error('Failed to create first assignment fixture');
    }

    assignmentId = assignment.id;

    /*
     * -------------------------------------------------
     * Second campaign
     *
     * Same canonical establishment. Its follow-up
     * will create the PLANNED_ACTION collision.
     * -------------------------------------------------
     */
    const [secondCampaign] = await getDatabase()
      .insert(campaigns)
      .values({
        tenantId,

        organizationId,

        name: 'Override Concurrency Campaign B',

        status: 'active',
      })
      .returning();

    if (!secondCampaign) {
      throw new Error('Failed to create second campaign fixture');
    }

    secondCampaignId = secondCampaign.id;

    const [secondCampaignProspect] = await getDatabase()
      .insert(campaignProspects)
      .values({
        tenantId,

        campaignId: secondCampaignId,

        establishmentId,

        status: 'active',
      })
      .returning();

    if (!secondCampaignProspect) {
      throw new Error('Failed to create second campaign prospect fixture');
    }

    secondCampaignProspectId = secondCampaignProspect.id;

    const [secondAssignment] = await getDatabase()
      .insert(campaignProspectAssignments)
      .values({
        tenantId,

        campaignId: secondCampaignId,

        campaignProspectId: secondCampaignProspectId,

        organizationId,

        teamId,

        assignedUserId: null,
      })
      .returning();

    if (!secondAssignment) {
      throw new Error('Failed to create second assignment fixture');
    }

    secondAssignmentId = secondAssignment.id;

    /*
     * -------------------------------------------------
     * Users
     * -------------------------------------------------
     */
    const passwordHash = await passwordService.hash(password);

    const prospectorAEmail = `override-a-${suffix}@trackroster.test`;

    const prospectorBEmail = `override-b-${suffix}@trackroster.test`;

    const managerEmail = `override-manager-${suffix}@trackroster.test`;

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

    const manager = await userRepository.create({
      tenantId,

      email: managerEmail,

      passwordHash,

      status: 'active',
    });

    prospectorAId = prospectorA.id;

    prospectorBId = prospectorB.id;

    managerId = manager.id;

    /*
     * Both prospectors receive the exact team-level
     * prospector grant required by reservation
     * eligibility.
     */
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

    /*
     * Manager authority is deliberately exact-team
     * scoped.
     */
    await grantRepository.create({
      tenantId,

      userId: managerId,

      role: 'manager',

      scopeType: 'team',

      organizationId,

      teamId,
    });

    prospectorAToken = (await login(prospectorAEmail)).accessToken;

    prospectorBToken = (await login(prospectorBEmail)).accessToken;

    managerToken = (await login(managerEmail)).accessToken;

    await clearReservations();

    await clearCollisionOverrides();

    await clearFollowUps();
  });

  afterAll(async () => {
    try {
      await clearReservations();

      if (database && tenantId) {
        /*
         * Collision overrides contain restrictive
         * tenant-safe FKs to users, assignments,
         * campaigns and teams, so remove them first.
         */
        await getDatabase()
          .delete(collisionOverrides)
          .where(eq(collisionOverrides.tenantId, tenantId));

        await getDatabase()
          .delete(prospectFollowUps)
          .where(eq(prospectFollowUps.tenantId, tenantId));

        await getDatabase()
          .delete(campaignProspectAssignments)
          .where(eq(campaignProspectAssignments.tenantId, tenantId));

        await getDatabase()
          .delete(campaignProspects)
          .where(eq(campaignProspects.tenantId, tenantId));

        await getDatabase().delete(campaigns).where(eq(campaigns.tenantId, tenantId));

        await getDatabase().delete(userAccessGrants).where(eq(userAccessGrants.tenantId, tenantId));

        await getDatabase().delete(establishments).where(eq(establishments.tenantId, tenantId));

        await getDatabase().delete(auditEvents).where(eq(auditEvents.tenantId, tenantId));

        await getDatabase().delete(users).where(eq(users.tenantId, tenantId));

        await getDatabase().delete(teams).where(eq(teams.tenantId, tenantId));

        await getDatabase().delete(organizations).where(eq(organizations.tenantId, tenantId));

        await getDatabase().delete(tenants).where(eq(tenants.id, tenantId));
        await getDatabase()
          .delete(idempotencyRecords)
          .where(eq(idempotencyRecords.tenantId, tenantId));
      }
    } finally {
      if (app) {
        await app.close();
      }
    }
  });

  it('allows exactly one concurrent reservation when both prospectors hold valid manager overrides', async () => {
    await clearReservations();

    await clearCollisionOverrides();

    await clearFollowUps();

    /*
     * -------------------------------------------------
     * Step 1
     *
     * Create a real PLANNED_ACTION collision on the
     * same canonical establishment but another
     * campaign.
     * -------------------------------------------------
     */
    const [followUp] = await getDatabase()
      .insert(prospectFollowUps)
      .values({
        tenantId,

        campaignId: secondCampaignId,

        campaignProspectId: secondCampaignProspectId,

        establishmentId,

        assignmentId: secondAssignmentId,

        /*
         * Team-owned follow-up so both A and B see
         * the same collision.
         */
        assignedUserId: null,

        createdBy: managerId,

        dueAt: new Date(Date.now() + 60 * 60 * 1000),

        status: 'pending',
      })
      .returning();

    if (!followUp) {
      throw new Error('Failed to create planned-action fixture');
    }

    try {
      /*
       * -------------------------------------------------
       * Step 2
       *
       * Without an override the reservation must still
       * be blocked.
       * -------------------------------------------------
       */
      const blockedResponse = await getApp().inject({
        method: 'POST',

        url: reservationUrl(),

        headers: {
          authorization: `Bearer ${prospectorAToken}`,
        },
      });

      expect(blockedResponse.statusCode).toBe(409);

      expect(JSON.parse(blockedResponse.payload)).toMatchObject({
        statusCode: 409,

        message: 'Establishment has a planned action',
      });

      /*
       * -------------------------------------------------
       * Step 3
       *
       * Manager approves the exact same collision for
       * prospector A.
       * -------------------------------------------------
       */
      const overrideAResponse = await getApp().inject({
        method: 'POST',

        url: collisionOverrideUrl(),

        headers: {
          authorization: `Bearer ${managerToken}`,
          'idempotency-key': randomUUID(),
        },

        payload: {
          prospectorUserId: prospectorAId,

          reason: 'Approved for prospector A during the manager override concurrency test.',
        },
      });

      expect(overrideAResponse.statusCode).toBe(201);

      const overrideA = JSON.parse(overrideAResponse.payload) as {
        overrideId: string;

        reasonCode: string;

        approvedByRole: string;

        expiresAt: string;

        createdAt: string;
      };

      expect(overrideA.overrideId).toEqual(expect.any(String));

      expect(overrideA.reasonCode).toBe('PLANNED_ACTION');

      expect(overrideA.approvedByRole).toBe('manager');

      /*
       * -------------------------------------------------
       * Step 4
       *
       * Manager separately approves the same collision
       * for prospector B.
       *
       * Each override is user-bound.
       * -------------------------------------------------
       */
      const overrideBResponse = await getApp().inject({
        method: 'POST',

        url: collisionOverrideUrl(),

        headers: {
          authorization: `Bearer ${managerToken}`,
          'idempotency-key': randomUUID(),
        },

        payload: {
          prospectorUserId: prospectorBId,

          reason: 'Approved for prospector B during the manager override concurrency test.',
        },
      });

      expect(overrideBResponse.statusCode).toBe(201);

      const overrideB = JSON.parse(overrideBResponse.payload) as {
        overrideId: string;

        reasonCode: string;

        approvedByRole: string;
      };

      expect(overrideB.overrideId).toEqual(expect.any(String));

      expect(overrideB.reasonCode).toBe('PLANNED_ACTION');

      expect(overrideB.approvedByRole).toBe('manager');

      expect(overrideB.overrideId).not.toBe(overrideA.overrideId);

      /*
       * Confirm two immutable approvals were really
       * persisted.
       */
      const storedOverrides = await getDatabase()
        .select()
        .from(collisionOverrides)
        .where(eq(collisionOverrides.tenantId, tenantId));

      expect(storedOverrides).toHaveLength(2);

      expect(storedOverrides.map((record) => record.prospectorUserId)).toEqual(
        expect.arrayContaining([prospectorAId, prospectorBId]),
      );

      /*
       * -------------------------------------------------
       * Step 5
       *
       * Both users now possess valid manager approvals.
       *
       * Race them against the SAME campaign prospect.
       *
       * Business authorization may pass for both.
       * Redis mutual exclusion must still allow only
       * one reservation.
       * -------------------------------------------------
       */
      const [first, second] = await Promise.all([
        getApp().inject({
          method: 'POST',

          url: reservationUrl(),

          headers: {
            authorization: `Bearer ${prospectorAToken}`,
          },

          payload: {
            overrideId: overrideA.overrideId,
          },
        }),

        getApp().inject({
          method: 'POST',

          url: reservationUrl(),

          headers: {
            authorization: `Bearer ${prospectorBToken}`,
          },

          payload: {
            overrideId: overrideB.overrideId,
          },
        }),
      ]);

      const responses = [first, second];

      const successes = responses.filter((response) => response.statusCode === 201);

      const conflicts = responses.filter((response) => response.statusCode === 409);

      /*
       * Core TR-022 invariant.
       */
      expect(successes).toHaveLength(1);

      expect(conflicts).toHaveLength(1);

      const winningResponse = successes[0];

      if (!winningResponse) {
        throw new Error('Expected one successful reservation');
      }

      const winner = JSON.parse(winningResponse.payload) as {
        reservationId: string;

        tenantId: string;

        organizationId: string;

        campaignId: string;

        campaignProspectId: string;

        establishmentId: string;

        assignmentId: string;

        teamId: string;

        userId: string;

        acquiredAt: string;

        expiresAt: string;
      };

      expect(winner.tenantId).toBe(tenantId);

      expect(winner.organizationId).toBe(organizationId);

      expect(winner.campaignId).toBe(campaignId);

      expect(winner.campaignProspectId).toBe(campaignProspectId);

      expect(winner.establishmentId).toBe(establishmentId);

      expect(winner.assignmentId).toBe(assignmentId);

      expect(winner.teamId).toBe(teamId);

      expect([prospectorAId, prospectorBId]).toContain(winner.userId);

      /*
       * -------------------------------------------------
       * Step 6
       *
       * Redis itself must agree with the HTTP winner.
       * -------------------------------------------------
       */
      const storedReservation = await getReservationRepository().findCurrent(
        tenantId,

        campaignId,

        campaignProspectId,
      );

      expect(storedReservation).not.toBeNull();

      expect(storedReservation?.reservationId).toBe(winner.reservationId);

      expect(storedReservation?.userId).toBe(winner.userId);

      /*
       * -------------------------------------------------
       * Step 7
       *
       * Determine the losing user.
       * -------------------------------------------------
       */
      const winnerIsA = winner.userId === prospectorAId;

      const losingToken = winnerIsA ? prospectorBToken : prospectorAToken;

      const losingOverrideId = winnerIsA ? overrideB.overrideId : overrideA.overrideId;

      /*
       * The loser still possesses a real, valid,
       * unexpired manager approval.
       *
       * That approval MUST NOT bypass the active Redis
       * reservation.
       */
      const losingRetry = await getApp().inject({
        method: 'POST',

        url: reservationUrl(),

        headers: {
          authorization: `Bearer ${losingToken}`,
        },

        payload: {
          overrideId: losingOverrideId,
        },
      });

      expect(losingRetry.statusCode).toBe(409);

      expect(JSON.parse(losingRetry.payload)).toMatchObject({
        statusCode: 409,

        message: 'Campaign prospect is currently reserved',
      });

      /*
       * Redis must still contain the ORIGINAL winner.
       */
      const afterRetry = await getReservationRepository().findCurrent(
        tenantId,

        campaignId,

        campaignProspectId,
      );

      expect(afterRetry?.reservationId).toBe(winner.reservationId);

      expect(afterRetry?.userId).toBe(winner.userId);
    } finally {
      await clearReservations();

      await clearCollisionOverrides();

      await clearFollowUps();
    }
  });
});
