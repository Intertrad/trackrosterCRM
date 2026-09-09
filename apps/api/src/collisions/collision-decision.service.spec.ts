import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ProspectActivityRepository,
  type ProspectActivityCollisionCandidate,
} from '../activities/prospect-activity.repository.js';
import { CampaignProspectAssignmentRepository } from '../assignments/campaign-prospect-assignment.repository.js';
import { CoordinationCollisionPolicyService } from '../coordination/coordination-collision-policy.service.js';
import { ReservationCoordinationScopeService } from '../coordination/reservation-coordination-scope.service.js';
import { CoolingOffService } from '../cooling-off/cooling-off.service.js';
import { ProspectFollowUpRepository } from '../follow-ups/prospect-follow-up.repository.js';
import { ReservationRepository } from '../reservations/reservation.repository.js';
import { ReservationService } from '../reservations/reservation.service.js';
import type { ProspectReservation } from '../reservations/reservation.types.js';
import { CollisionDecisionService } from './collision-decision.service.js';

describe('CollisionDecisionService', () => {
  let reservationRepository: {
    findCurrent: ReturnType<typeof vi.fn>;

    findCurrentByEstablishment: ReturnType<typeof vi.fn>;

    findCurrentCandidatesByOrganizations: ReturnType<typeof vi.fn>;
  };

  let reservationCoordinationScopeService: {
    resolve: ReturnType<typeof vi.fn>;
  };

  let reservationService: {
    requireReservationEligibility: ReturnType<typeof vi.fn>;
  };

  let coolingOffService: {
    evaluateActivity: ReturnType<typeof vi.fn>;
  };

  let followUpRepository: {
    findConflictingPendingCandidatesByEstablishment: ReturnType<typeof vi.fn>;
  };

  let assignmentRepository: {
    findConflictingCurrentCandidatesByEstablishment: ReturnType<typeof vi.fn>;
  };

  let prospectActivityRepository: {
    findCandidatesByEstablishment: ReturnType<typeof vi.fn>;
  };

  let coordinationCollisionPolicyService: {
    evaluate: ReturnType<typeof vi.fn>;
  };

  let service: CollisionDecisionService;

  const tenantId = '11111111-1111-4111-8111-111111111111';

  const userId = '22222222-2222-4222-8222-222222222222';

  const targetOrganizationId = '33333333-3333-4333-8333-333333333333';

  const independentOrganizationId = '44444444-4444-4444-8444-444444444444';

  const coordinatedOrganizationId = '55555555-5555-4555-8555-555555555555';

  const sharedOrganizationId = '66666666-6666-4666-8666-666666666666';

  const delayedOrganizationId = '77777777-7777-4777-8777-777777777777';

  const campaignId = '88888888-8888-4888-8888-888888888888';

  const campaignProspectId = '99999999-9999-4999-8999-999999999999';

  const establishmentId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  const assignmentId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  const teamId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

  const targetAssignment = {
    id: assignmentId,

    tenantId,

    campaignId,

    campaignProspectId,

    organizationId: targetOrganizationId,

    teamId,

    assignedUserId: userId,

    assignedAt: new Date('2026-09-09T08:00:00.000Z'),

    endedAt: null,
  };

  beforeEach(() => {
    reservationRepository = {
      findCurrent: vi.fn().mockResolvedValue(null),

      findCurrentByEstablishment: vi.fn().mockResolvedValue(null),

      findCurrentCandidatesByOrganizations: vi.fn().mockResolvedValue([]),
    };

    reservationCoordinationScopeService = {
      resolve: vi.fn().mockResolvedValue({
        targetOrganizationId,

        blockingOrganizationIds: [targetOrganizationId],
      }),
    };

    reservationService = {
      requireReservationEligibility: vi.fn().mockResolvedValue({
        assignment: targetAssignment,

        establishmentId,
      }),
    };

    coolingOffService = {
      evaluateActivity: vi.fn(),
    };

    followUpRepository = {
      findConflictingPendingCandidatesByEstablishment: vi.fn().mockResolvedValue([]),
    };

    assignmentRepository = {
      findConflictingCurrentCandidatesByEstablishment: vi.fn().mockResolvedValue([]),
    };

    prospectActivityRepository = {
      findCandidatesByEstablishment: vi.fn().mockResolvedValue([]),
    };

    /*
     * Default coordination behavior represents
     * SHARED semantics so TR-016 remains the safe
     * baseline:
     *
     * planned action  -> block
     * recent contact  -> block
     * assignment      -> warn
     *
     * Active reservation coordination is handled
     * by ReservationCoordinationScopeService before
     * querying Redis organization-scoped keys.
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

    service = new CollisionDecisionService(
      reservationRepository as unknown as ReservationRepository,

      reservationService as unknown as ReservationService,

      coolingOffService as unknown as CoolingOffService,

      followUpRepository as unknown as ProspectFollowUpRepository,

      assignmentRepository as unknown as CampaignProspectAssignmentRepository,

      prospectActivityRepository as unknown as ProspectActivityRepository,

      coordinationCollisionPolicyService as unknown as CoordinationCollisionPolicyService,

      reservationCoordinationScopeService as unknown as ReservationCoordinationScopeService,
    );
  });

  it('allows prospecting when no applicable collision exists', async () => {
    await expect(
      service.evaluate({
        tenantId,

        userId,

        campaignId,

        campaignProspectId,
      }),
    ).resolves.toEqual({
      decision: 'allow',

      reasonCode: 'NO_COLLISION',

      establishmentId,

      conflict: null,
    });

    expect(reservationCoordinationScopeService.resolve).toHaveBeenCalledWith(
      tenantId,
      targetOrganizationId,
    );

    expect(reservationRepository.findCurrentCandidatesByOrganizations).toHaveBeenCalledWith(
      tenantId,
      establishmentId,
      [targetOrganizationId],
    );
  });

  it('allows the caller to continue using their own exact reservation', async () => {
    const reservation: ProspectReservation = {
      reservationId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',

      tenantId,

      organizationId: targetOrganizationId,

      campaignId,

      campaignProspectId,

      establishmentId,

      assignmentId,

      teamId,

      userId,

      acquiredAt: '2026-09-09T08:00:00.000Z',

      expiresAt: '2026-09-09T08:20:00.000Z',
    };

    reservationRepository.findCurrent.mockResolvedValue(reservation);

    await expect(
      service.evaluate({
        tenantId,

        userId,

        campaignId,

        campaignProspectId,
      }),
    ).resolves.toEqual({
      decision: 'allow',

      reasonCode: 'NO_COLLISION',

      establishmentId,

      conflict: null,
    });

    expect(reservationCoordinationScopeService.resolve).not.toHaveBeenCalled();

    expect(reservationRepository.findCurrentByEstablishment).not.toHaveBeenCalled();

    expect(reservationRepository.findCurrentCandidatesByOrganizations).not.toHaveBeenCalled();

    expect(coordinationCollisionPolicyService.evaluate).not.toHaveBeenCalled();
  });

  it('blocks an exact reservation owned by another user', async () => {
    const reservation: ProspectReservation = {
      reservationId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',

      tenantId,

      organizationId: targetOrganizationId,

      campaignId,

      campaignProspectId,

      establishmentId,

      assignmentId,

      teamId,

      userId: '30303030-3030-4030-8030-303030303030',

      acquiredAt: '2026-09-09T08:00:00.000Z',

      expiresAt: '2026-09-09T08:20:00.000Z',
    };

    reservationRepository.findCurrent.mockResolvedValue(reservation);

    const result = await service.evaluate({
      tenantId,

      userId,

      campaignId,

      campaignProspectId,
    });

    expect(result.decision).toBe('block');

    expect(result.reasonCode).toBe('ACTIVE_RESERVATION');

    expect(result.establishmentId).toBe(establishmentId);
  });

  it('blocks a legacy tenant-wide reservation during rollout compatibility', async () => {
    const reservation: ProspectReservation = {
      reservationId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',

      tenantId,

      organizationId: sharedOrganizationId,

      campaignId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',

      campaignProspectId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',

      establishmentId,

      assignmentId: '10101010-1010-4010-8010-101010101010',

      teamId: '20202020-2020-4020-8020-202020202020',

      userId: '30303030-3030-4030-8030-303030303030',

      acquiredAt: '2026-09-09T08:00:00.000Z',

      expiresAt: '2026-09-09T08:20:00.000Z',
    };

    reservationRepository.findCurrentByEstablishment.mockResolvedValue(reservation);

    const result = await service.evaluate({
      tenantId,

      userId,

      campaignId,

      campaignProspectId,
    });

    expect(result.decision).toBe('block');

    expect(result.reasonCode).toBe('ACTIVE_RESERVATION');

    expect(result.establishmentId).toBe(establishmentId);

    expect(reservationCoordinationScopeService.resolve).not.toHaveBeenCalled();

    expect(reservationRepository.findCurrentCandidatesByOrganizations).not.toHaveBeenCalled();
  });

  it('blocks an active reservation in the resolved organization scope', async () => {
    const reservation: ProspectReservation = {
      reservationId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',

      tenantId,

      organizationId: sharedOrganizationId,

      campaignId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',

      campaignProspectId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',

      establishmentId,

      assignmentId: '10101010-1010-4010-8010-101010101010',

      teamId: '20202020-2020-4020-8020-202020202020',

      userId: '30303030-3030-4030-8030-303030303030',

      acquiredAt: '2026-09-09T08:00:00.000Z',

      expiresAt: '2026-09-09T08:20:00.000Z',
    };

    reservationCoordinationScopeService.resolve.mockResolvedValue({
      targetOrganizationId,

      blockingOrganizationIds: [targetOrganizationId, sharedOrganizationId],
    });

    reservationRepository.findCurrentCandidatesByOrganizations.mockResolvedValue([reservation]);

    const result = await service.evaluate({
      tenantId,

      userId,

      campaignId,

      campaignProspectId,
    });

    expect(result.decision).toBe('block');

    expect(result.reasonCode).toBe('ACTIVE_RESERVATION');

    expect(result.establishmentId).toBe(establishmentId);

    expect(reservationRepository.findCurrentCandidatesByOrganizations).toHaveBeenCalledWith(
      tenantId,
      establishmentId,
      [targetOrganizationId, sharedOrganizationId],
    );
  });

  it('uses the resolved organization reservation scope', async () => {
    reservationCoordinationScopeService.resolve.mockResolvedValue({
      targetOrganizationId,

      blockingOrganizationIds: [targetOrganizationId, coordinatedOrganizationId],
    });

    await service.evaluate({
      tenantId,

      userId,

      campaignId,

      campaignProspectId,
    });

    expect(reservationRepository.findCurrentCandidatesByOrganizations).toHaveBeenCalledWith(
      tenantId,
      establishmentId,
      [targetOrganizationId, coordinatedOrganizationId],
    );
  });

  it('does not include an independent organization in the reservation lookup scope', async () => {
    reservationCoordinationScopeService.resolve.mockResolvedValue({
      targetOrganizationId,

      blockingOrganizationIds: [targetOrganizationId, coordinatedOrganizationId],
    });

    await expect(
      service.evaluate({
        tenantId,

        userId,

        campaignId,

        campaignProspectId,
      }),
    ).resolves.toEqual({
      decision: 'allow',

      reasonCode: 'NO_COLLISION',

      establishmentId,

      conflict: null,
    });

    expect(reservationRepository.findCurrentCandidatesByOrganizations).toHaveBeenCalledWith(
      tenantId,
      establishmentId,
      [targetOrganizationId, coordinatedOrganizationId],
    );

    const organizationIds =
      reservationRepository.findCurrentCandidatesByOrganizations.mock.calls[0]?.[2];

    expect(organizationIds).not.toContain(independentOrganizationId);
  });

  it('ignores an independent planned action but still finds a coordinated planned action', async () => {
    followUpRepository.findConflictingPendingCandidatesByEstablishment.mockResolvedValue([
      {
        id: '11111111-aaaa-4111-8111-111111111111',

        tenantId,

        campaignId: '12121212-1212-4212-8212-121212121212',

        campaignProspectId: '13131313-1313-4313-8313-131313131313',

        establishmentId,

        assignmentId: '14141414-1414-4414-8414-141414141414',

        assignedUserId: '15151515-1515-4515-8515-151515151515',

        createdBy: '16161616-1616-4616-8616-161616161616',

        dueAt: new Date('2026-09-10T10:00:00.000Z'),

        status: 'pending',

        completedAt: null,

        cancelledAt: null,

        createdAt: new Date('2026-09-09T08:00:00.000Z'),

        updatedAt: new Date('2026-09-09T08:00:00.000Z'),

        organizationId: independentOrganizationId,
      },

      {
        id: '17171717-1717-4717-8717-171717171717',

        tenantId,

        campaignId: '18181818-1818-4818-8818-181818181818',

        campaignProspectId: '19191919-1919-4919-8919-191919191919',

        establishmentId,

        assignmentId: '20202020-aaaa-4020-8020-202020202020',

        assignedUserId: '21212121-2121-4121-8121-212121212121',

        createdBy: '22222222-aaaa-4222-8222-222222222222',

        dueAt: new Date('2026-09-11T10:00:00.000Z'),

        status: 'pending',

        completedAt: null,

        cancelledAt: null,

        createdAt: new Date('2026-09-09T08:00:00.000Z'),

        updatedAt: new Date('2026-09-09T08:00:00.000Z'),

        organizationId: coordinatedOrganizationId,
      },
    ]);

    coordinationCollisionPolicyService.evaluate.mockImplementation(
      (input: { conflictingOrganizationId: string }) => {
        if (input.conflictingOrganizationId === independentOrganizationId) {
          return Promise.resolve({
            action: 'ignore',

            policy: 'independent',

            delayMinutes: null,
          });
        }

        return Promise.resolve({
          action: 'block',

          policy: 'coordinated',

          delayMinutes: null,
        });
      },
    );

    const result = await service.evaluate({
      tenantId,

      userId,

      campaignId,

      campaignProspectId,
    });

    expect(result.decision).toBe('block');

    expect(result.reasonCode).toBe('PLANNED_ACTION');

    expect(result.conflict).toMatchObject({
      followUpId: '17171717-1717-4717-8717-171717171717',

      dueAt: '2026-09-11T10:00:00.000Z',
    });
  });

  it('blocks recent contact while a delayed coordination window is active', async () => {
    const activity = createActivityCandidate({
      organizationId: delayedOrganizationId,

      occurredAt: new Date('2026-09-08T08:00:00.000Z'),
    });

    prospectActivityRepository.findCandidatesByEstablishment.mockResolvedValue([activity]);

    coordinationCollisionPolicyService.evaluate.mockResolvedValue({
      action: 'delayed',

      policy: 'delayed',

      delayMinutes: 10_080,
    });

    coolingOffService.evaluateActivity.mockImplementation(
      (
        candidate: ProspectActivityCollisionCandidate,

        now: Date,

        coolingOffMinutes: number,
      ) => evaluateCoolingOff(candidate, now, coolingOffMinutes),
    );

    const result = await service.evaluate({
      tenantId,

      userId,

      campaignId,

      campaignProspectId,
    });

    expect(result.decision).toBe('block');

    expect(result.reasonCode).toBe('RECENT_CONTACT');

    expect(result.conflict).toMatchObject({
      activityId: activity.id,

      occurredAt: activity.occurredAt.toISOString(),
    });
  });

  it('allows when a delayed recent-contact window has expired', async () => {
    const activity = createActivityCandidate({
      organizationId: delayedOrganizationId,

      occurredAt: new Date('2026-08-01T08:00:00.000Z'),
    });

    prospectActivityRepository.findCandidatesByEstablishment.mockResolvedValue([activity]);

    coordinationCollisionPolicyService.evaluate.mockResolvedValue({
      action: 'delayed',

      policy: 'delayed',

      delayMinutes: 1_440,
    });

    coolingOffService.evaluateActivity.mockImplementation(
      (
        candidate: ProspectActivityCollisionCandidate,

        now: Date,

        coolingOffMinutes: number,
      ) => evaluateCoolingOff(candidate, now, coolingOffMinutes),
    );

    await expect(
      service.evaluate({
        tenantId,

        userId,

        campaignId,

        campaignProspectId,
      }),
    ).resolves.toEqual({
      decision: 'allow',

      reasonCode: 'NO_COLLISION',

      establishmentId,

      conflict: null,
    });
  });

  it('does not let a newer independent activity hide an older applicable activity', async () => {
    const independentActivity = createActivityCandidate({
      id: '31313131-3131-4131-8131-313131313131',

      organizationId: independentOrganizationId,

      occurredAt: new Date('2026-09-09T07:00:00.000Z'),
    });

    const coordinatedActivity = createActivityCandidate({
      id: '32323232-3232-4232-8232-323232323232',

      organizationId: coordinatedOrganizationId,

      occurredAt: new Date('2026-09-09T06:00:00.000Z'),
    });

    prospectActivityRepository.findCandidatesByEstablishment.mockResolvedValue([
      independentActivity,

      coordinatedActivity,
    ]);

    coordinationCollisionPolicyService.evaluate.mockImplementation(
      (input: { conflictingOrganizationId: string }) => {
        if (input.conflictingOrganizationId === independentOrganizationId) {
          return Promise.resolve({
            action: 'ignore',

            policy: 'independent',

            delayMinutes: null,
          });
        }

        return Promise.resolve({
          action: 'block',

          policy: 'coordinated',

          delayMinutes: null,
        });
      },
    );

    coolingOffService.evaluateActivity.mockImplementation(
      (
        candidate: ProspectActivityCollisionCandidate,

        now: Date,

        coolingOffMinutes?: number,
      ) => evaluateCoolingOff(candidate, now, coolingOffMinutes),
    );

    const result = await service.evaluate({
      tenantId,

      userId,

      campaignId,

      campaignProspectId,
    });

    expect(result.decision).toBe('block');

    expect(result.reasonCode).toBe('RECENT_CONTACT');

    expect(result.conflict).toMatchObject({
      activityId: coordinatedActivity.id,
    });
  });

  it('returns the recent-contact collision with the latest expiry', async () => {
    const firstActivity = createActivityCandidate({
      id: '41414141-4141-4141-8141-414141414141',

      organizationId: sharedOrganizationId,

      occurredAt: new Date('2026-09-09T06:00:00.000Z'),
    });

    const secondActivity = createActivityCandidate({
      id: '42424242-4242-4242-8242-424242424242',

      organizationId: delayedOrganizationId,

      occurredAt: new Date('2026-09-08T06:00:00.000Z'),
    });

    prospectActivityRepository.findCandidatesByEstablishment.mockResolvedValue([
      firstActivity,

      secondActivity,
    ]);

    coordinationCollisionPolicyService.evaluate.mockImplementation(
      (input: { conflictingOrganizationId: string }) => {
        if (input.conflictingOrganizationId === delayedOrganizationId) {
          return Promise.resolve({
            action: 'delayed',

            policy: 'delayed',

            delayMinutes: 10_080,
          });
        }

        return Promise.resolve({
          action: 'block',

          policy: 'shared',

          delayMinutes: null,
        });
      },
    );

    coolingOffService.evaluateActivity.mockImplementation(
      (
        candidate: ProspectActivityCollisionCandidate,

        now: Date,

        coolingOffMinutes?: number,
      ) => evaluateCoolingOff(candidate, now, coolingOffMinutes),
    );

    const result = await service.evaluate({
      tenantId,

      userId,

      campaignId,

      campaignProspectId,
    });

    expect(result.decision).toBe('block');

    expect(result.reasonCode).toBe('RECENT_CONTACT');

    expect(result.conflict).toMatchObject({
      activityId: secondActivity.id,
    });
  });

  it('warns for an active assignment under shared coordination', async () => {
    const assignment = createAssignmentCandidate({
      organizationId: sharedOrganizationId,
    });

    assignmentRepository.findConflictingCurrentCandidatesByEstablishment.mockResolvedValue([
      assignment,
    ]);

    coordinationCollisionPolicyService.evaluate.mockResolvedValue({
      action: 'warn',

      policy: 'shared',

      delayMinutes: null,
    });

    const result = await service.evaluate({
      tenantId,

      userId,

      campaignId,

      campaignProspectId,
    });

    expect(result.decision).toBe('warn');

    expect(result.reasonCode).toBe('ACTIVE_ASSIGNMENT');

    expect(result.conflict).toMatchObject({
      assignmentId: assignment.id,

      organizationId: sharedOrganizationId,
    });
  });

  it('lets a coordinated assignment block even when a shared warning appears first', async () => {
    const sharedAssignment = createAssignmentCandidate({
      id: '51515151-5151-4151-8151-515151515151',

      organizationId: sharedOrganizationId,
    });

    const coordinatedAssignment = createAssignmentCandidate({
      id: '52525252-5252-4252-8252-525252525252',

      organizationId: coordinatedOrganizationId,
    });

    assignmentRepository.findConflictingCurrentCandidatesByEstablishment.mockResolvedValue([
      sharedAssignment,

      coordinatedAssignment,
    ]);

    coordinationCollisionPolicyService.evaluate.mockImplementation(
      (input: { conflictingOrganizationId: string }) => {
        if (input.conflictingOrganizationId === coordinatedOrganizationId) {
          return Promise.resolve({
            action: 'block',

            policy: 'coordinated',

            delayMinutes: null,
          });
        }

        return Promise.resolve({
          action: 'warn',

          policy: 'shared',

          delayMinutes: null,
        });
      },
    );

    const result = await service.evaluate({
      tenantId,

      userId,

      campaignId,

      campaignProspectId,
    });

    expect(result.decision).toBe('block');

    expect(result.reasonCode).toBe('ACTIVE_ASSIGNMENT');

    expect(result.conflict).toMatchObject({
      assignmentId: coordinatedAssignment.id,

      organizationId: coordinatedOrganizationId,
    });
  });

  it('ignores assignments belonging only to independent organizations', async () => {
    const assignment = createAssignmentCandidate({
      organizationId: independentOrganizationId,
    });

    assignmentRepository.findConflictingCurrentCandidatesByEstablishment.mockResolvedValue([
      assignment,
    ]);

    coordinationCollisionPolicyService.evaluate.mockResolvedValue({
      action: 'ignore',

      policy: 'independent',

      delayMinutes: null,
    });

    await expect(
      service.evaluate({
        tenantId,

        userId,

        campaignId,

        campaignProspectId,
      }),
    ).resolves.toEqual({
      decision: 'allow',

      reasonCode: 'NO_COLLISION',

      establishmentId,

      conflict: null,
    });
  });

  it('fails closed when exact reservation lookup fails', async () => {
    reservationRepository.findCurrent.mockRejectedValue(new Error('Redis unavailable'));

    await expect(
      service.evaluate({
        tenantId,

        userId,

        campaignId,

        campaignProspectId,
      }),
    ).rejects.toThrow('Collision service is unavailable');
  });

  it('fails closed when legacy reservation lookup fails', async () => {
    reservationRepository.findCurrentByEstablishment.mockRejectedValue(
      new Error('Redis unavailable'),
    );

    await expect(
      service.evaluate({
        tenantId,

        userId,

        campaignId,

        campaignProspectId,
      }),
    ).rejects.toThrow('Collision service is unavailable');
  });

  it('fails closed when reservation coordination scope resolution fails', async () => {
    reservationCoordinationScopeService.resolve.mockRejectedValue(
      new Error('Database unavailable'),
    );

    await expect(
      service.evaluate({
        tenantId,

        userId,

        campaignId,

        campaignProspectId,
      }),
    ).rejects.toThrow('Collision service is unavailable');
  });

  it('fails closed when organization-scoped reservation lookup fails', async () => {
    reservationRepository.findCurrentCandidatesByOrganizations.mockRejectedValue(
      new Error('Redis unavailable'),
    );

    await expect(
      service.evaluate({
        tenantId,

        userId,

        campaignId,

        campaignProspectId,
      }),
    ).rejects.toThrow('Collision service is unavailable');
  });

  it('fails closed when follow-up candidate lookup fails', async () => {
    followUpRepository.findConflictingPendingCandidatesByEstablishment.mockRejectedValue(
      new Error('Database unavailable'),
    );

    await expect(
      service.evaluate({
        tenantId,

        userId,

        campaignId,

        campaignProspectId,
      }),
    ).rejects.toThrow('Collision service is unavailable');
  });

  it('fails closed when activity candidate lookup fails', async () => {
    prospectActivityRepository.findCandidatesByEstablishment.mockRejectedValue(
      new Error('Database unavailable'),
    );

    await expect(
      service.evaluate({
        tenantId,

        userId,

        campaignId,

        campaignProspectId,
      }),
    ).rejects.toThrow('Collision service is unavailable');
  });

  it('fails closed when assignment candidate lookup fails', async () => {
    assignmentRepository.findConflictingCurrentCandidatesByEstablishment.mockRejectedValue(
      new Error('Database unavailable'),
    );

    await expect(
      service.evaluate({
        tenantId,

        userId,

        campaignId,

        campaignProspectId,
      }),
    ).rejects.toThrow('Collision service is unavailable');
  });

  function createActivityCandidate(
    overrides: Partial<ProspectActivityCollisionCandidate> = {},
  ): ProspectActivityCollisionCandidate {
    return {
      id: '61616161-6161-4161-8161-616161616161',

      tenantId,

      campaignId: '62626262-6262-4262-8262-626262626262',

      campaignProspectId: '63636363-6363-4363-8363-636363636363',

      establishmentId,

      assignmentId: '64646464-6464-4464-8464-646464646464',

      userId: '65656565-6565-4565-8565-656565656565',

      reservationId: '66666666-aaaa-4666-8666-666666666666',

      type: 'call',

      occurredAt: new Date('2026-09-09T07:00:00.000Z'),

      createdAt: new Date('2026-09-09T07:00:00.000Z'),

      organizationId: sharedOrganizationId,

      ...overrides,
    };
  }

  function createAssignmentCandidate(
    overrides: {
      id?: string;

      organizationId?: string;
    } = {},
  ) {
    return {
      id: overrides.id ?? '71717171-7171-4171-8171-717171717171',

      tenantId,

      campaignId: '72727272-7272-4272-8272-727272727272',

      campaignProspectId: '73737373-7373-4373-8373-737373737373',

      organizationId: overrides.organizationId ?? sharedOrganizationId,

      teamId: '74747474-7474-4474-8474-747474747474',

      assignedUserId: '75757575-7575-4575-8575-757575757575',

      assignedAt: new Date('2026-09-09T07:00:00.000Z'),

      endedAt: null,
    };
  }

  function evaluateCoolingOff(
    activity: ProspectActivityCollisionCandidate,

    now: Date,

    coolingOffMinutes = 1_440,
  ) {
    const expiresAt = new Date(activity.occurredAt.getTime() + coolingOffMinutes * 60 * 1000);

    return {
      active: expiresAt.getTime() > now.getTime(),

      activity,

      expiresAt,
    };
  }
});
