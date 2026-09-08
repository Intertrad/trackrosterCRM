import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CampaignProspectAssignmentRepository } from '../assignments/campaign-prospect-assignment.repository.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { CampaignProspectRepository } from '../campaigns/campaign-prospect.repository.js';
import { CampaignRepository } from '../campaigns/campaign.repository.js';
import { CoolingOffService } from '../cooling-off/cooling-off.service.js';
import { TeamRepository } from '../teams/team.repository.js';
import { UserRepository } from '../users/user.repository.js';
import { ReservationRepository } from './reservation.repository.js';
import { ReservationService } from './reservation.service.js';

describe('ReservationService', () => {
  let reservationRepository: {
    acquire: ReturnType<typeof vi.fn>;
    findCurrent: ReturnType<typeof vi.fn>;
    findCurrentByEstablishment: ReturnType<typeof vi.fn>;
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

  let coolingOffService: {
    evaluate: ReturnType<typeof vi.fn>;
  };

  let service: ReservationService;

  const tenantId = '11111111-1111-4111-8111-111111111111';

  const organizationId = '22222222-2222-4222-8222-222222222222';

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
    status: 'active',
  };

  const prospect = {
    id: prospectId,
    tenantId,
    campaignId,
    establishmentId,
    status: 'active',
  };

  const assignment = {
    id: assignmentId,
    tenantId,
    campaignId,
    campaignProspectId: prospectId,
    organizationId,
    teamId,
    assignedUserId: userId,
    endedAt: null,
  };

  const existingReservation = {
    reservationId,
    tenantId,
    campaignId,
    campaignProspectId: prospectId,
    establishmentId,
    assignmentId,
    teamId,
    userId,
    acquiredAt: '2026-09-08T10:00:00.000Z',
    expiresAt: '2026-09-08T10:20:00.000Z',
  };

  beforeEach(() => {
    reservationRepository = {
      acquire: vi.fn(),
      findCurrent: vi.fn(),
      findCurrentByEstablishment: vi.fn().mockResolvedValue(null),
      release: vi.fn(),
    };

    assignmentRepository = {
      findCurrent: vi.fn(),
    };

    campaignRepository = {
      findById: vi.fn(),
    };

    campaignProspectRepository = {
      findById: vi.fn(),
    };

    teamRepository = {
      findById: vi.fn(),
    };

    userRepository = {
      findById: vi.fn(),
    };

    authorizationService = {
      getUserGrants: vi.fn(),
    };

    coolingOffService = {
      evaluate: vi.fn().mockResolvedValue({
        active: false,
        activity: null,
        expiresAt: null,
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
    );
  });

  function mockEligibleContext(assignedUserId: string | null = userId): void {
    campaignRepository.findById.mockResolvedValue(campaign);

    campaignProspectRepository.findById.mockResolvedValue(prospect);

    assignmentRepository.findCurrent.mockResolvedValue({
      ...assignment,
      assignedUserId,
    });

    teamRepository.findById.mockResolvedValue({
      id: teamId,
      tenantId,
      organizationId,
      status: 'active',
    });

    userRepository.findById.mockResolvedValue({
      id: userId,
      tenantId,
      status: 'active',
    });

    authorizationService.getUserGrants.mockResolvedValue([
      {
        role: 'prospector',
        scopeType: 'team',
        organizationId,
        teamId,
      },
    ]);
  }

  it('acquires a 20 minute reservation for an eligible assigned prospector', async () => {
    mockEligibleContext();

    reservationRepository.acquire.mockResolvedValue(true);

    const result = await service.acquire({
      tenantId,
      userId,
      campaignId,
      campaignProspectId: prospectId,
    });

    expect(reservationRepository.findCurrentByEstablishment).toHaveBeenCalledWith(
      tenantId,
      establishmentId,
    );

    expect(coolingOffService.evaluate).toHaveBeenCalledWith(tenantId, establishmentId);

    expect(reservationRepository.acquire).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        campaignId,
        campaignProspectId: prospectId,
        establishmentId,
        assignmentId,
        teamId,
        userId,
      }),
      1200,
    );

    expect(result.userId).toBe(userId);
  });

  it('allows an exact-team prospector to reserve a team-only assignment', async () => {
    mockEligibleContext(null);

    reservationRepository.acquire.mockResolvedValue(true);

    await expect(
      service.acquire({
        tenantId,
        userId,
        campaignId,
        campaignProspectId: prospectId,
      }),
    ).resolves.toMatchObject({
      userId,
      assignmentId,
      establishmentId,
    });
  });

  it('rejects another user when the assignment has an individual owner', async () => {
    mockEligibleContext();

    userRepository.findById.mockResolvedValue({
      id: otherUserId,
      tenantId,
      status: 'active',
    });

    await expect(
      service.acquire({
        tenantId,
        userId: otherUserId,
        campaignId,
        campaignProspectId: prospectId,
      }),
    ).rejects.toThrow('Campaign prospect is assigned to another user');

    expect(reservationRepository.findCurrentByEstablishment).not.toHaveBeenCalled();

    expect(coolingOffService.evaluate).not.toHaveBeenCalled();

    expect(reservationRepository.acquire).not.toHaveBeenCalled();
  });

  it('rejects a user without an exact-team prospector grant', async () => {
    mockEligibleContext();

    authorizationService.getUserGrants.mockResolvedValue([]);

    await expect(
      service.acquire({
        tenantId,
        userId,
        campaignId,
        campaignProspectId: prospectId,
      }),
    ).rejects.toThrow('User is not a prospector for the assigned team');

    expect(reservationRepository.findCurrentByEstablishment).not.toHaveBeenCalled();

    expect(coolingOffService.evaluate).not.toHaveBeenCalled();
  });

  it('rejects reservation when campaign is not active', async () => {
    campaignRepository.findById.mockResolvedValue({
      ...campaign,
      status: 'paused',
    });

    await expect(
      service.acquire({
        tenantId,
        userId,
        campaignId,
        campaignProspectId: prospectId,
      }),
    ).rejects.toThrow('Campaign is not active');

    expect(assignmentRepository.findCurrent).not.toHaveBeenCalled();

    expect(reservationRepository.findCurrentByEstablishment).not.toHaveBeenCalled();

    expect(coolingOffService.evaluate).not.toHaveBeenCalled();
  });

  it('rejects an excluded prospect', async () => {
    campaignRepository.findById.mockResolvedValue(campaign);

    campaignProspectRepository.findById.mockResolvedValue({
      ...prospect,
      status: 'excluded',
    });

    await expect(
      service.acquire({
        tenantId,
        userId,
        campaignId,
        campaignProspectId: prospectId,
      }),
    ).rejects.toThrow('Campaign prospect is not active');

    expect(reservationRepository.findCurrentByEstablishment).not.toHaveBeenCalled();

    expect(coolingOffService.evaluate).not.toHaveBeenCalled();
  });

  it('rejects an unassigned prospect', async () => {
    campaignRepository.findById.mockResolvedValue(campaign);

    campaignProspectRepository.findById.mockResolvedValue(prospect);

    assignmentRepository.findCurrent.mockResolvedValue(null);

    await expect(
      service.acquire({
        tenantId,
        userId,
        campaignId,
        campaignProspectId: prospectId,
      }),
    ).rejects.toThrow('Campaign prospect is not assigned');

    expect(reservationRepository.findCurrentByEstablishment).not.toHaveBeenCalled();

    expect(coolingOffService.evaluate).not.toHaveBeenCalled();
  });

  it('returns the caller existing exact reservation without applying cooling-off again', async () => {
    mockEligibleContext();

    reservationRepository.findCurrentByEstablishment.mockResolvedValue(existingReservation);

    coolingOffService.evaluate.mockResolvedValue({
      active: true,
      activity: null,
      expiresAt: new Date('2026-09-09T10:00:00.000Z'),
    });

    await expect(
      service.acquire({
        tenantId,
        userId,
        campaignId,
        campaignProspectId: prospectId,
      }),
    ).resolves.toEqual(existingReservation);

    expect(coolingOffService.evaluate).not.toHaveBeenCalled();

    expect(reservationRepository.acquire).not.toHaveBeenCalled();
  });

  it('rejects when another active canonical reservation exists', async () => {
    mockEligibleContext(null);

    reservationRepository.findCurrentByEstablishment.mockResolvedValue({
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

    expect(coolingOffService.evaluate).not.toHaveBeenCalled();

    expect(reservationRepository.acquire).not.toHaveBeenCalled();
  });

  it('blocks acquisition while the canonical establishment is cooling off', async () => {
    mockEligibleContext();

    reservationRepository.findCurrentByEstablishment.mockResolvedValue(null);

    coolingOffService.evaluate.mockResolvedValue({
      active: true,
      activity: {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        tenantId,
        campaignId,
        campaignProspectId: prospectId,
        establishmentId,
        assignmentId,
        userId,
        reservationId,
        type: 'call',
        occurredAt: new Date('2026-09-08T10:00:00.000Z'),
        createdAt: new Date('2026-09-08T10:00:00.000Z'),
      },
      expiresAt: new Date('2026-09-09T10:00:00.000Z'),
    });

    await expect(
      service.acquire({
        tenantId,
        userId,
        campaignId,
        campaignProspectId: prospectId,
      }),
    ).rejects.toThrow('Establishment is in cooling-off period');

    expect(coolingOffService.evaluate).toHaveBeenCalledWith(tenantId, establishmentId);

    expect(reservationRepository.acquire).not.toHaveBeenCalled();
  });

  it('returns existing reservation for a same-user race during acquisition', async () => {
    mockEligibleContext();

    reservationRepository.findCurrentByEstablishment.mockResolvedValue(null);

    reservationRepository.acquire.mockResolvedValue(false);

    reservationRepository.findCurrent.mockResolvedValue(existingReservation);

    const result = await service.acquire({
      tenantId,
      userId,
      campaignId,
      campaignProspectId: prospectId,
    });

    expect(result).toBe(existingReservation);

    expect(coolingOffService.evaluate).toHaveBeenCalledWith(tenantId, establishmentId);
  });

  it('rejects when another user wins the reservation race', async () => {
    mockEligibleContext(null);

    reservationRepository.findCurrentByEstablishment.mockResolvedValue(null);

    reservationRepository.acquire.mockResolvedValue(false);

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

  it('fails closed when canonical reservation lookup fails', async () => {
    mockEligibleContext();

    reservationRepository.findCurrentByEstablishment.mockRejectedValue(
      new Error('Redis unavailable'),
    );

    await expect(
      service.acquire({
        tenantId,
        userId,
        campaignId,
        campaignProspectId: prospectId,
      }),
    ).rejects.toThrow('Reservation service is unavailable');

    expect(coolingOffService.evaluate).not.toHaveBeenCalled();

    expect(reservationRepository.acquire).not.toHaveBeenCalled();
  });

  it('fails closed when cooling-off evaluation fails', async () => {
    mockEligibleContext();

    reservationRepository.findCurrentByEstablishment.mockResolvedValue(null);

    coolingOffService.evaluate.mockRejectedValue(new Error('Database unavailable'));

    await expect(
      service.acquire({
        tenantId,
        userId,
        campaignId,
        campaignProspectId: prospectId,
      }),
    ).rejects.toThrow('Database unavailable');

    expect(reservationRepository.acquire).not.toHaveBeenCalled();
  });

  it('allows only the reservation owner to release', async () => {
    reservationRepository.findCurrent.mockResolvedValue({
      ...existingReservation,
      userId: otherUserId,
    });

    await expect(
      service.release({
        tenantId,
        userId,
        campaignId,
        campaignProspectId: prospectId,
        reservationId,
      }),
    ).rejects.toThrow('Reservation belongs to another user');

    expect(reservationRepository.release).not.toHaveBeenCalled();
  });

  it('releases using reservation-id compare-and-delete', async () => {
    reservationRepository.findCurrent.mockResolvedValue(existingReservation);

    reservationRepository.release.mockResolvedValue(true);

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
  });
});
