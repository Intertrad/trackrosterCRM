import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthorizationService } from '../authorization/authorization.service.js';
import { CampaignRepository } from '../campaigns/campaign.repository.js';
import { OrganizationRepository } from '../organizations/organization.repository.js';
import { TeamRepository } from '../teams/team.repository.js';
import { UserRepository } from '../users/user.repository.js';
import { ManagerDashboardScopeService } from './manager-dashboard-scope.service.js';

describe('ManagerDashboardScopeService', () => {
  let authorizationService: {
    getUserGrants: ReturnType<typeof vi.fn>;
  };

  let organizationRepository: {
    findById: ReturnType<typeof vi.fn>;
  };

  let teamRepository: {
    findById: ReturnType<typeof vi.fn>;
  };

  let userRepository: {
    findById: ReturnType<typeof vi.fn>;
  };

  let campaignRepository: {
    findById: ReturnType<typeof vi.fn>;
  };

  let service: ManagerDashboardScopeService;

  const tenantId = '11111111-1111-4111-8111-111111111111';

  const authenticatedUserId = '22222222-2222-4222-8222-222222222222';

  const organizationAId = '33333333-3333-4333-8333-333333333333';

  const organizationBId = '44444444-4444-4444-8444-444444444444';

  const teamAId = '55555555-5555-4555-8555-555555555555';

  const teamBId = '66666666-6666-4666-8666-666666666666';

  const targetUserId = '77777777-7777-4777-8777-777777777777';

  const campaignAId = '88888888-8888-4888-8888-888888888888';

  const campaignBId = '99999999-9999-4999-8999-999999999999';

  const organizationA = {
    id: organizationAId,

    tenantId,

    name: 'Organization A',

    slug: 'organization-a',

    status: 'active',

    createdAt: new Date(),

    updatedAt: new Date(),
  };

  const organizationB = {
    ...organizationA,

    id: organizationBId,

    name: 'Organization B',

    slug: 'organization-b',
  };

  const teamA = {
    id: teamAId,

    tenantId,

    organizationId: organizationAId,

    name: 'Team A',

    slug: 'team-a',

    status: 'active',

    createdAt: new Date(),

    updatedAt: new Date(),
  };

  const teamB = {
    ...teamA,

    id: teamBId,

    organizationId: organizationBId,

    name: 'Team B',

    slug: 'team-b',
  };

  const campaignA = {
    id: campaignAId,

    tenantId,

    organizationId: organizationAId,

    name: 'Campaign A',

    description: null,

    status: 'active',

    startsAt: null,

    endsAt: null,

    createdAt: new Date(),

    updatedAt: new Date(),
  };

  const campaignB = {
    ...campaignA,

    id: campaignBId,

    organizationId: organizationBId,

    name: 'Campaign B',
  };

  const targetUser = {
    id: targetUserId,

    tenantId,

    email: 'prospector@trackroster.test',

    passwordHash: 'hash',

    status: 'active',

    createdAt: new Date(),

    updatedAt: new Date(),
  };

  function tenantAdminGrant() {
    return {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',

      tenantId,

      userId: authenticatedUserId,

      role: 'client_admin' as const,

      scopeType: 'tenant' as const,

      organizationId: null,

      teamId: null,

      createdAt: new Date(),

      updatedAt: new Date(),
    };
  }

  function directorGrant(organizationId: string) {
    return {
      id: crypto.randomUUID(),

      tenantId,

      userId: authenticatedUserId,

      role: 'director' as const,

      scopeType: 'organization' as const,

      organizationId,

      teamId: null,

      createdAt: new Date(),

      updatedAt: new Date(),
    };
  }

  function managerGrant(organizationId: string, teamId: string) {
    return {
      id: crypto.randomUUID(),

      tenantId,

      userId: authenticatedUserId,

      role: 'manager' as const,

      scopeType: 'team' as const,

      organizationId,

      teamId,

      createdAt: new Date(),

      updatedAt: new Date(),
    };
  }

  function prospectorGrant(userId: string, organizationId: string, teamId: string) {
    return {
      id: crypto.randomUUID(),

      tenantId,

      userId,

      role: 'prospector' as const,

      scopeType: 'team' as const,

      organizationId,

      teamId,

      createdAt: new Date(),

      updatedAt: new Date(),
    };
  }

  beforeEach(() => {
    authorizationService = {
      getUserGrants: vi.fn(),
    };

    organizationRepository = {
      findById: vi.fn(),
    };

    teamRepository = {
      findById: vi.fn(),
    };

    userRepository = {
      findById: vi.fn(),
    };

    campaignRepository = {
      findById: vi.fn(),
    };

    organizationRepository.findById.mockImplementation(
      async (_tenantId: string, organizationId: string) => {
        if (organizationId === organizationAId) {
          return organizationA;
        }

        if (organizationId === organizationBId) {
          return organizationB;
        }

        return null;
      },
    );

    teamRepository.findById.mockImplementation(async (_tenantId: string, teamId: string) => {
      if (teamId === teamAId) {
        return teamA;
      }

      if (teamId === teamBId) {
        return teamB;
      }

      return null;
    });

    campaignRepository.findById.mockImplementation(
      async (_tenantId: string, campaignId: string) => {
        if (campaignId === campaignAId) {
          return campaignA;
        }

        if (campaignId === campaignBId) {
          return campaignB;
        }

        return null;
      },
    );

    userRepository.findById.mockImplementation(async (_tenantId: string, userId: string) =>
      userId === targetUserId ? targetUser : null,
    );

    service = new ManagerDashboardScopeService(
      authorizationService as unknown as AuthorizationService,

      organizationRepository as unknown as OrganizationRepository,

      teamRepository as unknown as TeamRepository,

      userRepository as unknown as UserRepository,

      campaignRepository as unknown as CampaignRepository,
    );
  });

  it('allows a client admin to report across the tenant', async () => {
    authorizationService.getUserGrants.mockResolvedValue([tenantAdminGrant()]);

    await expect(
      service.resolve({
        tenantId,

        userId: authenticatedUserId,

        filters: {},
      }),
    ).resolves.toEqual({
      authority: 'client_admin',

      organizationId: null,

      teamId: null,
    });
  });

  it('denies a prospector before resolving requested resources', async () => {
    authorizationService.getUserGrants.mockResolvedValue([
      prospectorGrant(authenticatedUserId, organizationAId, teamAId),
    ]);

    await expect(
      service.resolve({
        tenantId,

        userId: authenticatedUserId,

        filters: {
          organizationId: organizationAId,
        },
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(organizationRepository.findById).not.toHaveBeenCalled();

    expect(teamRepository.findById).not.toHaveBeenCalled();

    expect(campaignRepository.findById).not.toHaveBeenCalled();
  });

  it('denies an observer from manager reporting', async () => {
    authorizationService.getUserGrants.mockResolvedValue([
      {
        ...tenantAdminGrant(),

        role: 'observer' as const,
      },
    ]);

    await expect(
      service.resolve({
        tenantId,

        userId: authenticatedUserId,

        filters: {},
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('infers the organization when a director has exactly one organization grant', async () => {
    authorizationService.getUserGrants.mockResolvedValue([directorGrant(organizationAId)]);

    await expect(
      service.resolve({
        tenantId,

        userId: authenticatedUserId,

        filters: {},
      }),
    ).resolves.toEqual({
      authority: 'director',

      organizationId: organizationAId,

      teamId: null,
    });
  });

  it('requires an organization dimension when a director has multiple organization grants', async () => {
    authorizationService.getUserGrants.mockResolvedValue([
      directorGrant(organizationAId),

      directorGrant(organizationBId),
    ]);

    await expect(
      service.resolve({
        tenantId,

        userId: authenticatedUserId,

        filters: {},
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows a director to select one of their authorized organizations', async () => {
    authorizationService.getUserGrants.mockResolvedValue([
      directorGrant(organizationAId),

      directorGrant(organizationBId),
    ]);

    await expect(
      service.resolve({
        tenantId,

        userId: authenticatedUserId,

        filters: {
          organizationId: organizationBId,
        },
      }),
    ).resolves.toEqual({
      authority: 'director',

      organizationId: organizationBId,

      teamId: null,
    });
  });

  it('rejects a director organization outside their authorization', async () => {
    authorizationService.getUserGrants.mockResolvedValue([directorGrant(organizationAId)]);

    await expect(
      service.resolve({
        tenantId,

        userId: authenticatedUserId,

        filters: {
          organizationId: organizationBId,
        },
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('infers the team when a manager has exactly one team grant', async () => {
    authorizationService.getUserGrants.mockResolvedValue([managerGrant(organizationAId, teamAId)]);

    await expect(
      service.resolve({
        tenantId,

        userId: authenticatedUserId,

        filters: {},
      }),
    ).resolves.toEqual({
      authority: 'manager',

      organizationId: organizationAId,

      teamId: teamAId,
    });
  });

  it('requires teamId when a manager has multiple eligible team grants', async () => {
    authorizationService.getUserGrants.mockResolvedValue([
      managerGrant(organizationAId, teamAId),

      managerGrant(organizationBId, teamBId),
    ]);

    await expect(
      service.resolve({
        tenantId,

        userId: authenticatedUserId,

        filters: {},
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a manager team outside their authorization', async () => {
    authorizationService.getUserGrants.mockResolvedValue([managerGrant(organizationAId, teamAId)]);

    await expect(
      service.resolve({
        tenantId,

        userId: authenticatedUserId,

        filters: {
          teamId: teamBId,
        },
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a team that does not belong to the requested organization', async () => {
    authorizationService.getUserGrants.mockResolvedValue([tenantAdminGrant()]);

    await expect(
      service.resolve({
        tenantId,

        userId: authenticatedUserId,

        filters: {
          organizationId: organizationAId,

          teamId: teamBId,
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a campaign that does not belong to the requested organization', async () => {
    authorizationService.getUserGrants.mockResolvedValue([tenantAdminGrant()]);

    await expect(
      service.resolve({
        tenantId,

        userId: authenticatedUserId,

        filters: {
          organizationId: organizationAId,

          campaignId: campaignBId,
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an unknown team after reporting authority is established', async () => {
    authorizationService.getUserGrants.mockResolvedValue([tenantAdminGrant()]);

    await expect(
      service.resolve({
        tenantId,

        userId: authenticatedUserId,

        filters: {
          teamId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        },
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('allows a manager to filter by a prospector in the managed team', async () => {
    authorizationService.getUserGrants
      .mockResolvedValueOnce([managerGrant(organizationAId, teamAId)])
      .mockResolvedValueOnce([prospectorGrant(targetUserId, organizationAId, teamAId)]);

    await expect(
      service.resolve({
        tenantId,

        userId: authenticatedUserId,

        filters: {
          userId: targetUserId,
        },
      }),
    ).resolves.toEqual({
      authority: 'manager',

      organizationId: organizationAId,

      teamId: teamAId,
    });
  });

  it('rejects a prospector filter outside the manager team', async () => {
    authorizationService.getUserGrants
      .mockResolvedValueOnce([managerGrant(organizationAId, teamAId)])
      .mockResolvedValueOnce([prospectorGrant(targetUserId, organizationBId, teamBId)]);

    await expect(
      service.resolve({
        tenantId,

        userId: authenticatedUserId,

        filters: {
          userId: targetUserId,
        },
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a campaign outside a manager organization', async () => {
    authorizationService.getUserGrants.mockResolvedValue([managerGrant(organizationAId, teamAId)]);

    await expect(
      service.resolve({
        tenantId,

        userId: authenticatedUserId,

        filters: {
          campaignId: campaignBId,
        },
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('uses client admin authority before lower scoped grants', async () => {
    authorizationService.getUserGrants.mockResolvedValue([
      managerGrant(organizationAId, teamAId),

      directorGrant(organizationAId),

      tenantAdminGrant(),
    ]);

    await expect(
      service.resolve({
        tenantId,

        userId: authenticatedUserId,

        filters: {},
      }),
    ).resolves.toEqual({
      authority: 'client_admin',

      organizationId: null,

      teamId: null,
    });
  });
});
