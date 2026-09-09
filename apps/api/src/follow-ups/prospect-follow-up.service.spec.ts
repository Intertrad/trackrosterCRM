import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ReservationService } from '../reservations/reservation.service.js';
import { ProspectFollowUpRepository } from './prospect-follow-up.repository.js';
import { ProspectFollowUpService } from './prospect-follow-up.service.js';

describe('ProspectFollowUpService', () => {
  let followUpRepository: {
    create: ReturnType<typeof vi.fn>;

    findById: ReturnType<typeof vi.fn>;

    reschedulePending: ReturnType<typeof vi.fn>;

    completePending: ReturnType<typeof vi.fn>;

    cancelPending: ReturnType<typeof vi.fn>;
  };

  let reservationService: {
    requireReservationEligibility: ReturnType<typeof vi.fn>;
  };

  let service: ProspectFollowUpService;

  const tenantId = '11111111-1111-4111-8111-111111111111';

  const userId = '22222222-2222-4222-8222-222222222222';

  const otherUserId = '33333333-3333-4333-8333-333333333333';

  const campaignId = '44444444-4444-4444-8444-444444444444';

  const campaignProspectId = '55555555-5555-4555-8555-555555555555';

  const establishmentId = '66666666-6666-4666-8666-666666666666';

  const assignmentId = '77777777-7777-4777-8777-777777777777';

  const staleAssignmentId = '88888888-8888-4888-8888-888888888888';

  const followUpId = '99999999-9999-4999-8999-999999999999';

  const now = new Date();

  const futureDueAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const laterDueAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  const followUp = {
    id: followUpId,

    tenantId,

    campaignId,

    campaignProspectId,

    establishmentId,

    assignmentId,

    assignedUserId: userId,

    createdBy: userId,

    dueAt: futureDueAt,

    status: 'pending' as const,

    completedAt: null,

    cancelledAt: null,

    createdAt: now,

    updatedAt: now,
  };

  beforeEach(() => {
    followUpRepository = {
      create: vi.fn().mockResolvedValue(followUp),

      findById: vi.fn().mockResolvedValue(followUp),

      reschedulePending: vi
        .fn()
        .mockImplementation(
          async (_tenantId, _campaignId, _campaignProspectId, _followUpId, dueAt, updatedAt) => ({
            ...followUp,

            dueAt,

            updatedAt,
          }),
        ),

      completePending: vi
        .fn()
        .mockImplementation(
          async (_tenantId, _campaignId, _campaignProspectId, _followUpId, completedAt) => ({
            ...followUp,

            status: 'completed',

            completedAt,

            cancelledAt: null,

            updatedAt: completedAt,
          }),
        ),

      cancelPending: vi
        .fn()
        .mockImplementation(
          async (_tenantId, _campaignId, _campaignProspectId, _followUpId, cancelledAt) => ({
            ...followUp,

            status: 'cancelled',

            cancelledAt,

            completedAt: null,

            updatedAt: cancelledAt,
          }),
        ),
    };

    reservationService = {
      requireReservationEligibility: vi.fn().mockResolvedValue({
        assignment: {
          id: assignmentId,
        },

        establishmentId,
      }),
    };

    service = new ProspectFollowUpService(
      followUpRepository as unknown as ProspectFollowUpRepository,
      reservationService as unknown as ReservationService,
    );
  });

  it('creates a self-owned pending follow-up using server-derived context', async () => {
    const result = await service.create({
      tenantId,

      userId,

      campaignId,

      campaignProspectId,

      dueAt: futureDueAt,
    });

    expect(reservationService.requireReservationEligibility).toHaveBeenCalledWith({
      tenantId,

      userId,

      campaignId,

      campaignProspectId,
    });

    expect(followUpRepository.create).toHaveBeenCalledWith({
      tenantId,

      campaignId,

      campaignProspectId,

      establishmentId,

      assignmentId,

      assignedUserId: userId,

      createdBy: userId,

      dueAt: futureDueAt,

      status: 'pending',

      completedAt: null,

      cancelledAt: null,
    });

    expect(result).toMatchObject({
      id: followUpId,

      campaignId,

      campaignProspectId,

      establishmentId,

      assignedUserId: userId,

      createdBy: userId,

      status: 'pending',
    });

    expect(result).not.toHaveProperty('tenantId');

    expect(result).not.toHaveProperty('assignmentId');
  });

  it('creates a team-owned follow-up when assignedUserId is null', async () => {
    followUpRepository.create.mockResolvedValue({
      ...followUp,

      assignedUserId: null,
    });

    await service.create({
      tenantId,

      userId,

      campaignId,

      campaignProspectId,

      dueAt: futureDueAt,

      assignedUserId: null,
    });

    expect(followUpRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        assignedUserId: null,
      }),
    );
  });

  it('rejects assigning a follow-up to another user', async () => {
    await expect(
      service.create({
        tenantId,

        userId,

        campaignId,

        campaignProspectId,

        dueAt: futureDueAt,

        assignedUserId: otherUserId,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(followUpRepository.create).not.toHaveBeenCalled();
  });

  it('rejects a past due date', async () => {
    const pastDueAt = new Date(Date.now() - 60_000);

    await expect(
      service.create({
        tenantId,

        userId,

        campaignId,

        campaignProspectId,

        dueAt: pastDueAt,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(followUpRepository.create).not.toHaveBeenCalled();
  });

  it('reschedules a pending self-owned follow-up', async () => {
    const result = await service.reschedule({
      tenantId,

      userId,

      campaignId,

      campaignProspectId,

      followUpId,

      dueAt: laterDueAt,
    });

    expect(followUpRepository.reschedulePending).toHaveBeenCalledWith(
      tenantId,

      campaignId,

      campaignProspectId,

      followUpId,

      laterDueAt,

      expect.any(Date),
    );

    expect(result.dueAt).toBe(laterDueAt.toISOString());

    expect(result.status).toBe('pending');
  });

  it('completes a pending follow-up', async () => {
    const result = await service.complete({
      tenantId,

      userId,

      campaignId,

      campaignProspectId,

      followUpId,
    });

    expect(followUpRepository.completePending).toHaveBeenCalledWith(
      tenantId,

      campaignId,

      campaignProspectId,

      followUpId,

      expect.any(Date),
    );

    expect(result.status).toBe('completed');

    expect(result.completedAt).toEqual(expect.any(String));

    expect(result.cancelledAt).toBeNull();
  });

  it('cancels a pending follow-up', async () => {
    const result = await service.cancel({
      tenantId,

      userId,

      campaignId,

      campaignProspectId,

      followUpId,
    });

    expect(followUpRepository.cancelPending).toHaveBeenCalledWith(
      tenantId,

      campaignId,

      campaignProspectId,

      followUpId,

      expect.any(Date),
    );

    expect(result.status).toBe('cancelled');

    expect(result.cancelledAt).toEqual(expect.any(String));

    expect(result.completedAt).toBeNull();
  });

  it('allows an eligible prospector to mutate a team-owned follow-up', async () => {
    followUpRepository.findById.mockResolvedValue({
      ...followUp,

      assignedUserId: null,
    });

    await expect(
      service.complete({
        tenantId,

        userId,

        campaignId,

        campaignProspectId,

        followUpId,
      }),
    ).resolves.toBeDefined();

    expect(followUpRepository.completePending).toHaveBeenCalled();
  });

  it('rejects mutation when the follow-up belongs to another user', async () => {
    followUpRepository.findById.mockResolvedValue({
      ...followUp,

      assignedUserId: otherUserId,
    });

    await expect(
      service.complete({
        tenantId,

        userId,

        campaignId,

        campaignProspectId,

        followUpId,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(followUpRepository.completePending).not.toHaveBeenCalled();
  });

  it('rejects mutation when the follow-up belongs to a stale assignment', async () => {
    followUpRepository.findById.mockResolvedValue({
      ...followUp,

      assignmentId: staleAssignmentId,
    });

    await expect(
      service.cancel({
        tenantId,

        userId,

        campaignId,

        campaignProspectId,

        followUpId,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(followUpRepository.cancelPending).not.toHaveBeenCalled();
  });

  it('rejects mutation of a completed follow-up', async () => {
    followUpRepository.findById.mockResolvedValue({
      ...followUp,

      status: 'completed',

      completedAt: now,
    });

    await expect(
      service.reschedule({
        tenantId,

        userId,

        campaignId,

        campaignProspectId,

        followUpId,

        dueAt: laterDueAt,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(followUpRepository.reschedulePending).not.toHaveBeenCalled();
  });

  it('returns not found when the follow-up does not exist', async () => {
    followUpRepository.findById.mockResolvedValue(null);

    await expect(
      service.complete({
        tenantId,

        userId,

        campaignId,

        campaignProspectId,

        followUpId,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns conflict when a concurrent transition wins first', async () => {
    followUpRepository.completePending.mockResolvedValue(null);

    await expect(
      service.complete({
        tenantId,

        userId,

        campaignId,

        campaignProspectId,

        followUpId,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('fails closed when follow-up creation persistence fails', async () => {
    followUpRepository.create.mockRejectedValue(new Error('PostgreSQL unavailable'));

    await expect(
      service.create({
        tenantId,

        userId,

        campaignId,

        campaignProspectId,

        dueAt: futureDueAt,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('fails closed when follow-up lookup fails', async () => {
    followUpRepository.findById.mockRejectedValue(new Error('PostgreSQL unavailable'));

    await expect(
      service.cancel({
        tenantId,

        userId,

        campaignId,

        campaignProspectId,

        followUpId,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
