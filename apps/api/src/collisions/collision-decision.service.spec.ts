import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CampaignProspectAssignmentRepository } from '../assignments/campaign-prospect-assignment.repository.js';
import { CoolingOffService } from '../cooling-off/cooling-off.service.js';
import { ProspectFollowUpRepository } from '../follow-ups/prospect-follow-up.repository.js';
import { ReservationRepository } from '../reservations/reservation.repository.js';
import { ReservationService } from '../reservations/reservation.service.js';
import { CollisionDecisionService } from './collision-decision.service.js';

describe('CollisionDecisionService', () => {
  let reservationRepository: {
    findCurrentByEstablishment: ReturnType<typeof vi.fn>;
  };

  let reservationService: {
    requireReservationEligibility: ReturnType<typeof vi.fn>;
  };

  let coolingOffService: {
    evaluate: ReturnType<typeof vi.fn>;
  };

  let followUpRepository: {
    findConflictingPendingByEstablishment: ReturnType<typeof vi.fn>;
  };

  let assignmentRepository: {
    findConflictingCurrentByEstablishment: ReturnType<typeof vi.fn>;
  };

  let service: CollisionDecisionService;

  const tenantId = '11111111-1111-4111-8111-111111111111';

  const establishmentId = '22222222-2222-4222-8222-222222222222';

  const campaignAId = '33333333-3333-4333-8333-333333333333';

  const campaignBId = '44444444-4444-4444-8444-444444444444';

  const prospectAId = '55555555-5555-4555-8555-555555555555';

  const prospectBId = '66666666-6666-4666-8666-666666666666';

  const userId = '77777777-7777-4777-8777-777777777777';

  const otherUserId = '88888888-8888-4888-8888-888888888888';

  const reservation = {
    reservationId: '99999999-9999-4999-8999-999999999999',

    tenantId,

    campaignId: campaignBId,

    campaignProspectId: prospectBId,

    establishmentId,

    assignmentId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',

    teamId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',

    userId: otherUserId,

    acquiredAt: '2026-09-08T08:00:00.000Z',

    expiresAt: '2026-09-08T08:20:00.000Z',
  };

  beforeEach(() => {
    reservationRepository = {
      findCurrentByEstablishment: vi.fn(),
    };

    reservationService = {
      requireReservationEligibility: vi.fn().mockResolvedValue({
        assignment: {
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        },

        establishmentId,
      }),
    };

    followUpRepository = {
      findConflictingPendingByEstablishment: vi.fn().mockResolvedValue(null),
    };

    coolingOffService = {
      evaluate: vi.fn().mockResolvedValue({
        active: false,

        activity: null,

        expiresAt: null,
      }),
    };

    assignmentRepository = {
      findConflictingCurrentByEstablishment: vi.fn().mockResolvedValue(null),
    };

    service = new CollisionDecisionService(
      reservationRepository as unknown as ReservationRepository,

      reservationService as unknown as ReservationService,

      coolingOffService as unknown as CoolingOffService,

      followUpRepository as unknown as ProspectFollowUpRepository,

      assignmentRepository as unknown as CampaignProspectAssignmentRepository,
    );
  });

  it('allows when there is no active reservation, planned action, recent contact, or conflicting assignment', async () => {
    reservationRepository.findCurrentByEstablishment.mockResolvedValue(null);

    await expect(
      service.evaluate({
        tenantId,

        userId,

        campaignId: campaignAId,

        campaignProspectId: prospectAId,
      }),
    ).resolves.toEqual({
      decision: 'allow',

      reasonCode: 'NO_COLLISION',

      establishmentId,

      conflict: null,
    });

    expect(reservationRepository.findCurrentByEstablishment).toHaveBeenCalledWith(
      tenantId,
      establishmentId,
    );

    expect(followUpRepository.findConflictingPendingByEstablishment).toHaveBeenCalledWith(
      tenantId,
      establishmentId,
      campaignAId,
      prospectAId,
      userId,
    );

    expect(coolingOffService.evaluate).toHaveBeenCalledWith(tenantId, establishmentId);

    expect(assignmentRepository.findConflictingCurrentByEstablishment).toHaveBeenCalledWith(
      tenantId,
      establishmentId,
      campaignAId,
      prospectAId,
    );
  });

  it('allows the caller own reservation on the exact target campaign prospect', async () => {
    reservationRepository.findCurrentByEstablishment.mockResolvedValue({
      ...reservation,

      campaignId: campaignAId,

      campaignProspectId: prospectAId,

      userId,
    });

    await expect(
      service.evaluate({
        tenantId,

        userId,

        campaignId: campaignAId,

        campaignProspectId: prospectAId,
      }),
    ).resolves.toEqual({
      decision: 'allow',

      reasonCode: 'NO_COLLISION',

      establishmentId,

      conflict: null,
    });

    expect(followUpRepository.findConflictingPendingByEstablishment).not.toHaveBeenCalled();

    expect(coolingOffService.evaluate).not.toHaveBeenCalled();

    expect(assignmentRepository.findConflictingCurrentByEstablishment).not.toHaveBeenCalled();
  });

  it('blocks when another user reserves the exact target campaign prospect', async () => {
    reservationRepository.findCurrentByEstablishment.mockResolvedValue({
      ...reservation,

      campaignId: campaignAId,

      campaignProspectId: prospectAId,

      userId: otherUserId,
    });

    const result = await service.evaluate({
      tenantId,

      userId,

      campaignId: campaignAId,

      campaignProspectId: prospectAId,
    });

    expect(result).toMatchObject({
      decision: 'block',

      reasonCode: 'ACTIVE_RESERVATION',

      establishmentId,

      conflict: {
        campaignId: campaignAId,

        campaignProspectId: prospectAId,

        userId: otherUserId,
      },
    });

    expect(followUpRepository.findConflictingPendingByEstablishment).not.toHaveBeenCalled();

    expect(coolingOffService.evaluate).not.toHaveBeenCalled();

    expect(assignmentRepository.findConflictingCurrentByEstablishment).not.toHaveBeenCalled();
  });

  it('blocks when another campaign prospect for the same establishment is reserved', async () => {
    reservationRepository.findCurrentByEstablishment.mockResolvedValue(reservation);

    const result = await service.evaluate({
      tenantId,

      userId,

      campaignId: campaignAId,

      campaignProspectId: prospectAId,
    });

    expect(result).toEqual({
      decision: 'block',

      reasonCode: 'ACTIVE_RESERVATION',

      establishmentId,

      conflict: {
        reservationId: reservation.reservationId,

        campaignId: campaignBId,

        campaignProspectId: prospectBId,

        assignmentId: reservation.assignmentId,

        teamId: reservation.teamId,

        userId: otherUserId,

        acquiredAt: reservation.acquiredAt,

        expiresAt: reservation.expiresAt,
      },
    });

    expect(followUpRepository.findConflictingPendingByEstablishment).not.toHaveBeenCalled();

    expect(coolingOffService.evaluate).not.toHaveBeenCalled();

    expect(assignmentRepository.findConflictingCurrentByEstablishment).not.toHaveBeenCalled();
  });

  it('blocks another campaign context even when the caller owns the existing reservation', async () => {
    reservationRepository.findCurrentByEstablishment.mockResolvedValue({
      ...reservation,

      userId,
    });

    const result = await service.evaluate({
      tenantId,

      userId,

      campaignId: campaignAId,

      campaignProspectId: prospectAId,
    });

    expect(result.decision).toBe('block');

    expect(result.reasonCode).toBe('ACTIVE_RESERVATION');

    expect(followUpRepository.findConflictingPendingByEstablishment).not.toHaveBeenCalled();

    expect(coolingOffService.evaluate).not.toHaveBeenCalled();

    expect(assignmentRepository.findConflictingCurrentByEstablishment).not.toHaveBeenCalled();
  });

  it('blocks when another pending follow-up exists for the canonical establishment', async () => {
    reservationRepository.findCurrentByEstablishment.mockResolvedValue(null);

    followUpRepository.findConflictingPendingByEstablishment.mockResolvedValue({
      id: '12121212-1212-4212-8212-121212121212',

      tenantId,

      campaignId: campaignBId,

      campaignProspectId: prospectBId,

      establishmentId,

      assignmentId: '34343434-3434-4434-8434-343434343434',

      assignedUserId: otherUserId,

      createdBy: otherUserId,

      dueAt: new Date('2026-09-10T09:00:00.000Z'),

      status: 'pending',

      completedAt: null,

      cancelledAt: null,

      createdAt: new Date('2026-09-08T12:00:00.000Z'),

      updatedAt: new Date('2026-09-08T12:00:00.000Z'),
    });

    const result = await service.evaluate({
      tenantId,

      userId,

      campaignId: campaignAId,

      campaignProspectId: prospectAId,
    });

    expect(result).toEqual({
      decision: 'block',

      reasonCode: 'PLANNED_ACTION',

      establishmentId,

      conflict: {
        followUpId: '12121212-1212-4212-8212-121212121212',

        campaignId: campaignBId,

        campaignProspectId: prospectBId,

        assignmentId: '34343434-3434-4434-8434-343434343434',

        assignedUserId: otherUserId,

        dueAt: '2026-09-10T09:00:00.000Z',
      },
    });

    expect(followUpRepository.findConflictingPendingByEstablishment).toHaveBeenCalledWith(
      tenantId,
      establishmentId,
      campaignAId,
      prospectAId,
      userId,
    );

    /*
     * Planned action has higher priority than
     * cooling-off and assignment warnings.
     */
    expect(coolingOffService.evaluate).not.toHaveBeenCalled();

    expect(assignmentRepository.findConflictingCurrentByEstablishment).not.toHaveBeenCalled();
  });

  it('blocks when the canonical establishment was contacted recently', async () => {
    reservationRepository.findCurrentByEstablishment.mockResolvedValue(null);

    coolingOffService.evaluate.mockResolvedValue({
      active: true,

      activity: {
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',

        tenantId,

        campaignId: campaignBId,

        campaignProspectId: prospectBId,

        establishmentId,

        assignmentId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',

        userId: otherUserId,

        reservationId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',

        type: 'call',

        occurredAt: new Date('2026-09-08T10:00:00.000Z'),

        createdAt: new Date('2026-09-08T10:00:00.000Z'),
      },

      expiresAt: new Date('2026-09-09T10:00:00.000Z'),
    });

    const result = await service.evaluate({
      tenantId,

      userId,

      campaignId: campaignAId,

      campaignProspectId: prospectAId,
    });

    expect(result).toEqual({
      decision: 'block',

      reasonCode: 'RECENT_CONTACT',

      establishmentId,

      conflict: {
        activityId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',

        activityType: 'call',

        occurredAt: '2026-09-08T10:00:00.000Z',

        expiresAt: '2026-09-09T10:00:00.000Z',
      },
    });

    /*
     * Planned-action lookup happens before
     * cooling-off.
     */
    expect(followUpRepository.findConflictingPendingByEstablishment).toHaveBeenCalledWith(
      tenantId,
      establishmentId,
      campaignAId,
      prospectAId,
      userId,
    );

    expect(assignmentRepository.findConflictingCurrentByEstablishment).not.toHaveBeenCalled();
  });

  it('warns when another active assignment exists for the same canonical establishment', async () => {
    reservationRepository.findCurrentByEstablishment.mockResolvedValue(null);

    coolingOffService.evaluate.mockResolvedValue({
      active: false,

      activity: null,

      expiresAt: null,
    });

    assignmentRepository.findConflictingCurrentByEstablishment.mockResolvedValue({
      id: 'abababab-abab-4bab-8bab-abababababab',

      tenantId,

      campaignId: campaignBId,

      campaignProspectId: prospectBId,

      organizationId: 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd',

      teamId: 'efefefef-efef-4fef-8fef-efefefefefef',

      assignedUserId: otherUserId,

      assignedAt: new Date('2026-09-08T12:00:00.000Z'),

      endedAt: null,
    });

    const result = await service.evaluate({
      tenantId,

      userId,

      campaignId: campaignAId,

      campaignProspectId: prospectAId,
    });

    expect(result).toEqual({
      decision: 'warn',

      reasonCode: 'ACTIVE_ASSIGNMENT',

      establishmentId,

      conflict: {
        assignmentId: 'abababab-abab-4bab-8bab-abababababab',

        campaignId: campaignBId,

        campaignProspectId: prospectBId,

        organizationId: 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd',

        teamId: 'efefefef-efef-4fef-8fef-efefefefefef',

        assignedUserId: otherUserId,

        assignedAt: '2026-09-08T12:00:00.000Z',
      },
    });

    expect(followUpRepository.findConflictingPendingByEstablishment).toHaveBeenCalledWith(
      tenantId,
      establishmentId,
      campaignAId,
      prospectAId,
      userId,
    );

    expect(coolingOffService.evaluate).toHaveBeenCalledWith(tenantId, establishmentId);

    expect(assignmentRepository.findConflictingCurrentByEstablishment).toHaveBeenCalledWith(
      tenantId,
      establishmentId,
      campaignAId,
      prospectAId,
    );
  });

  it('allows when cooling-off exists but has expired and no conflicting assignment exists', async () => {
    reservationRepository.findCurrentByEstablishment.mockResolvedValue(null);

    coolingOffService.evaluate.mockResolvedValue({
      active: false,

      activity: {
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',

        tenantId,

        campaignId: campaignBId,

        campaignProspectId: prospectBId,

        establishmentId,

        assignmentId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',

        userId: otherUserId,

        reservationId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',

        type: 'email',

        occurredAt: new Date('2026-09-07T10:00:00.000Z'),

        createdAt: new Date('2026-09-07T10:00:00.000Z'),
      },

      expiresAt: new Date('2026-09-08T10:00:00.000Z'),
    });

    await expect(
      service.evaluate({
        tenantId,

        userId,

        campaignId: campaignAId,

        campaignProspectId: prospectAId,
      }),
    ).resolves.toEqual({
      decision: 'allow',

      reasonCode: 'NO_COLLISION',

      establishmentId,

      conflict: null,
    });

    expect(followUpRepository.findConflictingPendingByEstablishment).toHaveBeenCalledWith(
      tenantId,
      establishmentId,
      campaignAId,
      prospectAId,
      userId,
    );

    expect(assignmentRepository.findConflictingCurrentByEstablishment).toHaveBeenCalledWith(
      tenantId,
      establishmentId,
      campaignAId,
      prospectAId,
    );
  });

  it('fails before collision lookup when the caller is not eligible for the target', async () => {
    reservationService.requireReservationEligibility.mockRejectedValue(
      new Error('User is not eligible'),
    );

    await expect(
      service.evaluate({
        tenantId,

        userId,

        campaignId: campaignAId,

        campaignProspectId: prospectAId,
      }),
    ).rejects.toThrow('User is not eligible');

    expect(reservationRepository.findCurrentByEstablishment).not.toHaveBeenCalled();

    expect(followUpRepository.findConflictingPendingByEstablishment).not.toHaveBeenCalled();

    expect(coolingOffService.evaluate).not.toHaveBeenCalled();

    expect(assignmentRepository.findConflictingCurrentByEstablishment).not.toHaveBeenCalled();
  });

  it('propagates campaign prospect eligibility failures before collision lookup', async () => {
    reservationService.requireReservationEligibility.mockRejectedValue(
      new Error('Campaign prospect not found'),
    );

    await expect(
      service.evaluate({
        tenantId,

        userId,

        campaignId: campaignAId,

        campaignProspectId: prospectAId,
      }),
    ).rejects.toThrow('Campaign prospect not found');

    expect(reservationRepository.findCurrentByEstablishment).not.toHaveBeenCalled();

    expect(followUpRepository.findConflictingPendingByEstablishment).not.toHaveBeenCalled();

    expect(coolingOffService.evaluate).not.toHaveBeenCalled();

    expect(assignmentRepository.findConflictingCurrentByEstablishment).not.toHaveBeenCalled();
  });

  it('fails closed when the canonical Redis collision lookup fails', async () => {
    reservationRepository.findCurrentByEstablishment.mockRejectedValue(
      new Error('Redis unavailable'),
    );

    await expect(
      service.evaluate({
        tenantId,

        userId,

        campaignId: campaignAId,

        campaignProspectId: prospectAId,
      }),
    ).rejects.toThrow('Collision service is unavailable');

    expect(followUpRepository.findConflictingPendingByEstablishment).not.toHaveBeenCalled();

    expect(coolingOffService.evaluate).not.toHaveBeenCalled();

    expect(assignmentRepository.findConflictingCurrentByEstablishment).not.toHaveBeenCalled();
  });

  it('fails closed when planned-action lookup fails', async () => {
    reservationRepository.findCurrentByEstablishment.mockResolvedValue(null);

    followUpRepository.findConflictingPendingByEstablishment.mockRejectedValue(
      new Error('Database unavailable'),
    );

    await expect(
      service.evaluate({
        tenantId,

        userId,

        campaignId: campaignAId,

        campaignProspectId: prospectAId,
      }),
    ).rejects.toThrow('Collision service is unavailable');

    expect(coolingOffService.evaluate).not.toHaveBeenCalled();

    expect(assignmentRepository.findConflictingCurrentByEstablishment).not.toHaveBeenCalled();
  });

  it('propagates cooling-off infrastructure failure after reservation and planned-action checks are clear', async () => {
    reservationRepository.findCurrentByEstablishment.mockResolvedValue(null);

    coolingOffService.evaluate.mockRejectedValue(new Error('Cooling-off service is unavailable'));

    await expect(
      service.evaluate({
        tenantId,

        userId,

        campaignId: campaignAId,

        campaignProspectId: prospectAId,
      }),
    ).rejects.toThrow('Cooling-off service is unavailable');

    expect(followUpRepository.findConflictingPendingByEstablishment).toHaveBeenCalledWith(
      tenantId,
      establishmentId,
      campaignAId,
      prospectAId,
      userId,
    );

    expect(assignmentRepository.findConflictingCurrentByEstablishment).not.toHaveBeenCalled();
  });

  it('fails closed when active-assignment lookup fails', async () => {
    reservationRepository.findCurrentByEstablishment.mockResolvedValue(null);

    coolingOffService.evaluate.mockResolvedValue({
      active: false,

      activity: null,

      expiresAt: null,
    });

    assignmentRepository.findConflictingCurrentByEstablishment.mockRejectedValue(
      new Error('Database unavailable'),
    );

    await expect(
      service.evaluate({
        tenantId,

        userId,

        campaignId: campaignAId,

        campaignProspectId: prospectAId,
      }),
    ).rejects.toThrow('Collision service is unavailable');

    expect(followUpRepository.findConflictingPendingByEstablishment).toHaveBeenCalledWith(
      tenantId,
      establishmentId,
      campaignAId,
      prospectAId,
      userId,
    );
  });
});
