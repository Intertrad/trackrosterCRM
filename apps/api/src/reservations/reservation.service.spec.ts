import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CampaignProspectAssignmentRepository } from '../assignments/campaign-prospect-assignment.repository.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { CampaignProspectRepository } from '../campaigns/campaign-prospect.repository.js';
import { CampaignRepository } from '../campaigns/campaign.repository.js';
import { CollisionBusinessDecisionService } from '../collisions/collision-business-decision.service.js';
import { CollisionOverrideRepository } from '../collisions/collision-override.repository.js';
import type { CollisionOverride } from '../database/schema/collision-overrides.js';
import { ReservationCoordinationScopeService } from '../coordination/reservation-coordination-scope.service.js';
import { TeamRepository } from '../teams/team.repository.js';
import { UserRepository } from '../users/user.repository.js';
import { ReservationExpirySchedulerService } from './reservation-expiry-scheduler.service.js';
import { ReservationRepository } from './reservation.repository.js';
import { ReservationService } from './reservation.service.js';
import type { ProspectReservation } from './reservation.types.js';

describe('ReservationService', () => {
  let reservationRepository: {
    acquireWithinOrganizationScope: ReturnType<typeof vi.fn>;

    findCurrent: ReturnType<typeof vi.fn>;

    findCurrentByEstablishment: ReturnType<typeof vi.fn>;

    findCurrentCandidatesByOrganizations: ReturnType<typeof vi.fn>;

    releaseOrganizationScoped: ReturnType<typeof vi.fn>;

    release: ReturnType<typeof vi.fn>;
  };

  let assignmentRepository: {
    findCurrent: ReturnType<typeof vi.fn>;
  };

  let campaignRepository: {
    findById: ReturnType<typeof vi.fn>;
  };

  let campaignProspectRepository: {
    findById: ReturnType<typeof vi.fn>;
  };

  let teamRepository: {
    findById: ReturnType<typeof vi.fn>;
  };

  let userRepository: {
    findById: ReturnType<typeof vi.fn>;
  };

  let authorizationService: {
    getUserGrants: ReturnType<typeof vi.fn>;
  };

  let collisionBusinessDecisionService: {
    evaluate: ReturnType<typeof vi.fn>;
  };

  let collisionOverrideRepository: {
    findApplicableById: ReturnType<typeof vi.fn>;
  };

  let reservationCoordinationScopeService: {
    resolve: ReturnType<typeof vi.fn>;
  };

  let reservationExpirySchedulerService: {
    schedule: ReturnType<typeof vi.fn>;
  };

  let service: ReservationService;

  const tenantId = '11111111-1111-4111-8111-111111111111';

  const organizationId = '22222222-2222-4222-8222-222222222222';

  const otherOrganizationId = '23232323-2323-4323-8323-232323232323';

  const campaignId = '33333333-3333-4333-8333-333333333333';

  const prospectId = '44444444-4444-4444-8444-444444444444';

  const assignmentId = '55555555-5555-4555-8555-555555555555';

  const teamId = '66666666-6666-4666-8666-666666666666';

  const userId = '77777777-7777-4777-8777-777777777777';

  const otherUserId = '88888888-8888-4888-8888-888888888888';

  const establishmentId = '99999999-9999-4999-8999-999999999999';

  const reservationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  const overrideId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  const followUpId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

  const campaign = {
    id: campaignId,

    tenantId,

    organizationId,

    status: 'active' as const,
  };

  const prospect = {
    id: prospectId,

    tenantId,

    campaignId,

    establishmentId,

    status: 'active' as const,
  };

  const assignment = {
    id: assignmentId,

    tenantId,

    campaignId,

    campaignProspectId: prospectId,

    organizationId,

    teamId,

    assignedUserId: userId,

    assignedAt: new Date('2026-09-09T08:00:00.000Z'),

    endedAt: null,
  };

  const existingReservation: ProspectReservation = {
    reservationId,

    tenantId,

    organizationId,

    campaignId,

    campaignProspectId: prospectId,

    establishmentId,

    assignmentId,

    teamId,

    userId,

    acquiredAt: '2026-09-09T08:00:00.000Z',

    expiresAt: '2026-09-09T08:20:00.000Z',
  };

  function createOverride(overrides: Partial<CollisionOverride> = {}): CollisionOverride {
    return {
      id: overrideId,

      tenantId,

      campaignId,

      campaignProspectId: prospectId,

      establishmentId,

      assignmentId,

      organizationId,

      teamId,

      prospectorUserId: userId,

      approvedByUserId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',

      approvedByRole: 'manager',

      reasonCode: 'PLANNED_ACTION',

      conflictKey: ['planned_action', followUpId, '2026-09-11T10:00:00.000Z'].join(':'),

      conflictSnapshot: {
        followUpId,
      },

      reason: 'Approved after coordination with the other team.',

      expiresAt: new Date('2026-09-10T15:00:00.000Z'),

      createdAt: new Date('2026-09-10T14:00:00.000Z'),

      ...overrides,
    };
  }

  function mockPlannedActionCollision() {
    collisionBusinessDecisionService.evaluate.mockResolvedValue({
      decision: 'block',

      reasonCode: 'PLANNED_ACTION',

      establishmentId,

      conflict: {
        followUpId,

        campaignId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',

        campaignProspectId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',

        assignmentId: '10101010-1010-4010-8010-101010101010',

        assignedUserId: null,

        dueAt: '2026-09-11T10:00:00.000Z',
      },
    });
  }

  beforeEach(() => {
    reservationRepository = {
      acquireWithinOrganizationScope: vi.fn().mockResolvedValue(true),

      findCurrent: vi.fn().mockResolvedValue(null),

      findCurrentByEstablishment: vi.fn().mockResolvedValue(null),

      findCurrentCandidatesByOrganizations: vi.fn().mockResolvedValue([]),

      releaseOrganizationScoped: vi.fn().mockResolvedValue(true),

      release: vi.fn().mockResolvedValue(true),
    };

    assignmentRepository = {
      findCurrent: vi.fn().mockResolvedValue(assignment),
    };

    campaignRepository = {
      findById: vi.fn().mockResolvedValue(campaign),
    };

    campaignProspectRepository = {
      findById: vi.fn().mockResolvedValue(prospect),
    };

    teamRepository = {
      findById: vi.fn().mockResolvedValue({
        id: teamId,

        tenantId,

        organizationId,

        status: 'active',
      }),
    };

    userRepository = {
      findById: vi.fn().mockResolvedValue({
        id: userId,

        tenantId,

        status: 'active',
      }),
    };

    authorizationService = {
      getUserGrants: vi.fn().mockResolvedValue([
        {
          role: 'prospector',

          scopeType: 'team',

          organizationId,

          teamId,
        },
      ]),
    };

    collisionBusinessDecisionService = {
      evaluate: vi.fn().mockResolvedValue({
        decision: 'allow',

        reasonCode: 'NO_COLLISION',

        establishmentId,

        conflict: null,
      }),
    };

    collisionOverrideRepository = {
      findApplicableById: vi.fn(),
    };

    reservationCoordinationScopeService = {
      resolve: vi.fn().mockResolvedValue({
        targetOrganizationId: organizationId,

        blockingOrganizationIds: [organizationId],
      }),
    };

    reservationExpirySchedulerService = {
      schedule: vi.fn().mockResolvedValue(undefined),
    };

    service = new ReservationService(
      reservationRepository as unknown as ReservationRepository,

      assignmentRepository as unknown as CampaignProspectAssignmentRepository,

      campaignRepository as unknown as CampaignRepository,

      campaignProspectRepository as unknown as CampaignProspectRepository,

      teamRepository as unknown as TeamRepository,

      userRepository as unknown as UserRepository,

      authorizationService as unknown as AuthorizationService,

      collisionBusinessDecisionService as unknown as CollisionBusinessDecisionService,

      collisionOverrideRepository as unknown as CollisionOverrideRepository,

      reservationCoordinationScopeService as unknown as ReservationCoordinationScopeService,

      reservationExpirySchedulerService as unknown as ReservationExpirySchedulerService,
    );
  });

  describe('acquire', () => {
    it('acquires a reservation when no collision exists', async () => {
      const result = await service.acquire({
        tenantId,

        userId,

        campaignId,

        campaignProspectId: prospectId,
      });

      expect(result).toMatchObject({
        tenantId,

        organizationId,

        campaignId,

        campaignProspectId: prospectId,

        establishmentId,

        assignmentId,

        teamId,

        userId,
      });

      expect(collisionBusinessDecisionService.evaluate).toHaveBeenCalledWith({
        tenantId,

        userId,

        campaignId,

        campaignProspectId: prospectId,

        establishmentId,

        targetOrganizationId: organizationId,
      });

      expect(reservationRepository.acquireWithinOrganizationScope).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId,

          organizationId,

          campaignId,

          campaignProspectId: prospectId,

          establishmentId,

          assignmentId,

          teamId,

          userId,
        }),

        [organizationId],

        1200,
      );

      expect(reservationExpirySchedulerService.schedule).toHaveBeenCalledTimes(1);
    });

    it('returns an existing exact reservation for an idempotent retry', async () => {
      reservationRepository.findCurrent.mockResolvedValue(existingReservation);

      const result = await service.acquire({
        tenantId,

        userId,

        campaignId,

        campaignProspectId: prospectId,
      });

      expect(result).toEqual(existingReservation);

      expect(collisionBusinessDecisionService.evaluate).not.toHaveBeenCalled();

      expect(reservationRepository.acquireWithinOrganizationScope).not.toHaveBeenCalled();

      expect(reservationExpirySchedulerService.schedule).toHaveBeenCalledWith(existingReservation);
    });

    it('blocks an exact reservation owned by another user', async () => {
      reservationRepository.findCurrent.mockResolvedValue({
        ...existingReservation,

        userId: otherUserId,
      });

      await expect(
        service.acquire({
          tenantId,

          userId,

          campaignId,

          campaignProspectId: prospectId,

          overrideId,
        }),
      ).rejects.toThrow('Campaign prospect is currently reserved');

      expect(collisionOverrideRepository.findApplicableById).not.toHaveBeenCalled();
    });

    it('blocks a legacy tenant-wide active reservation even when overrideId is supplied', async () => {
      reservationRepository.findCurrentByEstablishment.mockResolvedValue({
        ...existingReservation,

        organizationId: otherOrganizationId,

        userId: otherUserId,
      });

      await expect(
        service.acquire({
          tenantId,

          userId,

          campaignId,

          campaignProspectId: prospectId,

          overrideId,
        }),
      ).rejects.toThrow('Campaign prospect is currently reserved');

      expect(collisionBusinessDecisionService.evaluate).not.toHaveBeenCalled();

      expect(collisionOverrideRepository.findApplicableById).not.toHaveBeenCalled();
    });

    it('blocks an organization-scoped active reservation even when overrideId is supplied', async () => {
      reservationRepository.findCurrentCandidatesByOrganizations.mockResolvedValue([
        {
          ...existingReservation,

          organizationId: otherOrganizationId,

          userId: otherUserId,
        },
      ]);

      await expect(
        service.acquire({
          tenantId,

          userId,

          campaignId,

          campaignProspectId: prospectId,

          overrideId,
        }),
      ).rejects.toThrow('Campaign prospect is currently reserved');

      expect(collisionOverrideRepository.findApplicableById).not.toHaveBeenCalled();
    });

    it('blocks a planned action when no override is supplied', async () => {
      mockPlannedActionCollision();

      await expect(
        service.acquire({
          tenantId,

          userId,

          campaignId,

          campaignProspectId: prospectId,
        }),
      ).rejects.toThrow('Establishment has a planned action');

      expect(collisionOverrideRepository.findApplicableById).not.toHaveBeenCalled();

      expect(reservationRepository.acquireWithinOrganizationScope).not.toHaveBeenCalled();
    });

    it('allows reservation with a valid matching planned-action override', async () => {
      mockPlannedActionCollision();

      collisionOverrideRepository.findApplicableById.mockResolvedValue(createOverride());

      const result = await service.acquire({
        tenantId,

        userId,

        campaignId,

        campaignProspectId: prospectId,

        overrideId,
      });

      expect(result).toMatchObject({
        tenantId,

        userId,

        campaignId,

        campaignProspectId: prospectId,
      });

      expect(collisionOverrideRepository.findApplicableById).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId,

          overrideId,

          campaignId,

          campaignProspectId: prospectId,

          prospectorUserId: userId,

          now: expect.any(Date),
        }),
      );

      /*
       * Critical invariant:
       * Redis acquisition still runs after the
       * override is successfully validated.
       */
      expect(reservationRepository.acquireWithinOrganizationScope).toHaveBeenCalledTimes(1);
    });

    it('rejects an invalid or expired override', async () => {
      mockPlannedActionCollision();

      collisionOverrideRepository.findApplicableById.mockResolvedValue(null);

      await expect(
        service.acquire({
          tenantId,

          userId,

          campaignId,

          campaignProspectId: prospectId,

          overrideId,
        }),
      ).rejects.toThrow('Collision override is invalid or expired');

      expect(reservationRepository.acquireWithinOrganizationScope).not.toHaveBeenCalled();
    });

    it('rejects an override bound to another assignment', async () => {
      mockPlannedActionCollision();

      collisionOverrideRepository.findApplicableById.mockResolvedValue(
        createOverride({
          assignmentId: '11111111-aaaa-4111-8111-111111111111',
        }),
      );

      await expect(
        service.acquire({
          tenantId,

          userId,

          campaignId,

          campaignProspectId: prospectId,

          overrideId,
        }),
      ).rejects.toThrow('Collision override does not match current prospect context');

      expect(reservationRepository.acquireWithinOrganizationScope).not.toHaveBeenCalled();
    });

    it('rejects an override bound to another establishment', async () => {
      mockPlannedActionCollision();

      collisionOverrideRepository.findApplicableById.mockResolvedValue(
        createOverride({
          establishmentId: '12121212-1212-4212-8212-121212121212',
        }),
      );

      await expect(
        service.acquire({
          tenantId,

          userId,

          campaignId,

          campaignProspectId: prospectId,

          overrideId,
        }),
      ).rejects.toThrow('Collision override does not match current prospect context');
    });

    it('rejects an override bound to another team', async () => {
      mockPlannedActionCollision();

      collisionOverrideRepository.findApplicableById.mockResolvedValue(
        createOverride({
          teamId: '13131313-1313-4313-8313-131313131313',
        }),
      );

      await expect(
        service.acquire({
          tenantId,

          userId,

          campaignId,

          campaignProspectId: prospectId,

          overrideId,
        }),
      ).rejects.toThrow('Collision override does not match current prospect context');
    });

    it('rejects an override whose reason no longer matches the collision', async () => {
      mockPlannedActionCollision();

      collisionOverrideRepository.findApplicableById.mockResolvedValue(
        createOverride({
          reasonCode: 'RECENT_CONTACT',
        }),
      );

      await expect(
        service.acquire({
          tenantId,

          userId,

          campaignId,

          campaignProspectId: prospectId,

          overrideId,
        }),
      ).rejects.toThrow('Collision override does not match current collision');
    });

    it('rejects a stale override when the exact collision fingerprint changed', async () => {
      mockPlannedActionCollision();

      collisionOverrideRepository.findApplicableById.mockResolvedValue(
        createOverride({
          conflictKey: ['planned_action', followUpId, '2026-09-12T10:00:00.000Z'].join(':'),
        }),
      );

      await expect(
        service.acquire({
          tenantId,

          userId,

          campaignId,

          campaignProspectId: prospectId,

          overrideId,
        }),
      ).rejects.toThrow('Collision override is stale');

      expect(reservationRepository.acquireWithinOrganizationScope).not.toHaveBeenCalled();
    });

    it('rejects an override when no hard collision remains', async () => {
      collisionBusinessDecisionService.evaluate.mockResolvedValue({
        decision: 'allow',

        reasonCode: 'NO_COLLISION',

        establishmentId,

        conflict: null,
      });

      await expect(
        service.acquire({
          tenantId,

          userId,

          campaignId,

          campaignProspectId: prospectId,

          overrideId,
        }),
      ).rejects.toThrow('Collision override is no longer applicable');

      expect(collisionOverrideRepository.findApplicableById).not.toHaveBeenCalled();
    });

    it('rejects an override when collision is advisory only', async () => {
      collisionBusinessDecisionService.evaluate.mockResolvedValue({
        decision: 'warn',

        reasonCode: 'ACTIVE_ASSIGNMENT',

        establishmentId,

        conflict: {
          assignmentId: '14141414-1414-4414-8414-141414141414',

          campaignId: '15151515-1515-4515-8515-151515151515',

          campaignProspectId: '16161616-1616-4616-8616-161616161616',

          organizationId: otherOrganizationId,

          teamId: '17171717-1717-4717-8717-171717171717',

          assignedUserId: null,

          assignedAt: '2026-09-10T08:00:00.000Z',
        },
      });

      await expect(
        service.acquire({
          tenantId,

          userId,

          campaignId,

          campaignProspectId: prospectId,

          overrideId,
        }),
      ).rejects.toThrow('Collision override is no longer applicable');
    });

    it('allows an advisory warning when no override is supplied', async () => {
      collisionBusinessDecisionService.evaluate.mockResolvedValue({
        decision: 'warn',

        reasonCode: 'ACTIVE_ASSIGNMENT',

        establishmentId,

        conflict: {
          assignmentId: '18181818-1818-4818-8818-181818181818',

          campaignId: '19191919-1919-4919-8919-191919191919',

          campaignProspectId: '20202020-2020-4020-8020-202020202020',

          organizationId: otherOrganizationId,

          teamId: '21212121-2121-4121-8121-212121212121',

          assignedUserId: null,

          assignedAt: '2026-09-10T08:00:00.000Z',
        },
      });

      await expect(
        service.acquire({
          tenantId,

          userId,

          campaignId,

          campaignProspectId: prospectId,
        }),
      ).resolves.toMatchObject({
        tenantId,

        userId,

        campaignId,

        campaignProspectId: prospectId,
      });

      expect(reservationRepository.acquireWithinOrganizationScope).toHaveBeenCalledTimes(1);
    });

    it('maps override repository infrastructure failure to service unavailable', async () => {
      mockPlannedActionCollision();

      collisionOverrideRepository.findApplicableById.mockRejectedValue(
        new Error('database unavailable'),
      );

      await expect(
        service.acquire({
          tenantId,

          userId,

          campaignId,

          campaignProspectId: prospectId,

          overrideId,
        }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('returns the winning reservation after an atomic acquisition race when it is owned by the same caller', async () => {
      reservationRepository.acquireWithinOrganizationScope.mockResolvedValue(false);

      reservationRepository.findCurrent
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existingReservation);

      const result = await service.acquire({
        tenantId,

        userId,

        campaignId,

        campaignProspectId: prospectId,
      });

      expect(result).toEqual(existingReservation);

      expect(reservationExpirySchedulerService.schedule).toHaveBeenCalledWith(existingReservation);
    });

    it('rejects when another request wins the atomic acquisition race', async () => {
      reservationRepository.acquireWithinOrganizationScope.mockResolvedValue(false);

      reservationRepository.findCurrent.mockResolvedValueOnce(null).mockResolvedValueOnce({
        ...existingReservation,

        userId: otherUserId,
      });

      await expect(
        service.acquire({
          tenantId,

          userId,

          campaignId,

          campaignProspectId: prospectId,
        }),
      ).rejects.toThrow('Campaign prospect is currently reserved');
    });

    it('maps Redis acquisition errors to service unavailable', async () => {
      reservationRepository.acquireWithinOrganizationScope.mockRejectedValue(
        new Error('Redis unavailable'),
      );

      await expect(
        service.acquire({
          tenantId,

          userId,

          campaignId,

          campaignProspectId: prospectId,
        }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('does not fail an acquired reservation when expiry scheduling fails', async () => {
      reservationExpirySchedulerService.schedule.mockRejectedValue(new Error('queue unavailable'));

      await expect(
        service.acquire({
          tenantId,

          userId,

          campaignId,

          campaignProspectId: prospectId,
        }),
      ).resolves.toMatchObject({
        tenantId,

        campaignId,

        campaignProspectId: prospectId,

        userId,
      });
    });
  });

  describe('requireReservationEligibility', () => {
    it('returns current assignment and canonical establishment', async () => {
      await expect(
        service.requireReservationEligibility({
          tenantId,

          userId,

          campaignId,

          campaignProspectId: prospectId,
        }),
      ).resolves.toEqual({
        assignment,

        establishmentId,
      });
    });

    it('rejects a missing authenticated user before resolving the target', async () => {
      userRepository.findById.mockResolvedValue(null);

      await expect(
        service.requireReservationEligibility({
          tenantId,

          userId,

          campaignId,

          campaignProspectId: prospectId,
        }),
      ).rejects.toThrow('User is not active');

      expect(authorizationService.getUserGrants).not.toHaveBeenCalled();

      expect(campaignRepository.findById).not.toHaveBeenCalled();
    });

    it('rejects an inactive user before resolving the target', async () => {
      userRepository.findById.mockResolvedValue({
        id: userId,

        tenantId,

        status: 'inactive',
      });

      await expect(
        service.requireReservationEligibility({
          tenantId,

          userId,

          campaignId,

          campaignProspectId: prospectId,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(authorizationService.getUserGrants).not.toHaveBeenCalled();

      expect(campaignRepository.findById).not.toHaveBeenCalled();
    });

    it('rejects a caller with no prospector team scope before resolving the target', async () => {
      authorizationService.getUserGrants.mockResolvedValue([]);

      await expect(
        service.requireReservationEligibility({
          tenantId,

          userId,

          campaignId,

          campaignProspectId: prospectId,
        }),
      ).rejects.toThrow('User does not have a prospector team scope');

      expect(campaignRepository.findById).not.toHaveBeenCalled();

      expect(campaignProspectRepository.findById).not.toHaveBeenCalled();

      expect(assignmentRepository.findCurrent).not.toHaveBeenCalled();
    });

    it('returns the masked response for a missing campaign', async () => {
      campaignRepository.findById.mockResolvedValue(null);

      await expect(
        service.requireReservationEligibility({
          tenantId,

          userId,

          campaignId,

          campaignProspectId: prospectId,
        }),
      ).rejects.toThrow('Campaign prospect not found');

      expect(campaignProspectRepository.findById).not.toHaveBeenCalled();

      expect(assignmentRepository.findCurrent).not.toHaveBeenCalled();
    });

    it('rejects an inactive campaign for an authorized prospector', async () => {
      campaignRepository.findById.mockResolvedValue({
        ...campaign,

        status: 'paused',
      });

      await expect(
        service.requireReservationEligibility({
          tenantId,

          userId,

          campaignId,

          campaignProspectId: prospectId,
        }),
      ).rejects.toThrow('Campaign is not active');
    });

    it('returns the masked response for a missing campaign prospect', async () => {
      campaignProspectRepository.findById.mockResolvedValue(null);

      await expect(
        service.requireReservationEligibility({
          tenantId,

          userId,

          campaignId,

          campaignProspectId: prospectId,
        }),
      ).rejects.toThrow('Campaign prospect not found');

      expect(assignmentRepository.findCurrent).not.toHaveBeenCalled();
    });

    it('rejects an inactive campaign prospect for an authorized prospector', async () => {
      campaignProspectRepository.findById.mockResolvedValue({
        ...prospect,

        status: 'inactive',
      });

      await expect(
        service.requireReservationEligibility({
          tenantId,

          userId,

          campaignId,

          campaignProspectId: prospectId,
        }),
      ).rejects.toThrow('Campaign prospect is not active');
    });

    it('masks a prospect without a current assignment', async () => {
      assignmentRepository.findCurrent.mockResolvedValue(null);

      await expect(
        service.requireReservationEligibility({
          tenantId,

          userId,

          campaignId,

          campaignProspectId: prospectId,
        }),
      ).rejects.toThrow('Campaign prospect not found');

      expect(teamRepository.findById).not.toHaveBeenCalled();
    });

    it('masks a prospect assigned to another user', async () => {
      assignmentRepository.findCurrent.mockResolvedValue({
        ...assignment,

        assignedUserId: otherUserId,
      });

      await expect(
        service.requireReservationEligibility({
          tenantId,

          userId,

          campaignId,

          campaignProspectId: prospectId,
        }),
      ).rejects.toThrow('Campaign prospect not found');

      expect(teamRepository.findById).not.toHaveBeenCalled();
    });

    it('masks a prospect outside the caller exact prospector team scope', async () => {
      authorizationService.getUserGrants.mockResolvedValue([
        {
          role: 'prospector',

          scopeType: 'team',

          organizationId,

          teamId: '89898989-8989-4898-8898-898989898989',
        },
      ]);

      await expect(
        service.requireReservationEligibility({
          tenantId,

          userId,

          campaignId,

          campaignProspectId: prospectId,
        }),
      ).rejects.toThrow('Campaign prospect not found');

      expect(teamRepository.findById).not.toHaveBeenCalled();
    });

    it('rejects a missing assigned team after exact authorization is established', async () => {
      teamRepository.findById.mockResolvedValue(null);

      await expect(
        service.requireReservationEligibility({
          tenantId,

          userId,

          campaignId,

          campaignProspectId: prospectId,
        }),
      ).rejects.toThrow('Assigned team not found');
    });

    it('rejects an inactive assigned team after exact authorization is established', async () => {
      teamRepository.findById.mockResolvedValue({
        id: teamId,

        tenantId,

        organizationId,

        status: 'inactive',
      });

      await expect(
        service.requireReservationEligibility({
          tenantId,

          userId,

          campaignId,

          campaignProspectId: prospectId,
        }),
      ).rejects.toThrow('Assigned team is not active');
    });
  });
  describe('getCurrent', () => {
    it('returns owned state for the callers current reservation', async () => {
      reservationRepository.findCurrent.mockResolvedValue(existingReservation);

      await expect(
        service.getCurrent({
          tenantId,

          userId,

          campaignId,

          campaignProspectId: prospectId,
        }),
      ).resolves.toEqual({
        state: 'owned',

        reservationId: existingReservation.reservationId,

        acquiredAt: existingReservation.acquiredAt,

        expiresAt: existingReservation.expiresAt,
      });

      expect(reservationRepository.findCurrent).toHaveBeenCalledWith(
        tenantId,
        campaignId,
        prospectId,
      );
    });

    it('returns none when no active reservation exists', async () => {
      reservationRepository.findCurrent.mockResolvedValue(null);

      await expect(
        service.getCurrent({
          tenantId,

          userId,

          campaignId,

          campaignProspectId: prospectId,
        }),
      ).resolves.toEqual({
        state: 'none',
      });
    });

    it('returns reserved without leaking ownership when another eligible prospector owns it', async () => {
      reservationRepository.findCurrent.mockResolvedValue({
        ...existingReservation,

        userId: otherUserId,
      });

      await expect(
        service.getCurrent({
          tenantId,

          userId,

          campaignId,

          campaignProspectId: prospectId,
        }),
      ).resolves.toEqual({
        state: 'reserved',

        expiresAt: existingReservation.expiresAt,
      });
    });

    it('returns reserved when the reservation belongs to stale assignment context', async () => {
      reservationRepository.findCurrent.mockResolvedValue({
        ...existingReservation,

        assignmentId: '89898989-8989-4898-8898-898989898989',
      });

      await expect(
        service.getCurrent({
          tenantId,

          userId,

          campaignId,

          campaignProspectId: prospectId,
        }),
      ).resolves.toEqual({
        state: 'reserved',

        expiresAt: existingReservation.expiresAt,
      });
    });

    it('returns the masked response when the campaign does not exist', async () => {
      campaignRepository.findById.mockResolvedValue(null);

      await expect(
        service.getCurrent({
          tenantId,

          userId,

          campaignId,

          campaignProspectId: prospectId,
        }),
      ).rejects.toThrow('Campaign prospect not found');

      expect(reservationRepository.findCurrent).not.toHaveBeenCalled();
    });

    it('masks a reservation read when the prospect is assigned to another user', async () => {
      assignmentRepository.findCurrent.mockResolvedValue({
        ...assignment,

        assignedUserId: otherUserId,
      });

      reservationRepository.findCurrent.mockResolvedValue(existingReservation);

      await expect(
        service.getCurrent({
          tenantId,

          userId,

          campaignId,

          campaignProspectId: prospectId,
        }),
      ).rejects.toThrow('Campaign prospect not found');

      expect(reservationRepository.findCurrent).not.toHaveBeenCalled();
    });

    it('rejects reservation reads when the caller has no prospector scope', async () => {
      authorizationService.getUserGrants.mockResolvedValue([]);

      reservationRepository.findCurrent.mockResolvedValue(existingReservation);

      await expect(
        service.getCurrent({
          tenantId,

          userId,

          campaignId,

          campaignProspectId: prospectId,
        }),
      ).rejects.toThrow('User does not have a prospector team scope');

      expect(reservationRepository.findCurrent).not.toHaveBeenCalled();

      expect(campaignRepository.findById).not.toHaveBeenCalled();
    });

    it('masks reservation reads outside the caller exact prospector team scope', async () => {
      authorizationService.getUserGrants.mockResolvedValue([
        {
          role: 'prospector',

          scopeType: 'team',

          organizationId,

          teamId: '89898989-8989-4898-8898-898989898989',
        },
      ]);

      reservationRepository.findCurrent.mockResolvedValue(existingReservation);

      await expect(
        service.getCurrent({
          tenantId,

          userId,

          campaignId,

          campaignProspectId: prospectId,
        }),
      ).rejects.toThrow('Campaign prospect not found');

      expect(reservationRepository.findCurrent).not.toHaveBeenCalled();
    });

    it('maps Redis lookup failure to service unavailable after authorization succeeds', async () => {
      reservationRepository.findCurrent.mockRejectedValue(new Error('Redis unavailable'));

      await expect(
        service.getCurrent({
          tenantId,

          userId,

          campaignId,

          campaignProspectId: prospectId,
        }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });
});
