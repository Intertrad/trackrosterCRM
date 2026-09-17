import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CampaignProspectAssignmentRepository } from '../assignments/campaign-prospect-assignment.repository.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { CampaignProspectRepository } from '../campaigns/campaign-prospect.repository.js';
import { CampaignRepository } from '../campaigns/campaign.repository.js';
import { ProspectFollowUpQueryService } from './prospect-follow-up-query.service.js';
import { ProspectFollowUpRepository } from './prospect-follow-up.repository.js';

describe('ProspectFollowUpQueryService', () => {
  let followUpRepository: {
    findByCampaignProspect: ReturnType<typeof vi.fn>;

    findActionableQueue: ReturnType<typeof vi.fn>;
  };

  let campaignRepository: {
    findById: ReturnType<typeof vi.fn>;
  };

  let campaignProspectRepository: {
    findById: ReturnType<typeof vi.fn>;
  };

  let assignmentRepository: {
    findCurrent: ReturnType<typeof vi.fn>;
  };

  let authorizationService: {
    canViewTeam: ReturnType<typeof vi.fn>;

    canViewOrganization: ReturnType<typeof vi.fn>;

    getUserGrants: ReturnType<typeof vi.fn>;
  };

  let service: ProspectFollowUpQueryService;

  const tenantId = '11111111-1111-4111-8111-111111111111';

  const userId = '22222222-2222-4222-8222-222222222222';

  const campaignId = '33333333-3333-4333-8333-333333333333';

  const campaignProspectId = '44444444-4444-4444-8444-444444444444';

  const establishmentId = '55555555-5555-4555-8555-555555555555';

  const assignmentId = '66666666-6666-4666-8666-666666666666';

  const organizationId = '77777777-7777-4777-8777-777777777777';

  const teamId = '88888888-8888-4888-8888-888888888888';

  const otherTeamId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  const followUpId = '99999999-9999-4999-8999-999999999999';

  const dueAt = new Date('2026-09-15T10:00:00.000Z');

  const createdAt = new Date('2026-09-09T10:00:00.000Z');

  const updatedAt = new Date('2026-09-09T10:00:00.000Z');

  const campaign = {
    id: campaignId,

    tenantId,

    organizationId,

    name: 'Paris Campaign',

    description: null,

    status: 'active',

    startsAt: null,

    endsAt: null,

    createdAt,

    updatedAt,
  };

  const prospect = {
    id: campaignProspectId,

    tenantId,

    campaignId,

    establishmentId,

    status: 'active',

    createdAt,

    updatedAt,
  };

  const assignment = {
    id: assignmentId,

    tenantId,

    campaignId,

    campaignProspectId,

    organizationId,

    teamId,

    assignedUserId: userId,

    assignedByUserId: userId,

    assignedAt: createdAt,

    endedAt: null,

    createdAt,
  };

  const followUp = {
    id: followUpId,

    tenantId,

    campaignId,

    campaignProspectId,

    establishmentId,

    assignmentId,

    assignedUserId: userId,

    createdBy: userId,

    dueAt,

    status: 'pending' as const,

    completedAt: null,

    cancelledAt: null,

    createdAt,

    updatedAt,
  };

  const queueFollowUp = {
    ...followUp,

    campaignName: 'Paris Campaign',

    establishmentName: 'Paris Clinic',
  };

  beforeEach(() => {
    followUpRepository = {
      findByCampaignProspect: vi.fn().mockResolvedValue([followUp]),

      findActionableQueue: vi.fn().mockResolvedValue([queueFollowUp]),
    };

    campaignRepository = {
      findById: vi.fn().mockResolvedValue(campaign),
    };

    campaignProspectRepository = {
      findById: vi.fn().mockResolvedValue(prospect),
    };

    assignmentRepository = {
      findCurrent: vi.fn().mockResolvedValue(assignment),
    };

    authorizationService = {
      canViewTeam: vi.fn().mockResolvedValue(true),

      canViewOrganization: vi.fn().mockResolvedValue(true),

      getUserGrants: vi.fn().mockResolvedValue([
        {
          role: 'prospector',

          scopeType: 'team',

          organizationId,

          teamId,
        },
      ]),
    };

    service = new ProspectFollowUpQueryService(
      followUpRepository as unknown as ProspectFollowUpRepository,
      campaignRepository as unknown as CampaignRepository,
      campaignProspectRepository as unknown as CampaignProspectRepository,
      assignmentRepository as unknown as CampaignProspectAssignmentRepository,
      authorizationService as unknown as AuthorizationService,
    );
  });

  it('lists prospect follow-ups using current team authorization', async () => {
    const result = await service.listByProspect({
      tenantId,

      userId,

      campaignId,

      campaignProspectId,
    });

    expect(authorizationService.canViewTeam).toHaveBeenCalledWith(
      tenantId,
      userId,
      organizationId,
      teamId,
    );

    expect(authorizationService.canViewOrganization).not.toHaveBeenCalled();

    expect(followUpRepository.findByCampaignProspect).toHaveBeenCalledWith(
      tenantId,
      campaignId,
      campaignProspectId,
    );

    expect(result).toEqual({
      items: [
        {
          id: followUpId,

          campaignId,

          campaignProspectId,

          establishmentId,

          assignedUserId: userId,

          createdBy: userId,

          dueAt: dueAt.toISOString(),

          status: 'pending',

          completedAt: null,

          cancelledAt: null,

          createdAt: createdAt.toISOString(),

          updatedAt: updatedAt.toISOString(),
        },
      ],
    });
  });

  it('does not expose tenant or assignment metadata in prospect follow-up history', async () => {
    const result = await service.listByProspect({
      tenantId,

      userId,

      campaignId,

      campaignProspectId,
    });

    const item = result.items[0];

    expect(item).toBeDefined();

    expect(item).not.toHaveProperty('tenantId');

    expect(item).not.toHaveProperty('assignmentId');
  });

  it('uses organization authorization when the prospect has no current assignment', async () => {
    assignmentRepository.findCurrent.mockResolvedValue(null);

    await service.listByProspect({
      tenantId,

      userId,

      campaignId,

      campaignProspectId,
    });

    expect(authorizationService.canViewOrganization).toHaveBeenCalledWith(
      tenantId,
      userId,
      organizationId,
    );

    expect(authorizationService.canViewTeam).not.toHaveBeenCalled();
  });

  it('masks prospect history when the user cannot view the current team', async () => {
    authorizationService.canViewTeam.mockResolvedValue(false);

    await expect(
      service.listByProspect({
        tenantId,

        userId,

        campaignId,

        campaignProspectId,
      }),
    ).rejects.toThrow('Campaign prospect not found');

    expect(followUpRepository.findByCampaignProspect).not.toHaveBeenCalled();
  });

  it('masks an unassigned prospect when organization access is missing', async () => {
    assignmentRepository.findCurrent.mockResolvedValue(null);

    authorizationService.canViewOrganization.mockResolvedValue(false);

    await expect(
      service.listByProspect({
        tenantId,

        userId,

        campaignId,

        campaignProspectId,
      }),
    ).rejects.toThrow('Campaign prospect not found');

    expect(followUpRepository.findByCampaignProspect).not.toHaveBeenCalled();
  });

  it('returns the same masked response when the campaign does not exist', async () => {
    campaignRepository.findById.mockResolvedValue(null);

    await expect(
      service.listByProspect({
        tenantId,

        userId,

        campaignId,

        campaignProspectId,
      }),
    ).rejects.toThrow('Campaign prospect not found');

    expect(campaignProspectRepository.findById).not.toHaveBeenCalled();

    expect(assignmentRepository.findCurrent).not.toHaveBeenCalled();

    expect(followUpRepository.findByCampaignProspect).not.toHaveBeenCalled();
  });

  it('returns the same masked response when the campaign prospect does not exist', async () => {
    campaignProspectRepository.findById.mockResolvedValue(null);

    await expect(
      service.listByProspect({
        tenantId,

        userId,

        campaignId,

        campaignProspectId,
      }),
    ).rejects.toThrow('Campaign prospect not found');

    expect(assignmentRepository.findCurrent).not.toHaveBeenCalled();

    expect(followUpRepository.findByCampaignProspect).not.toHaveBeenCalled();
  });

  it('allows historical follow-up reads for an archived campaign', async () => {
    campaignRepository.findById.mockResolvedValue({
      ...campaign,

      status: 'archived',
    });

    await expect(
      service.listByProspect({
        tenantId,

        userId,

        campaignId,

        campaignProspectId,
      }),
    ).resolves.toBeDefined();
  });

  it('fails closed when prospect history persistence lookup fails', async () => {
    followUpRepository.findByCampaignProspect.mockRejectedValue(
      new Error('PostgreSQL unavailable'),
    );

    await expect(
      service.listByProspect({
        tenantId,

        userId,

        campaignId,

        campaignProspectId,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('builds an actionable queue from the selected prospector team scope', async () => {
    const result = await service.listQueue({
      tenantId,

      userId,

      teamId,

      overdue: true,

      limit: 25,
    });

    expect(authorizationService.getUserGrants).toHaveBeenCalledWith(tenantId, userId);

    expect(followUpRepository.findActionableQueue).toHaveBeenCalledWith(tenantId, {
      userId,

      teamScopes: [
        {
          organizationId,

          teamId,
        },
      ],

      overdue: true,

      now: expect.any(Date),

      limit: 25,
    });

    expect(result).toEqual({
      items: [
        {
          id: followUpId,

          campaignId,

          campaignProspectId,

          establishmentId,

          assignedUserId: userId,

          createdBy: userId,

          dueAt: dueAt.toISOString(),

          status: 'pending',

          completedAt: null,

          cancelledAt: null,

          createdAt: createdAt.toISOString(),

          updatedAt: updatedAt.toISOString(),

          campaignName: 'Paris Campaign',

          establishmentName: 'Paris Clinic',
        },
      ],
    });
  });

  it('does not expose tenant or assignment metadata in the actionable queue', async () => {
    const result = await service.listQueue({
      tenantId,

      userId,

      teamId,
    });

    const item = result.items[0];

    expect(item).toBeDefined();

    expect(item).not.toHaveProperty('tenantId');

    expect(item).not.toHaveProperty('assignmentId');
  });

  it('uses the default queue limit when none is supplied', async () => {
    await service.listQueue({
      tenantId,

      userId,

      teamId,
    });

    expect(followUpRepository.findActionableQueue).toHaveBeenCalledWith(
      tenantId,
      expect.objectContaining({
        limit: 50,
      }),
    );
  });

  it('uses only the selected prospector team grant for the operational queue', async () => {
    authorizationService.getUserGrants.mockResolvedValue([
      {
        role: 'observer',

        scopeType: 'team',

        organizationId,

        teamId,
      },

      {
        role: 'prospector',

        scopeType: 'team',

        organizationId,

        teamId,
      },

      {
        role: 'prospector',

        scopeType: 'team',

        organizationId,

        teamId: otherTeamId,
      },

      {
        role: 'director',

        scopeType: 'organization',

        organizationId,

        teamId: null,
      },
    ]);

    await service.listQueue({
      tenantId,

      userId,

      teamId,
    });

    expect(followUpRepository.findActionableQueue).toHaveBeenCalledWith(
      tenantId,
      expect.objectContaining({
        teamScopes: [
          {
            organizationId,

            teamId,
          },
        ],
      }),
    );
  });

  it('rejects queue access when the caller has no prospector team scope', async () => {
    authorizationService.getUserGrants.mockResolvedValue([
      {
        role: 'observer',

        scopeType: 'team',

        organizationId,

        teamId,
      },
    ]);

    await expect(
      service.listQueue({
        tenantId,

        userId,

        teamId,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(followUpRepository.findActionableQueue).not.toHaveBeenCalled();
  });

  it('rejects a selected team outside the caller prospector grants', async () => {
    authorizationService.getUserGrants.mockResolvedValue([
      {
        role: 'prospector',

        scopeType: 'team',

        organizationId,

        teamId: otherTeamId,
      },
    ]);

    await expect(
      service.listQueue({
        tenantId,

        userId,

        teamId,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(followUpRepository.findActionableQueue).not.toHaveBeenCalled();
  });

  it('fails closed when actionable queue lookup fails', async () => {
    followUpRepository.findActionableQueue.mockRejectedValue(new Error('PostgreSQL unavailable'));

    await expect(
      service.listQueue({
        tenantId,

        userId,

        teamId,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
