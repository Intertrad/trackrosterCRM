import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ReservationCoordinationScopeService } from '../coordination/reservation-coordination-scope.service.js';
import { ReservationRepository } from '../reservations/reservation.repository.js';
import { ReservationService } from '../reservations/reservation.service.js';
import type { ProspectReservation } from '../reservations/reservation.types.js';
import { CollisionBusinessDecisionService } from './collision-business-decision.service.js';
import { CollisionDecisionService } from './collision-decision.service.js';

describe('CollisionDecisionService', () => {
  let reservationRepository: {
    findCurrent: ReturnType<typeof vi.fn>;

    findCurrentByEstablishment: ReturnType<typeof vi.fn>;

    findCurrentCandidatesByOrganizations: ReturnType<typeof vi.fn>;
  };

  let reservationService: {
    requireReservationEligibility: ReturnType<typeof vi.fn>;
  };

  let reservationCoordinationScopeService: {
    resolve: ReturnType<typeof vi.fn>;
  };

  let collisionBusinessDecisionService: {
    evaluate: ReturnType<typeof vi.fn>;
  };

  let service: CollisionDecisionService;

  const tenantId = '11111111-1111-4111-8111-111111111111';

  const userId = '22222222-2222-4222-8222-222222222222';

  const targetOrganizationId = '33333333-3333-4333-8333-333333333333';

  const otherOrganizationId = '44444444-4444-4444-8444-444444444444';

  const campaignId = '55555555-5555-4555-8555-555555555555';

  const campaignProspectId = '66666666-6666-4666-8666-666666666666';

  const establishmentId = '77777777-7777-4777-8777-777777777777';

  const assignmentId = '88888888-8888-4888-8888-888888888888';

  const teamId = '99999999-9999-4999-8999-999999999999';

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

  function createReservation(overrides: Partial<ProspectReservation> = {}): ProspectReservation {
    return {
      reservationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',

      tenantId,

      organizationId: targetOrganizationId,

      campaignId,

      campaignProspectId,

      establishmentId,

      assignmentId,

      teamId,

      userId,

      acquiredAt: '2026-09-10T08:00:00.000Z',

      expiresAt: '2026-09-10T08:20:00.000Z',

      ...overrides,
    };
  }

  beforeEach(() => {
    reservationRepository = {
      findCurrent: vi.fn().mockResolvedValue(null),

      findCurrentByEstablishment: vi.fn().mockResolvedValue(null),

      findCurrentCandidatesByOrganizations: vi.fn().mockResolvedValue([]),
    };

    reservationService = {
      requireReservationEligibility: vi.fn().mockResolvedValue({
        assignment: targetAssignment,

        establishmentId,
      }),
    };

    reservationCoordinationScopeService = {
      resolve: vi.fn().mockResolvedValue({
        targetOrganizationId,

        blockingOrganizationIds: [targetOrganizationId],
      }),
    };

    collisionBusinessDecisionService = {
      evaluate: vi.fn().mockResolvedValue({
        decision: 'allow',

        reasonCode: 'NO_COLLISION',

        establishmentId,

        conflict: null,
      }),
    };

    service = new CollisionDecisionService(
      reservationRepository as unknown as ReservationRepository,

      reservationService as unknown as ReservationService,

      reservationCoordinationScopeService as unknown as ReservationCoordinationScopeService,

      collisionBusinessDecisionService as unknown as CollisionBusinessDecisionService,
    );
  });

  it('validates reservation eligibility before collision checks', async () => {
    await service.evaluate({
      tenantId,

      userId,

      campaignId,

      campaignProspectId,
    });

    expect(reservationService.requireReservationEligibility).toHaveBeenCalledWith({
      tenantId,

      userId,

      campaignId,

      campaignProspectId,
    });
  });

  it('allows the caller to continue using their own exact reservation', async () => {
    const reservation = createReservation();

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

    expect(reservationRepository.findCurrentByEstablishment).not.toHaveBeenCalled();

    expect(reservationCoordinationScopeService.resolve).not.toHaveBeenCalled();

    expect(collisionBusinessDecisionService.evaluate).not.toHaveBeenCalled();
  });

  it('blocks an exact reservation owned by another user', async () => {
    const reservation = createReservation({
      userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    });

    reservationRepository.findCurrent.mockResolvedValue(reservation);

    const result = await service.evaluate({
      tenantId,

      userId,

      campaignId,

      campaignProspectId,
    });

    expect(result).toEqual({
      decision: 'block',

      reasonCode: 'ACTIVE_RESERVATION',

      establishmentId,

      conflict: {
        reservationId: reservation.reservationId,

        campaignId: reservation.campaignId,

        campaignProspectId: reservation.campaignProspectId,

        assignmentId: reservation.assignmentId,

        teamId: reservation.teamId,

        userId: reservation.userId,

        acquiredAt: reservation.acquiredAt,

        expiresAt: reservation.expiresAt,
      },
    });

    expect(collisionBusinessDecisionService.evaluate).not.toHaveBeenCalled();
  });

  it('blocks an exact reservation created for another assignment', async () => {
    const reservation = createReservation({
      assignmentId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    });

    reservationRepository.findCurrent.mockResolvedValue(reservation);

    const result = await service.evaluate({
      tenantId,

      userId,

      campaignId,

      campaignProspectId,
    });

    expect(result.decision).toBe('block');

    expect(result.reasonCode).toBe('ACTIVE_RESERVATION');

    expect(collisionBusinessDecisionService.evaluate).not.toHaveBeenCalled();
  });

  it('blocks a legacy tenant-wide reservation', async () => {
    const legacyReservation = createReservation({
      reservationId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',

      organizationId: otherOrganizationId,

      campaignId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',

      campaignProspectId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',

      assignmentId: '10101010-1010-4010-8010-101010101010',

      teamId: '20202020-2020-4020-8020-202020202020',

      userId: '30303030-3030-4030-8030-303030303030',
    });

    reservationRepository.findCurrentByEstablishment.mockResolvedValue(legacyReservation);

    const result = await service.evaluate({
      tenantId,

      userId,

      campaignId,

      campaignProspectId,
    });

    expect(result.decision).toBe('block');

    expect(result.reasonCode).toBe('ACTIVE_RESERVATION');

    expect(result.conflict).toEqual(
      expect.objectContaining({
        reservationId: legacyReservation.reservationId,

        userId: legacyReservation.userId,
      }),
    );

    expect(reservationCoordinationScopeService.resolve).not.toHaveBeenCalled();

    expect(reservationRepository.findCurrentCandidatesByOrganizations).not.toHaveBeenCalled();

    expect(collisionBusinessDecisionService.evaluate).not.toHaveBeenCalled();
  });

  it('blocks an active reservation in the coordinated organization scope', async () => {
    const otherReservation = createReservation({
      reservationId: '41414141-4141-4141-8141-414141414141',

      organizationId: otherOrganizationId,

      campaignId: '42424242-4242-4242-8242-424242424242',

      campaignProspectId: '43434343-4343-4343-8343-434343434343',

      assignmentId: '44444444-aaaa-4444-8444-444444444444',

      teamId: '45454545-4545-4545-8545-454545454545',

      userId: '46464646-4646-4646-8646-464646464646',
    });

    reservationCoordinationScopeService.resolve.mockResolvedValue({
      targetOrganizationId,

      blockingOrganizationIds: [targetOrganizationId, otherOrganizationId],
    });

    reservationRepository.findCurrentCandidatesByOrganizations.mockResolvedValue([
      otherReservation,
    ]);

    const result = await service.evaluate({
      tenantId,

      userId,

      campaignId,

      campaignProspectId,
    });

    expect(result.decision).toBe('block');

    expect(result.reasonCode).toBe('ACTIVE_RESERVATION');

    expect(reservationRepository.findCurrentCandidatesByOrganizations).toHaveBeenCalledWith(
      tenantId,

      establishmentId,

      [targetOrganizationId, otherOrganizationId],
    );

    expect(collisionBusinessDecisionService.evaluate).not.toHaveBeenCalled();
  });

  it('uses the reservation coordination scope resolved for the target organization', async () => {
    reservationCoordinationScopeService.resolve.mockResolvedValue({
      targetOrganizationId,

      blockingOrganizationIds: [targetOrganizationId, otherOrganizationId],
    });

    await service.evaluate({
      tenantId,

      userId,

      campaignId,

      campaignProspectId,
    });

    expect(reservationCoordinationScopeService.resolve).toHaveBeenCalledWith(
      tenantId,

      targetOrganizationId,
    );

    expect(reservationRepository.findCurrentCandidatesByOrganizations).toHaveBeenCalledWith(
      tenantId,

      establishmentId,

      [targetOrganizationId, otherOrganizationId],
    );
  });

  it('delegates persisted business collision evaluation to CollisionBusinessDecisionService', async () => {
    collisionBusinessDecisionService.evaluate.mockResolvedValue({
      decision: 'block',

      reasonCode: 'PLANNED_ACTION',

      establishmentId,

      conflict: {
        followUpId: '51515151-5151-4151-8151-515151515151',

        campaignId: '52525252-5252-4252-8252-525252525252',

        campaignProspectId: '53535353-5353-4353-8353-535353535353',

        assignmentId: '54545454-5454-4454-8454-545454545454',

        assignedUserId: null,

        dueAt: '2026-09-11T10:00:00.000Z',
      },
    });

    const result = await service.evaluate({
      tenantId,

      userId,

      campaignId,

      campaignProspectId,
    });

    expect(collisionBusinessDecisionService.evaluate).toHaveBeenCalledWith({
      tenantId,

      userId,

      campaignId,

      campaignProspectId,

      establishmentId,

      targetOrganizationId,
    });

    expect(result.reasonCode).toBe('PLANNED_ACTION');

    expect(result.decision).toBe('block');
  });

  it('returns advisory business collision results unchanged', async () => {
    collisionBusinessDecisionService.evaluate.mockResolvedValue({
      decision: 'warn',

      reasonCode: 'ACTIVE_ASSIGNMENT',

      establishmentId,

      conflict: {
        assignmentId: '61616161-6161-4161-8161-616161616161',

        campaignId: '62626262-6262-4262-8262-626262626262',

        campaignProspectId: '63636363-6363-4363-8363-636363636363',

        organizationId: otherOrganizationId,

        teamId: '64646464-6464-4464-8464-646464646464',

        assignedUserId: null,

        assignedAt: '2026-09-10T08:00:00.000Z',
      },
    });

    const result = await service.evaluate({
      tenantId,

      userId,

      campaignId,

      campaignProspectId,
    });

    expect(result.decision).toBe('warn');

    expect(result.reasonCode).toBe('ACTIVE_ASSIGNMENT');
  });

  it('returns allow from the shared business evaluator', async () => {
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

    expect(collisionBusinessDecisionService.evaluate).toHaveBeenCalledTimes(1);
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

    expect(collisionBusinessDecisionService.evaluate).not.toHaveBeenCalled();
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

    expect(collisionBusinessDecisionService.evaluate).not.toHaveBeenCalled();
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

    expect(collisionBusinessDecisionService.evaluate).not.toHaveBeenCalled();
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

    expect(collisionBusinessDecisionService.evaluate).not.toHaveBeenCalled();
  });

  it('propagates a failure from the shared business collision evaluator', async () => {
    collisionBusinessDecisionService.evaluate.mockRejectedValue(
      new Error('Business evaluator failed'),
    );

    await expect(
      service.evaluate({
        tenantId,

        userId,

        campaignId,

        campaignProspectId,
      }),
    ).rejects.toThrow('Business evaluator failed');
  });

  it('does not evaluate persisted business collisions while an active reservation exists', async () => {
    reservationRepository.findCurrentCandidatesByOrganizations.mockResolvedValue([
      createReservation({
        userId: '71717171-7171-4171-8171-717171717171',
      }),
    ]);

    await service.evaluate({
      tenantId,

      userId,

      campaignId,

      campaignProspectId,
    });

    expect(collisionBusinessDecisionService.evaluate).not.toHaveBeenCalled();
  });
});
