import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProspectActivityRepository } from '../activities/prospect-activity.repository.js';
import { CampaignProspectAssignmentRepository } from '../assignments/campaign-prospect-assignment.repository.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { CampaignProspectRepository } from '../campaigns/campaign-prospect.repository.js';
import { CampaignRepository } from '../campaigns/campaign.repository.js';
import { CoordinationCollisionPolicyService } from '../coordination/coordination-collision-policy.service.js';
import { ReservationCoordinationScopeService } from '../coordination/reservation-coordination-scope.service.js';
import { CoolingOffService } from '../cooling-off/cooling-off.service.js';
import { ProspectFollowUpRepository } from '../follow-ups/prospect-follow-up.repository.js';
import { TeamRepository } from '../teams/team.repository.js';
import { UserRepository } from '../users/user.repository.js';
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

    findConflictingCurrentCandidatesByEstablishment: ReturnType<typeof vi.fn>;
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

  let coolingOffService: {
    evaluateActivity: ReturnType<typeof vi.fn>;
  };

  let followUpRepository: {
    findConflictingPendingCandidatesByEstablishment: ReturnType<typeof vi.fn>;
  };

  let prospectActivityRepository: {
    findCandidatesByEstablishment: ReturnType<typeof vi.fn>;
  };

  let coordinationCollisionPolicyService: {
    evaluate: ReturnType<typeof vi.fn>;
  };

  let reservationCoordinationScopeService: {
    resolve: ReturnType<typeof vi.fn>;
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

      findConflictingCurrentCandidatesByEstablishment: vi.fn().mockResolvedValue([]),
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

    coolingOffService = {
      evaluateActivity: vi.fn().mockReturnValue({
        active: false,

        activity: null,

        expiresAt: null,
      }),
    };

    followUpRepository = {
      findConflictingPendingCandidatesByEstablishment: vi.fn().mockResolvedValue([]),
    };

    prospectActivityRepository = {
      findCandidatesByEstablishment: vi.fn().mockResolvedValue([]),
    };

    /*
     * Baseline = SHARED behavior.
     *
     * Assignment is advisory.
     * Other collision types block.
     */
    coordinationCollisionPolicyService = {
      evaluate: vi.fn().mockImplementation((input: { collisionType: string }) => {
        if (input.collisionType === 'active_assignment') {
          return Promise.resolve({
            action: 'warn',

            policy: 'shared',

            delayMinutes: null,
          });
        }

        return Promise.resolve({
          action: 'block',

          policy: 'shared',

          delayMinutes: null,
        });
      }),
    };

    reservationCoordinationScopeService = {
      resolve: vi.fn().mockResolvedValue({
        targetOrganizationId: organizationId,

        blockingOrganizationIds: [organizationId],
      }),
    };

    service = new ReservationService(
      reservationRepository as unknown as ReservationRepository,

      assignmentRepository as unknown as CampaignProspectAssignmentRepository,

      campaignRepository as unknown as CampaignRepository,

      campaignProspectRepository as unknown as CampaignProspectRepository,

      teamRepository as unknown as TeamRepository,

      userRepository as unknown as UserRepository,

      authorizationService as unknown as AuthorizationService,

      coolingOffService as unknown as CoolingOffService,

      followUpRepository as unknown as ProspectFollowUpRepository,

      prospectActivityRepository as unknown as ProspectActivityRepository,

      coordinationCollisionPolicyService as unknown as CoordinationCollisionPolicyService,

      reservationCoordinationScopeService as unknown as ReservationCoordinationScopeService,
    );
  });

  it('acquires an organization-scoped reservation for an eligible prospector', async () => {
    const result = await service.acquire({
      tenantId,

      userId,

      campaignId,

      campaignProspectId: prospectId,
    });

    expect(reservationCoordinationScopeService.resolve).toHaveBeenCalledWith(
      tenantId,
      organizationId,
    );

    expect(reservationRepository.findCurrentCandidatesByOrganizations).toHaveBeenCalledWith(
      tenantId,
      establishmentId,
      [organizationId],
    );

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

    expect(result).toEqual(
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
    );
  });

  it('allows an exact-team prospector to reserve a team-owned assignment', async () => {
    assignmentRepository.findCurrent.mockResolvedValue({
      ...assignment,

      assignedUserId: null,
    });

    const result = await service.acquire({
      tenantId,

      userId,

      campaignId,

      campaignProspectId: prospectId,
    });

    expect(result.userId).toBe(userId);

    expect(reservationRepository.acquireWithinOrganizationScope).toHaveBeenCalledTimes(1);
  });

  it('returns the existing exact reservation for an idempotent retry', async () => {
    reservationRepository.findCurrent.mockResolvedValue(existingReservation);

    await expect(
      service.acquire({
        tenantId,

        userId,

        campaignId,

        campaignProspectId: prospectId,
      }),
    ).resolves.toEqual(existingReservation);

    expect(reservationCoordinationScopeService.resolve).not.toHaveBeenCalled();

    expect(reservationRepository.acquireWithinOrganizationScope).not.toHaveBeenCalled();
  });

  it('rejects a non-idempotent reservation already stored on the exact campaign prospect', async () => {
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
      }),
    ).rejects.toThrow('Campaign prospect is currently reserved');
  });

  it('blocks a legacy tenant-wide reservation during rollout compatibility', async () => {
    reservationRepository.findCurrentByEstablishment.mockResolvedValue(existingReservation);

    await expect(
      service.acquire({
        tenantId,

        userId,

        campaignId,

        campaignProspectId: prospectId,
      }),
    ).rejects.toThrow('Campaign prospect is currently reserved');

    expect(reservationRepository.acquireWithinOrganizationScope).not.toHaveBeenCalled();
  });

  it('blocks a reservation already held inside the organization coordination scope', async () => {
    reservationRepository.findCurrentCandidatesByOrganizations.mockResolvedValue([
      {
        ...existingReservation,

        organizationId: otherOrganizationId,
      },
    ]);

    reservationCoordinationScopeService.resolve.mockResolvedValue({
      targetOrganizationId: organizationId,

      blockingOrganizationIds: [organizationId, otherOrganizationId],
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

  it('ignores an independent planned action', async () => {
    followUpRepository.findConflictingPendingCandidatesByEstablishment.mockResolvedValue([
      createFollowUpCandidate({
        organizationId: otherOrganizationId,
      }),
    ]);

    coordinationCollisionPolicyService.evaluate.mockResolvedValue({
      action: 'ignore',

      policy: 'independent',

      delayMinutes: null,
    });

    await expect(
      service.acquire({
        tenantId,

        userId,

        campaignId,

        campaignProspectId: prospectId,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        organizationId,
        userId,
      }),
    );

    expect(reservationRepository.acquireWithinOrganizationScope).toHaveBeenCalledTimes(1);
  });

  it('blocks an applicable planned action', async () => {
    followUpRepository.findConflictingPendingCandidatesByEstablishment.mockResolvedValue([
      createFollowUpCandidate({
        organizationId: otherOrganizationId,
      }),
    ]);

    coordinationCollisionPolicyService.evaluate.mockResolvedValue({
      action: 'block',

      policy: 'shared',

      delayMinutes: null,
    });

    await expect(
      service.acquire({
        tenantId,

        userId,

        campaignId,

        campaignProspectId: prospectId,
      }),
    ).rejects.toThrow('Establishment has a planned action');
  });

  it('ignores an independent recent activity', async () => {
    prospectActivityRepository.findCandidatesByEstablishment.mockResolvedValue([
      createActivityCandidate({
        organizationId: otherOrganizationId,
      }),
    ]);

    coordinationCollisionPolicyService.evaluate.mockResolvedValue({
      action: 'ignore',

      policy: 'independent',

      delayMinutes: null,
    });

    await expect(
      service.acquire({
        tenantId,

        userId,

        campaignId,

        campaignProspectId: prospectId,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        organizationId,
      }),
    );

    expect(coolingOffService.evaluateActivity).not.toHaveBeenCalled();
  });

  it('blocks an active delayed recent-contact window', async () => {
    const activity = createActivityCandidate({
      organizationId: otherOrganizationId,
    });

    prospectActivityRepository.findCandidatesByEstablishment.mockResolvedValue([activity]);

    coordinationCollisionPolicyService.evaluate.mockResolvedValue({
      action: 'delayed',

      policy: 'delayed',

      delayMinutes: 10_080,
    });

    coolingOffService.evaluateActivity.mockReturnValue({
      active: true,

      activity,

      expiresAt: new Date('2026-09-15T08:00:00.000Z'),
    });

    await expect(
      service.acquire({
        tenantId,

        userId,

        campaignId,

        campaignProspectId: prospectId,
      }),
    ).rejects.toThrow('Establishment is in cooling-off period');

    expect(coolingOffService.evaluateActivity).toHaveBeenCalledWith(
      activity,
      expect.any(Date),
      10_080,
    );
  });

  it('continues when a delayed recent-contact window has expired', async () => {
    const activity = createActivityCandidate({
      organizationId: otherOrganizationId,
    });

    prospectActivityRepository.findCandidatesByEstablishment.mockResolvedValue([activity]);

    coordinationCollisionPolicyService.evaluate.mockResolvedValue({
      action: 'delayed',

      policy: 'delayed',

      delayMinutes: 1440,
    });

    coolingOffService.evaluateActivity.mockReturnValue({
      active: false,

      activity,

      expiresAt: new Date('2026-09-08T08:00:00.000Z'),
    });

    await expect(
      service.acquire({
        tenantId,

        userId,

        campaignId,

        campaignProspectId: prospectId,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        organizationId,
      }),
    );
  });

  it('blocks an active assignment under coordinated policy', async () => {
    assignmentRepository.findConflictingCurrentCandidatesByEstablishment.mockResolvedValue([
      {
        ...assignment,

        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',

        organizationId: otherOrganizationId,

        campaignId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',

        campaignProspectId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      },
    ]);

    coordinationCollisionPolicyService.evaluate.mockResolvedValue({
      action: 'block',

      policy: 'coordinated',

      delayMinutes: null,
    });

    await expect(
      service.acquire({
        tenantId,

        userId,

        campaignId,

        campaignProspectId: prospectId,
      }),
    ).rejects.toThrow('Establishment is assigned to a coordinated organization');
  });

  it('does not block a shared advisory assignment', async () => {
    assignmentRepository.findConflictingCurrentCandidatesByEstablishment.mockResolvedValue([
      {
        ...assignment,

        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',

        organizationId: otherOrganizationId,

        campaignId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',

        campaignProspectId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      },
    ]);

    coordinationCollisionPolicyService.evaluate.mockResolvedValue({
      action: 'warn',

      policy: 'shared',

      delayMinutes: null,
    });

    await expect(
      service.acquire({
        tenantId,

        userId,

        campaignId,

        campaignProspectId: prospectId,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        organizationId,
      }),
    );
  });

  it('returns the reservation when a concurrent same-user acquisition wins first', async () => {
    reservationRepository.acquireWithinOrganizationScope.mockResolvedValue(false);

    reservationRepository.findCurrent
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existingReservation);

    await expect(
      service.acquire({
        tenantId,

        userId,

        campaignId,

        campaignProspectId: prospectId,
      }),
    ).resolves.toEqual(existingReservation);
  });

  it('throws conflict when atomic acquisition loses to another reservation', async () => {
    reservationRepository.acquireWithinOrganizationScope.mockResolvedValue(false);

    reservationRepository.findCurrent.mockResolvedValue(null);

    await expect(
      service.acquire({
        tenantId,

        userId,

        campaignId,

        campaignProspectId: prospectId,
      }),
    ).rejects.toThrow('Campaign prospect is currently reserved');
  });

  it('releases an organization-scoped reservation', async () => {
    reservationRepository.findCurrent.mockResolvedValue(existingReservation);

    reservationRepository.findCurrentByEstablishment.mockResolvedValue(null);

    await expect(
      service.release({
        tenantId,

        userId,

        campaignId,

        campaignProspectId: prospectId,

        reservationId,
      }),
    ).resolves.toEqual({
      released: true,

      reservationId,
    });

    expect(reservationRepository.releaseOrganizationScoped).toHaveBeenCalledWith(
      tenantId,
      campaignId,
      prospectId,
      organizationId,
      establishmentId,
      reservationId,
    );

    expect(reservationRepository.release).not.toHaveBeenCalled();
  });

  it('uses the legacy release path when the old tenant-wide lock belongs to the reservation', async () => {
    reservationRepository.findCurrent.mockResolvedValue(existingReservation);

    reservationRepository.findCurrentByEstablishment.mockResolvedValue(existingReservation);

    await expect(
      service.release({
        tenantId,

        userId,

        campaignId,

        campaignProspectId: prospectId,

        reservationId,
      }),
    ).resolves.toEqual({
      released: true,

      reservationId,
    });

    expect(reservationRepository.release).toHaveBeenCalledWith(
      tenantId,
      campaignId,
      prospectId,
      establishmentId,
      reservationId,
    );

    expect(reservationRepository.releaseOrganizationScoped).not.toHaveBeenCalled();
  });

  it('does not allow another user to release the reservation', async () => {
    reservationRepository.findCurrent.mockResolvedValue(existingReservation);

    await expect(
      service.release({
        tenantId,

        userId: otherUserId,

        campaignId,

        campaignProspectId: prospectId,

        reservationId,
      }),
    ).rejects.toThrow('Reservation belongs to another user');
  });

  it('rejects a reservation when the user lacks the exact team prospector grant', async () => {
    authorizationService.getUserGrants.mockResolvedValue([]);

    await expect(
      service.acquire({
        tenantId,

        userId,

        campaignId,

        campaignProspectId: prospectId,
      }),
    ).rejects.toThrow('User is not a prospector for the assigned team');

    expect(reservationRepository.acquireWithinOrganizationScope).not.toHaveBeenCalled();
  });

  it('fails closed when coordination scope resolution fails', async () => {
    reservationCoordinationScopeService.resolve.mockRejectedValue(
      new Error('Database unavailable'),
    );

    await expect(
      service.acquire({
        tenantId,

        userId,

        campaignId,

        campaignProspectId: prospectId,
      }),
    ).rejects.toThrow('Reservation service is unavailable');
  });

  function createFollowUpCandidate(
    overrides: {
      organizationId?: string;
    } = {},
  ) {
    return {
      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',

      tenantId,

      campaignId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',

      campaignProspectId: '10101010-1010-4010-8010-101010101010',

      establishmentId,

      assignmentId: '11111111-aaaa-4111-8111-111111111111',

      assignedUserId: otherUserId,

      createdBy: otherUserId,

      dueAt: new Date('2026-09-10T10:00:00.000Z'),

      status: 'pending' as const,

      completedAt: null,

      cancelledAt: null,

      createdAt: new Date('2026-09-09T08:00:00.000Z'),

      updatedAt: new Date('2026-09-09T08:00:00.000Z'),

      organizationId: overrides.organizationId ?? otherOrganizationId,
    };
  }

  function createActivityCandidate(
    overrides: {
      organizationId?: string;
    } = {},
  ) {
    return {
      id: '12121212-1212-4212-8212-121212121212',

      tenantId,

      campaignId: '13131313-1313-4313-8313-131313131313',

      campaignProspectId: '14141414-1414-4414-8414-141414141414',

      establishmentId,

      assignmentId: '15151515-1515-4515-8515-151515151515',

      userId: otherUserId,

      reservationId: '16161616-1616-4616-8616-161616161616',

      type: 'call' as const,

      occurredAt: new Date('2026-09-09T07:00:00.000Z'),

      createdAt: new Date('2026-09-09T07:00:00.000Z'),

      organizationId: overrides.organizationId ?? otherOrganizationId,
    };
  }
});
