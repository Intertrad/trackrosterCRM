import { beforeEach, describe, expect, it, vi } from 'vitest';

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

    service = new CollisionDecisionService(
      reservationRepository as unknown as ReservationRepository,
      reservationService as unknown as ReservationService,
    );
  });

  it('allows when the canonical establishment has no active reservation', async () => {
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
  });
});
