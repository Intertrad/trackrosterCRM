import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ReservationController } from './reservation.controller.js';
import { ReservationService } from './reservation.service.js';
import type { ProspectReservation } from './reservation.types.js';

describe('ReservationController', () => {
  let reservationService: {
    acquire: ReturnType<typeof vi.fn>;
    getCurrent: ReturnType<typeof vi.fn>;
    release: ReturnType<typeof vi.fn>;
  };

  let controller: ReservationController;

  const tenantId = '11111111-1111-4111-8111-111111111111';

  const userId = '22222222-2222-4222-8222-222222222222';

  const campaignId = '33333333-3333-4333-8333-333333333333';

  const prospectId = '44444444-4444-4444-8444-444444444444';

  const reservationId = '55555555-5555-4555-8555-555555555555';

  const overrideId = '66666666-6666-4666-8666-666666666666';

  const reservation: ProspectReservation = {
    reservationId,

    tenantId,

    organizationId: '77777777-7777-4777-8777-777777777777',

    campaignId,

    campaignProspectId: prospectId,

    establishmentId: '88888888-8888-4888-8888-888888888888',

    assignmentId: '99999999-9999-4999-8999-999999999999',

    teamId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',

    userId,

    acquiredAt: '2026-09-10T13:00:00.000Z',

    expiresAt: '2026-09-10T13:20:00.000Z',
  };

  beforeEach(() => {
    reservationService = {
      acquire: vi.fn().mockResolvedValue(reservation),

      getCurrent: vi.fn().mockResolvedValue(reservation),

      release: vi.fn().mockResolvedValue({
        released: true,

        reservationId,
      }),
    };

    controller = new ReservationController(reservationService as unknown as ReservationService);
  });

  it('acquires normally without an override', async () => {
    const result = await controller.acquire(
      {
        tenantId,
        userId,
      },

      campaignId,

      prospectId,

      {},
    );

    expect(reservationService.acquire).toHaveBeenCalledWith({
      tenantId,

      userId,

      campaignId,

      campaignProspectId: prospectId,

      overrideId: undefined,
    });

    expect(result).toEqual(reservation);
  });

  it('preserves compatibility when no request body is supplied', async () => {
    await controller.acquire(
      {
        tenantId,
        userId,
      },

      campaignId,

      prospectId,

      undefined,
    );

    expect(reservationService.acquire).toHaveBeenCalledWith({
      tenantId,

      userId,

      campaignId,

      campaignProspectId: prospectId,

      overrideId: undefined,
    });
  });

  it('passes a supplied manager override ID to ReservationService', async () => {
    const result = await controller.acquire(
      {
        tenantId,
        userId,
      },

      campaignId,

      prospectId,

      {
        overrideId,
      },
    );

    expect(reservationService.acquire).toHaveBeenCalledWith({
      tenantId,

      userId,

      campaignId,

      campaignProspectId: prospectId,

      overrideId,
    });

    expect(result).toEqual(reservation);
  });

  it('uses authenticated user context rather than request body identity', async () => {
    await controller.acquire(
      {
        tenantId,
        userId,
      },

      campaignId,

      prospectId,

      {
        overrideId,
      },
    );

    expect(reservationService.acquire).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,

        userId,
      }),
    );
  });

  it('gets the current reservation using authenticated tenant context', async () => {
    const result = await controller.getCurrent(
      {
        tenantId,
        userId,
      },

      campaignId,

      prospectId,
    );

    expect(reservationService.getCurrent).toHaveBeenCalledWith(tenantId, campaignId, prospectId);

    expect(result).toEqual(reservation);
  });

  it('releases a reservation using authenticated user context', async () => {
    const result = await controller.release(
      {
        tenantId,
        userId,
      },

      campaignId,

      prospectId,

      reservationId,
    );

    expect(reservationService.release).toHaveBeenCalledWith({
      tenantId,

      userId,

      campaignId,

      campaignProspectId: prospectId,

      reservationId,
    });

    expect(result).toEqual({
      released: true,

      reservationId,
    });
  });
});
