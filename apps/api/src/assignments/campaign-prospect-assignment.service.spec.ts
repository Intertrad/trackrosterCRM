import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthorizationService } from '../authorization/authorization.service.js';
import { CampaignProspectRepository } from '../campaigns/campaign-prospect.repository.js';
import { CampaignRepository } from '../campaigns/campaign.repository.js';
import type { CampaignProspectAssignment } from '../database/schema/campaign-prospect-assignments.js';
import { TeamRepository } from '../teams/team.repository.js';
import { UserRepository } from '../users/user.repository.js';
import { CampaignProspectAssignmentRepository } from './campaign-prospect-assignment.repository.js';
import { CampaignProspectAssignmentService } from './campaign-prospect-assignment.service.js';

describe('CampaignProspectAssignmentService', () => {
  let database: {
    transaction: ReturnType<typeof vi.fn>;
  };

  let assignmentRepository: {
    create: ReturnType<typeof vi.fn>;

    findCurrent: ReturnType<typeof vi.fn>;

    findHistory: ReturnType<typeof vi.fn>;

    endCurrent: ReturnType<typeof vi.fn>;
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

  let service: CampaignProspectAssignmentService;

  const tenantId = '11111111-1111-4111-8111-111111111111';

  const organizationId = '22222222-2222-4222-8222-222222222222';

  const campaignId = '33333333-3333-4333-8333-333333333333';

  const prospectId = '44444444-4444-4444-8444-444444444444';

  const teamId = '55555555-5555-4555-8555-555555555555';

  const userId = '66666666-6666-4666-8666-666666666666';

  const assignmentId = '77777777-7777-4777-8777-777777777777';

  const campaign = {
    id: campaignId,

    tenantId,

    organizationId,

    name: 'Paris Expansion',

    description: null,

    status: 'active' as const,

    startsAt: null,

    endsAt: null,

    createdAt: new Date(),

    updatedAt: new Date(),
  };

  const prospect = {
    id: prospectId,

    tenantId,

    campaignId,

    establishmentId: '88888888-8888-4888-8888-888888888888',

    status: 'active' as const,

    createdAt: new Date(),

    updatedAt: new Date(),
  };

  const assignment: CampaignProspectAssignment = {
    id: assignmentId,

    tenantId,

    campaignId,

    campaignProspectId: prospectId,

    organizationId,

    teamId,

    assignedUserId: userId,

    assignedAt: new Date(),

    endedAt: null,
  };

  beforeEach(() => {
    database = {
      transaction: vi.fn(),
    };

    database.transaction.mockImplementation(async (callback: (transaction: object) => unknown) =>
      callback({
        transaction: true,
      }),
    );

    assignmentRepository = {
      create: vi.fn(),

      findCurrent: vi.fn(),

      findHistory: vi.fn(),

      endCurrent: vi.fn(),
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

    service = new CampaignProspectAssignmentService(
      database as never,

      assignmentRepository as unknown as CampaignProspectAssignmentRepository,

      campaignRepository as unknown as CampaignRepository,

      campaignProspectRepository as unknown as CampaignProspectRepository,

      teamRepository as unknown as TeamRepository,

      userRepository as unknown as UserRepository,

      authorizationService as unknown as AuthorizationService,
    );
  });

  function mockValidContext(): void {
    campaignRepository.findById.mockResolvedValue(campaign);

    campaignProspectRepository.findById.mockResolvedValue(prospect);

    teamRepository.findById.mockResolvedValue({
      id: teamId,

      tenantId,

      organizationId,

      status: 'active',
    });
  }

  it('creates a team-only assignment', async () => {
    mockValidContext();

    assignmentRepository.findCurrent.mockResolvedValue(null);

    assignmentRepository.create.mockResolvedValue({
      ...assignment,
      assignedUserId: null,
    });

    const result = await service.assign({
      tenantId,
      campaignId,

      campaignProspectId: prospectId,

      teamId,
    });

    expect(assignmentRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        campaignId,

        campaignProspectId: prospectId,

        organizationId,
        teamId,

        assignedUserId: null,
      }),

      expect.anything(),
    );

    expect(result.assignedUserId).toBeNull();
  });

  it('assigns an active prospector for the exact team', async () => {
    mockValidContext();

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

    assignmentRepository.findCurrent.mockResolvedValue(null);

    assignmentRepository.create.mockResolvedValue(assignment);

    const result = await service.assign({
      tenantId,
      campaignId,

      campaignProspectId: prospectId,

      teamId,

      assignedUserId: userId,
    });

    expect(authorizationService.getUserGrants).toHaveBeenCalledWith(tenantId, userId);

    expect(result.assignedUserId).toBe(userId);
  });

  it('rejects a team from another organization', async () => {
    campaignRepository.findById.mockResolvedValue(campaign);

    campaignProspectRepository.findById.mockResolvedValue(prospect);

    teamRepository.findById.mockResolvedValue({
      id: teamId,

      organizationId: '99999999-9999-4999-8999-999999999999',

      status: 'active',
    });

    await expect(
      service.assign({
        tenantId,
        campaignId,

        campaignProspectId: prospectId,

        teamId,
      }),
    ).rejects.toThrow('Team does not belong to campaign organization');

    expect(assignmentRepository.create).not.toHaveBeenCalled();
  });

  it('rejects an excluded campaign prospect', async () => {
    campaignRepository.findById.mockResolvedValue(campaign);

    campaignProspectRepository.findById.mockResolvedValue({
      ...prospect,

      status: 'excluded',
    });

    await expect(
      service.assign({
        tenantId,
        campaignId,

        campaignProspectId: prospectId,

        teamId,
      }),
    ).rejects.toThrow('Excluded campaign prospect cannot be assigned');

    expect(teamRepository.findById).not.toHaveBeenCalled();
  });

  it('rejects assignments for completed campaigns', async () => {
    campaignRepository.findById.mockResolvedValue({
      ...campaign,

      status: 'completed',
    });

    await expect(
      service.assign({
        tenantId,
        campaignId,

        campaignProspectId: prospectId,

        teamId,
      }),
    ).rejects.toThrow('Campaign is no longer assignable');

    expect(campaignProspectRepository.findById).not.toHaveBeenCalled();
  });

  it('rejects an inactive assigned user', async () => {
    mockValidContext();

    userRepository.findById.mockResolvedValue({
      id: userId,

      tenantId,

      status: 'suspended',
    });

    await expect(
      service.assign({
        tenantId,
        campaignId,

        campaignProspectId: prospectId,

        teamId,

        assignedUserId: userId,
      }),
    ).rejects.toThrow('Assigned user is not active');

    expect(assignmentRepository.create).not.toHaveBeenCalled();
  });

  it('rejects a user without an exact-team prospector grant', async () => {
    mockValidContext();

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

        teamId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      },
    ]);

    await expect(
      service.assign({
        tenantId,
        campaignId,

        campaignProspectId: prospectId,

        teamId,

        assignedUserId: userId,
      }),
    ).rejects.toThrow('Assigned user is not a prospector for the selected team');

    expect(assignmentRepository.create).not.toHaveBeenCalled();
  });

  it('rejects a second active assignment', async () => {
    mockValidContext();

    assignmentRepository.findCurrent.mockResolvedValue({
      ...assignment,

      assignedUserId: null,
    });

    await expect(
      service.assign({
        tenantId,
        campaignId,

        campaignProspectId: prospectId,

        teamId,
      }),
    ).rejects.toThrow('Campaign prospect already has an active assignment');

    expect(assignmentRepository.create).not.toHaveBeenCalled();
  });

  it('reassigns by ending the current assignment and creating another inside one transaction', async () => {
    mockValidContext();

    const newUserId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

    userRepository.findById.mockResolvedValue({
      id: newUserId,

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

    assignmentRepository.findCurrent.mockResolvedValue(assignment);

    assignmentRepository.endCurrent.mockResolvedValue({
      ...assignment,

      endedAt: new Date(),
    });

    assignmentRepository.create.mockResolvedValue({
      ...assignment,

      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',

      assignedUserId: newUserId,
    });

    const result = await service.reassign({
      tenantId,
      campaignId,

      campaignProspectId: prospectId,

      teamId,

      assignedUserId: newUserId,
    });

    expect(database.transaction).toHaveBeenCalledTimes(1);

    expect(assignmentRepository.endCurrent).toHaveBeenCalled();

    expect(assignmentRepository.create).toHaveBeenCalled();

    expect(result.assignedUserId).toBe(newUserId);
  });

  it('unassigns by ending the current assignment', async () => {
    campaignRepository.findById.mockResolvedValue(campaign);

    campaignProspectRepository.findById.mockResolvedValue(prospect);

    assignmentRepository.endCurrent.mockResolvedValue({
      ...assignment,

      endedAt: new Date(),
    });

    const result = await service.unassign(tenantId, campaignId, prospectId);

    expect(assignmentRepository.endCurrent).toHaveBeenCalled();

    expect(result.endedAt).not.toBeNull();
  });

  it('returns assignment history', async () => {
    campaignRepository.findById.mockResolvedValue(campaign);

    campaignProspectRepository.findById.mockResolvedValue(prospect);

    assignmentRepository.findHistory.mockResolvedValue([assignment]);

    const result = await service.getHistory(tenantId, campaignId, prospectId);

    expect(result).toEqual([assignment]);
  });
});
