import { randomUUID } from 'node:crypto';
import { auditEvents } from '../src/database/schema/audit-events.js';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { and, eq } from 'drizzle-orm';
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

describe('Manager override HTTP integration', () => {
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

  const password = 'ManagerOverrideIntegration123!';

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
      keys.push(
        getReservationRepository().buildKey(
          tenantId,

          campaignId,

          campaignProspectId,
        ),
      );
    }

    if (secondCampaignId && secondCampaignProspectId) {
      keys.push(
        getReservationRepository().buildKey(
          tenantId,

          secondCampaignId,

          secondCampaignProspectId,
        ),
      );
    }

    keys.push(
      getReservationRepository().buildCollisionKey(
        tenantId,

        establishmentId,
      ),
    );

    keys.push(
      getReservationRepository().buildOrganizationCollisionKey(
        tenantId,

        organizationId,

        establishmentId,
      ),
    );

    await getRedis().getClient().del(keys);
  }

  async function clearCollisionOverrides(): Promise<void> {
    if (!database || !tenantId) {
      return;
    }

    await getDatabase().delete(collisionOverrides).where(
      eq(
        collisionOverrides.tenantId,

        tenantId,
      ),
    );
  }

  async function clearFollowUps(): Promise<void> {
    if (!database || !tenantId) {
      return;
    }

    await getDatabase().delete(prospectFollowUps).where(
      eq(
        prospectFollowUps.tenantId,

        tenantId,
      ),
    );
  }

  async function resetState(): Promise<void> {
    await clearReservations();

    await clearCollisionOverrides();

    await clearFollowUps();
  }

  async function createPlannedAction(dueAt = new Date(Date.now() + 60 * 60 * 1000)) {
    const [followUp] = await getDatabase()
      .insert(prospectFollowUps)
      .values({
        tenantId,

        campaignId: secondCampaignId,

        campaignProspectId: secondCampaignProspectId,

        establishmentId,

        assignmentId: secondAssignmentId,

        assignedUserId: null,

        createdBy: managerId,

        dueAt,

        status: 'pending',
      })
      .returning();

    if (!followUp) {
      throw new Error('Failed to create planned-action fixture');
    }

    return followUp;
  }

  async function requestOverride(
    token: string,

    prospectorUserId: string,

    reason = 'Approved by the manager after reviewing the current prospecting collision.',
  ) {
    return getApp().inject({
      method: 'POST',

      url: collisionOverrideUrl(),

      headers: {
        authorization: `Bearer ${token}`,
      },

      payload: {
        prospectorUserId,

        reason,
      },
    });
  }

  async function findOverride(overrideId: string) {
    const [override] = await getDatabase()
      .select()
      .from(collisionOverrides)
      .where(
        and(
          eq(
            collisionOverrides.tenantId,

            tenantId,
          ),

          eq(
            collisionOverrides.id,

            overrideId,
          ),
        ),
      )
      .limit(1);

    return override ?? null;
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
      name: `Manager Override Tenant ${suffix}`,

      slug: `manager-override-${suffix}`,
    });

    tenantId = tenant.id;

    /*
     * Organization
     */
    const [organization] = await getDatabase()
      .insert(organizations)
      .values({
        tenantId,

        name: 'Manager Override Organization',

        slug: `manager-override-org-${suffix}`,

        status: 'active',
      })
      .returning();

    if (!organization) {
      throw new Error('Failed to create organization fixture');
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

        name: 'Manager Override Team',

        slug: `manager-override-team-${suffix}`,

        status: 'active',
      })
      .returning();

    if (!team) {
      throw new Error('Failed to create team fixture');
    }

    teamId = team.id;

    /*
     * Canonical establishment shared by
     * both campaign contexts.
     */
    const [establishment] = await getDatabase()
      .insert(establishments)
      .values({
        tenantId,

        name: 'Manager Override Restaurant',

        normalizedName: 'manager override restaurant',

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
     * Target campaign.
     */
    const [campaign] = await getDatabase()
      .insert(campaigns)
      .values({
        tenantId,

        organizationId,

        name: 'Manager Override Campaign A',

        status: 'active',
      })
      .returning();

    if (!campaign) {
      throw new Error('Failed to create campaign fixture');
    }

    campaignId = campaign.id;

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
      throw new Error('Failed to create campaign prospect fixture');
    }

    campaignProspectId = campaignProspect.id;

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
      throw new Error('Failed to create assignment fixture');
    }

    assignmentId = assignment.id;

    /*
     * Second campaign creates the conflicting
     * planned action.
     */
    const [secondCampaign] = await getDatabase()
      .insert(campaigns)
      .values({
        tenantId,

        organizationId,

        name: 'Manager Override Campaign B',

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
     * Users
     */
    const passwordHash = await passwordService.hash(password);

    const prospectorAEmail = `manager-override-a-${suffix}@trackroster.test`;

    const prospectorBEmail = `manager-override-b-${suffix}@trackroster.test`;

    const managerEmail = `manager-override-manager-${suffix}@trackroster.test`;

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
     * Both prospectors are eligible for
     * the team-owned assignment.
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
     * Manager has exact-team override authority.
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

    await resetState();
  });

  afterAll(async () => {
    try {
      await clearReservations();

      if (database && tenantId) {
        /*
         * Overrides hold restrictive foreign keys
         * to users, campaigns, teams and assignments.
         */
        await getDatabase().delete(collisionOverrides).where(
          eq(
            collisionOverrides.tenantId,

            tenantId,
          ),
        );

        await getDatabase().delete(prospectFollowUps).where(
          eq(
            prospectFollowUps.tenantId,

            tenantId,
          ),
        );

        await getDatabase().delete(campaignProspectAssignments).where(
          eq(
            campaignProspectAssignments.tenantId,

            tenantId,
          ),
        );

        await getDatabase().delete(campaignProspects).where(
          eq(
            campaignProspects.tenantId,

            tenantId,
          ),
        );

        await getDatabase().delete(campaigns).where(
          eq(
            campaigns.tenantId,

            tenantId,
          ),
        );

        await getDatabase().delete(userAccessGrants).where(
          eq(
            userAccessGrants.tenantId,

            tenantId,
          ),
        );

        await getDatabase().delete(establishments).where(
          eq(
            establishments.tenantId,

            tenantId,
          ),
        );

        await getDatabase().delete(auditEvents).where(
          eq(
            auditEvents.tenantId,

            tenantId,
          ),
        );

        await getDatabase().delete(users).where(
          eq(
            users.tenantId,

            tenantId,
          ),
        );

        await getDatabase().delete(teams).where(
          eq(
            teams.tenantId,

            tenantId,
          ),
        );

        await getDatabase().delete(organizations).where(
          eq(
            organizations.tenantId,

            tenantId,
          ),
        );

        await getDatabase().delete(tenants).where(
          eq(
            tenants.id,

            tenantId,
          ),
        );
      }
    } finally {
      if (app) {
        await app.close();
      }
    }
  });

  it('rejects override creation without authentication', async () => {
    await resetState();

    await createPlannedAction();

    const response = await getApp().inject({
      method: 'POST',

      url: collisionOverrideUrl(),

      payload: {
        prospectorUserId: prospectorAId,

        reason: 'Approved after reviewing the current collision.',
      },
    });

    expect(response.statusCode).toBe(401);

    const stored = await getDatabase().select().from(collisionOverrides).where(
      eq(
        collisionOverrides.tenantId,

        tenantId,
      ),
    );

    expect(stored).toHaveLength(0);
  });

  it('rejects a prospector attempting to approve an override', async () => {
    await resetState();

    await createPlannedAction();

    const response = await requestOverride(
      prospectorBToken,

      prospectorAId,
    );

    expect(response.statusCode).toBe(403);

    expect(JSON.parse(response.payload)).toMatchObject({
      statusCode: 403,

      message: 'User is not authorized to approve an override for this team',
    });

    const stored = await getDatabase().select().from(collisionOverrides).where(
      eq(
        collisionOverrides.tenantId,

        tenantId,
      ),
    );

    expect(stored).toHaveLength(0);
  });

  it('rejects an override reason shorter than the HTTP contract minimum', async () => {
    await resetState();

    await createPlannedAction();

    const response = await requestOverride(
      managerToken,

      prospectorAId,

      'too short',
    );

    expect(response.statusCode).toBe(400);

    const stored = await getDatabase().select().from(collisionOverrides).where(
      eq(
        collisionOverrides.tenantId,

        tenantId,
      ),
    );

    expect(stored).toHaveLength(0);
  });

  it('creates an exact team-scoped manager override and preserves immutable approval evidence after consumption', async () => {
    await resetState();

    const dueAt = new Date(Date.now() + 60 * 60 * 1000);

    const followUp = await createPlannedAction(dueAt);

    const reason = 'Approved after manager review of the planned follow-up collision.';

    const response = await requestOverride(
      managerToken,

      prospectorAId,

      reason,
    );

    expect(response.statusCode).toBe(201);

    const body = JSON.parse(response.payload) as {
      overrideId: string;

      reasonCode: string;

      approvedByRole: string;

      expiresAt: string;

      createdAt: string;
    };

    expect(body).toEqual({
      overrideId: expect.any(String),

      reasonCode: 'PLANNED_ACTION',

      approvedByRole: 'manager',

      expiresAt: expect.any(String),

      createdAt: expect.any(String),
    });

    /*
     * Manager endpoint intentionally does not
     * expose sensitive internal collision evidence.
     */
    expect(body).not.toHaveProperty('conflictKey');

    expect(body).not.toHaveProperty('conflictSnapshot');

    expect(body).not.toHaveProperty('approvedByUserId');

    expect(body).not.toHaveProperty('assignmentId');

    const storedBefore = await findOverride(body.overrideId);

    expect(storedBefore).not.toBeNull();

    expect(storedBefore).toMatchObject({
      tenantId,

      campaignId,

      campaignProspectId,

      establishmentId,

      assignmentId,

      organizationId,

      teamId,

      prospectorUserId: prospectorAId,

      approvedByUserId: managerId,

      approvedByRole: 'manager',

      reasonCode: 'PLANNED_ACTION',

      reason,
    });

    expect(storedBefore?.conflictKey).toBe(`planned_action:${followUp.id}:${dueAt.toISOString()}`);

    expect(storedBefore?.conflictSnapshot).toEqual({
      followUpId: followUp.id,

      campaignId: secondCampaignId,

      campaignProspectId: secondCampaignProspectId,

      assignmentId: secondAssignmentId,

      assignedUserId: null,

      dueAt: dueAt.toISOString(),
    });

    if (!storedBefore) {
      throw new Error('Expected persisted override');
    }

    const ttlMs = storedBefore.expiresAt.getTime() - storedBefore.createdAt.getTime();

    /*
     * Service validity is 10 minutes.
     * Allow a few seconds for DB/server timing.
     */
    expect(ttlMs).toBeGreaterThan(590_000);

    expect(ttlMs).toBeLessThanOrEqual(605_000);

    /*
     * Consume the valid approval.
     */
    const reservationResponse = await getApp().inject({
      method: 'POST',

      url: reservationUrl(),

      headers: {
        authorization: `Bearer ${prospectorAToken}`,
      },

      payload: {
        overrideId: body.overrideId,
      },
    });

    expect(reservationResponse.statusCode).toBe(201);

    /*
     * Consumption does not rewrite or delete
     * the immutable approval record.
     */
    const storedAfter = await findOverride(body.overrideId);

    expect(storedAfter).toEqual(storedBefore);

    expect(storedAfter).not.toHaveProperty('consumedAt');

    await clearReservations();
  });

  it('binds an override to the exact prospector and rejects use by another user', async () => {
    await resetState();

    await createPlannedAction();

    const overrideResponse = await requestOverride(
      managerToken,

      prospectorAId,
    );

    expect(overrideResponse.statusCode).toBe(201);

    const override = JSON.parse(overrideResponse.payload) as {
      overrideId: string;
    };

    /*
     * Prospector B attempts to reuse the approval
     * issued specifically to prospector A.
     */
    const response = await getApp().inject({
      method: 'POST',

      url: reservationUrl(),

      headers: {
        authorization: `Bearer ${prospectorBToken}`,
      },

      payload: {
        overrideId: override.overrideId,
      },
    });

    expect(response.statusCode).toBe(409);

    expect(JSON.parse(response.payload)).toMatchObject({
      statusCode: 409,

      message: 'Collision override is invalid or expired',
    });

    const current = await getReservationRepository().findCurrent(
      tenantId,

      campaignId,

      campaignProspectId,
    );

    expect(current).toBeNull();

    /*
     * Failed use by another user must not destroy
     * the original immutable approval.
     */
    const stored = await findOverride(override.overrideId);

    expect(stored?.prospectorUserId).toBe(prospectorAId);
  });

  it('rejects an override when the exact approved collision has changed', async () => {
    await resetState();

    const originalDueAt = new Date(Date.now() + 60 * 60 * 1000);

    const followUp = await createPlannedAction(originalDueAt);

    const overrideResponse = await requestOverride(
      managerToken,

      prospectorAId,
    );

    expect(overrideResponse.statusCode).toBe(201);

    const override = JSON.parse(overrideResponse.payload) as {
      overrideId: string;
    };

    const storedBefore = await findOverride(override.overrideId);

    expect(storedBefore).not.toBeNull();

    const changedDueAt = new Date(originalDueAt.getTime() + 60 * 60 * 1000);

    /*
     * Change the underlying collision after approval.
     *
     * Same follow-up ID, different dueAt means the
     * deterministic conflict key is no longer the
     * exact collision the manager approved.
     */
    await getDatabase()
      .update(prospectFollowUps)
      .set({
        dueAt: changedDueAt,

        updatedAt: new Date(),
      })
      .where(
        eq(
          prospectFollowUps.id,

          followUp.id,
        ),
      );

    const response = await getApp().inject({
      method: 'POST',

      url: reservationUrl(),

      headers: {
        authorization: `Bearer ${prospectorAToken}`,
      },

      payload: {
        overrideId: override.overrideId,
      },
    });

    expect(response.statusCode).toBe(409);

    const body = JSON.parse(response.payload) as {
      statusCode: number;

      message: string;
    };

    expect(body.statusCode).toBe(409);

    expect(body.message).toContain('stale');

    /*
     * No reservation was allowed.
     */
    const current = await getReservationRepository().findCurrent(
      tenantId,

      campaignId,

      campaignProspectId,
    );

    expect(current).toBeNull();

    /*
     * The approval still preserves the ORIGINAL
     * server-generated snapshot.
     */
    const storedAfter = await findOverride(override.overrideId);

    expect(storedAfter?.conflictSnapshot).toEqual(storedBefore?.conflictSnapshot);

    expect(storedAfter?.conflictKey).toBe(storedBefore?.conflictKey);
  });

  it('rejects an expired override during reservation consumption', async () => {
    await resetState();

    await createPlannedAction();

    const overrideResponse = await requestOverride(
      managerToken,

      prospectorAId,
    );

    expect(overrideResponse.statusCode).toBe(201);

    const validOverride = JSON.parse(overrideResponse.payload) as {
      overrideId: string;
    };

    const stored = await findOverride(validOverride.overrideId);

    if (!stored) {
      throw new Error('Expected persisted override');
    }

    /*
     * Insert a historical copy rather than mutating
     * the immutable approval created by the service.
     *
     * The DB invariant still holds:
     * expiresAt > createdAt.
     *
     * Both timestamps are simply in the past.
     */
    const expiredCreatedAt = new Date(Date.now() - 20 * 60 * 1000);

    const expiredExpiresAt = new Date(Date.now() - 10 * 60 * 1000);

    const [expiredOverride] = await getDatabase()
      .insert(collisionOverrides)
      .values({
        tenantId: stored.tenantId,

        campaignId: stored.campaignId,

        campaignProspectId: stored.campaignProspectId,

        establishmentId: stored.establishmentId,

        assignmentId: stored.assignmentId,

        organizationId: stored.organizationId,

        teamId: stored.teamId,

        prospectorUserId: stored.prospectorUserId,

        approvedByUserId: stored.approvedByUserId,

        approvedByRole: stored.approvedByRole,

        reasonCode: stored.reasonCode,

        conflictKey: stored.conflictKey,

        conflictSnapshot: stored.conflictSnapshot,

        reason: 'Historical approval inserted to verify expiry enforcement.',

        createdAt: expiredCreatedAt,

        expiresAt: expiredExpiresAt,
      })
      .returning();

    if (!expiredOverride) {
      throw new Error('Failed to create expired override fixture');
    }

    const response = await getApp().inject({
      method: 'POST',

      url: reservationUrl(),

      headers: {
        authorization: `Bearer ${prospectorAToken}`,
      },

      payload: {
        overrideId: expiredOverride.id,
      },
    });

    expect(response.statusCode).toBe(409);

    expect(JSON.parse(response.payload)).toMatchObject({
      statusCode: 409,

      message: 'Collision override is invalid or expired',
    });

    const current = await getReservationRepository().findCurrent(
      tenantId,

      campaignId,

      campaignProspectId,
    );

    expect(current).toBeNull();
  });

  it('never allows a manager override to bypass an active reservation', async () => {
    await resetState();

    /*
     * Prospector A acquires the authoritative
     * Redis reservation first.
     */
    const reservationResponse = await getApp().inject({
      method: 'POST',

      url: reservationUrl(),

      headers: {
        authorization: `Bearer ${prospectorAToken}`,
      },
    });

    expect(reservationResponse.statusCode).toBe(201);

    /*
     * Manager now tries to authorize prospector B
     * against the already-reserved prospect.
     */
    const response = await requestOverride(
      managerToken,

      prospectorBId,

      'Manager reviewed the collision but an active reservation already exists.',
    );

    expect(response.statusCode).toBe(409);

    expect(JSON.parse(response.payload)).toMatchObject({
      statusCode: 409,

      message: 'Active reservation cannot be overridden',
    });

    /*
     * ACTIVE_RESERVATION must never create an
     * override record.
     */
    const stored = await getDatabase().select().from(collisionOverrides).where(
      eq(
        collisionOverrides.tenantId,

        tenantId,
      ),
    );

    expect(stored).toHaveLength(0);

    const current = await getReservationRepository().findCurrent(
      tenantId,

      campaignId,

      campaignProspectId,
    );

    expect(current?.userId).toBe(prospectorAId);
  });

  it('refuses to create an override when no collision requires one', async () => {
    await resetState();

    const response = await requestOverride(
      managerToken,

      prospectorAId,
    );

    expect(response.statusCode).toBe(409);

    expect(JSON.parse(response.payload)).toMatchObject({
      statusCode: 409,

      message: 'Current collision does not require an override',
    });

    const stored = await getDatabase().select().from(collisionOverrides).where(
      eq(
        collisionOverrides.tenantId,

        tenantId,
      ),
    );

    expect(stored).toHaveLength(0);
  });
});
