import { ConflictException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CampaignProspectAssignmentRepository } from '../assignments/campaign-prospect-assignment.repository.js';
import type { Database } from '../database/database.types.js';
import { ReservationRepository } from '../reservations/reservation.repository.js';
import { ReservationService } from '../reservations/reservation.service.js';
import { ProspectActivityRepository } from './prospect-activity.repository.js';
import { ProspectActivityService } from './prospect-activity.service.js';

describe('ProspectActivityService', () => {
  let database: {
    transaction: ReturnType<typeof vi.fn>;
  };

  let prospectActivityRepository: {
    create: ReturnType<typeof vi.fn>;
  };

  let assignmentRepository: {
    findCurrentForUpdate: ReturnType<typeof vi.fn>;
  };

  let reservationRepository: {
    findCurrent: ReturnType<typeof vi.fn>;
  };

  let reservationService: {
    requireReservationEligibility: ReturnType<typeof vi.fn>;
  };

  let service: ProspectActivityService;

  const tenantId = '11111111-1111-4111-8111-111111111111';

  const campaignId = '22222222-2222-4222-8222-222222222222';

  const campaignProspectId = '33333333-3333-4333-8333-333333333333';

  const establishmentId = '44444444-4444-4444-8444-444444444444';

  const assignmentId = '55555555-5555-4555-8555-555555555555';

  const userId = '66666666-6666-4666-8666-666666666666';

  const otherUserId = '77777777-7777-4777-8777-777777777777';

  const reservationId = '88888888-8888-4888-8888-888888888888';

  const teamId = '99999999-9999-4999-8999-999999999999';

  const organizationId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  const transaction = {};

  const assignment = {
    id: assignmentId,

    tenantId,

    campaignId,

    campaignProspectId,

    organizationId,

    teamId,

    assignedUserId: userId,

    assignedAt: new Date('2026-09-08T09:00:00.000Z'),

    endedAt: null,
  };

  const reservation = {
    reservationId,

    tenantId,

    campaignId,

    campaignProspectId,

    establishmentId,

    assignmentId,

    teamId,

    userId,

    acquiredAt: '2026-09-08T10:00:00.000Z',

    expiresAt: '2026-09-08T10:20:00.000Z',
  };

  const activity = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',

    tenantId,

    campaignId,

    campaignProspectId,

    establishmentId,

    assignmentId,

    userId,

    reservationId,

    type: 'call' as const,

    occurredAt: new Date('2026-09-08T10:05:00.000Z'),

    createdAt: new Date('2026-09-08T10:05:00.000Z'),
  };

  beforeEach(() => {
    database = {
      transaction: vi.fn(async (callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };

    prospectActivityRepository = {
      create: vi.fn().mockResolvedValue(activity),
    };

    assignmentRepository = {
      findCurrentForUpdate: vi.fn().mockResolvedValue(assignment),
    };

    reservationRepository = {
      findCurrent: vi.fn().mockResolvedValue(reservation),
    };

    reservationService = {
      requireReservationEligibility: vi.fn().mockResolvedValue({
        assignment,

        establishmentId,
      }),
    };

    service = new ProspectActivityService(
      database as unknown as Database,

      prospectActivityRepository as unknown as ProspectActivityRepository,

      assignmentRepository as unknown as CampaignProspectAssignmentRepository,

      reservationRepository as unknown as ReservationRepository,

      reservationService as unknown as ReservationService,
    );
  });

  it('records an immutable activity using server-derived reservation context', async () => {
    await expect(
      service.record({
        tenantId,

        userId,

        campaignId,

        campaignProspectId,

        type: 'call',
      }),
    ).resolves.toEqual(activity);

    expect(database.transaction).toHaveBeenCalledTimes(1);

    expect(assignmentRepository.findCurrentForUpdate).toHaveBeenCalledWith(
      tenantId,

      campaignId,

      campaignProspectId,

      transaction,
    );

    expect(prospectActivityRepository.create).toHaveBeenCalledWith(
      {
        tenantId,

        campaignId,

        campaignProspectId,

        establishmentId,

        assignmentId,

        userId,

        reservationId,

        type: 'call',
      },

      transaction,
    );
  });

  it('requires an active reservation', async () => {
    reservationRepository.findCurrent.mockResolvedValue(null);

    await expect(
      service.record({
        tenantId,

        userId,

        campaignId,

        campaignProspectId,

        type: 'call',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(database.transaction).not.toHaveBeenCalled();

    expect(assignmentRepository.findCurrentForUpdate).not.toHaveBeenCalled();

    expect(prospectActivityRepository.create).not.toHaveBeenCalled();
  });

  it('rejects activity when the reservation belongs to another user', async () => {
    reservationRepository.findCurrent.mockResolvedValue({
      ...reservation,

      userId: otherUserId,
    });

    await expect(
      service.record({
        tenantId,

        userId,

        campaignId,

        campaignProspectId,

        type: 'call',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(database.transaction).not.toHaveBeenCalled();

    expect(assignmentRepository.findCurrentForUpdate).not.toHaveBeenCalled();

    expect(prospectActivityRepository.create).not.toHaveBeenCalled();
  });

  it('rejects a reservation from a stale assignment', async () => {
    reservationService.requireReservationEligibility.mockResolvedValue({
      assignment: {
        ...assignment,

        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      },

      establishmentId,
    });

    await expect(
      service.record({
        tenantId,

        userId,

        campaignId,

        campaignProspectId,

        type: 'email',
      }),
    ).rejects.toThrow('Reservation does not match current assignment');

    expect(database.transaction).not.toHaveBeenCalled();

    expect(assignmentRepository.findCurrentForUpdate).not.toHaveBeenCalled();

    expect(prospectActivityRepository.create).not.toHaveBeenCalled();
  });

  it('rejects a reservation that does not match the canonical establishment', async () => {
    reservationRepository.findCurrent.mockResolvedValue({
      ...reservation,

      establishmentId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    });

    await expect(
      service.record({
        tenantId,

        userId,

        campaignId,

        campaignProspectId,

        type: 'visit',
      }),
    ).rejects.toThrow('Reservation does not match campaign prospect');

    expect(database.transaction).not.toHaveBeenCalled();

    expect(assignmentRepository.findCurrentForUpdate).not.toHaveBeenCalled();

    expect(prospectActivityRepository.create).not.toHaveBeenCalled();
  });

  it('fails before reservation lookup when the caller is not eligible', async () => {
    reservationService.requireReservationEligibility.mockRejectedValue(
      new ForbiddenException('User is not a prospector for the assigned team'),
    );

    await expect(
      service.record({
        tenantId,

        userId,

        campaignId,

        campaignProspectId,

        type: 'call',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(reservationRepository.findCurrent).not.toHaveBeenCalled();

    expect(database.transaction).not.toHaveBeenCalled();

    expect(assignmentRepository.findCurrentForUpdate).not.toHaveBeenCalled();

    expect(prospectActivityRepository.create).not.toHaveBeenCalled();
  });

  it('fails closed when Redis reservation lookup fails', async () => {
    reservationRepository.findCurrent.mockRejectedValue(new Error('Redis unavailable'));

    await expect(
      service.record({
        tenantId,

        userId,

        campaignId,

        campaignProspectId,

        type: 'message',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(database.transaction).not.toHaveBeenCalled();

    expect(assignmentRepository.findCurrentForUpdate).not.toHaveBeenCalled();

    expect(prospectActivityRepository.create).not.toHaveBeenCalled();
  });

  it('rejects activity when the assignment changes after reservation validation', async () => {
    assignmentRepository.findCurrentForUpdate.mockResolvedValue({
      ...assignment,

      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    });

    await expect(
      service.record({
        tenantId,

        userId,

        campaignId,

        campaignProspectId,

        type: 'call',
      }),
    ).rejects.toThrow('Campaign prospect changed during activity recording');

    expect(database.transaction).toHaveBeenCalledTimes(1);

    expect(assignmentRepository.findCurrentForUpdate).toHaveBeenCalledWith(
      tenantId,

      campaignId,

      campaignProspectId,

      transaction,
    );

    expect(prospectActivityRepository.create).not.toHaveBeenCalled();
  });

  it('rejects activity when the current assignment disappears before persistence', async () => {
    assignmentRepository.findCurrentForUpdate.mockResolvedValue(null);

    await expect(
      service.record({
        tenantId,

        userId,

        campaignId,

        campaignProspectId,

        type: 'call',
      }),
    ).rejects.toThrow('Campaign prospect changed during activity recording');

    expect(prospectActivityRepository.create).not.toHaveBeenCalled();
  });

  it('fails closed when activity persistence fails', async () => {
    prospectActivityRepository.create.mockRejectedValue(new Error('PostgreSQL unavailable'));

    await expect(
      service.record({
        tenantId,

        userId,

        campaignId,

        campaignProspectId,

        type: 'call',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(database.transaction).toHaveBeenCalledTimes(1);

    expect(assignmentRepository.findCurrentForUpdate).toHaveBeenCalledWith(
      tenantId,

      campaignId,

      campaignProspectId,

      transaction,
    );
  });
});
