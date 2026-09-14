import { BadRequestException, ForbiddenException } from '@nestjs/common';
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

  const userId = '22222222-2222-4222-8222-222222222222';

  const organizationAId = '33333333-3333-4333-8333-333333333333';

  const organizationBId = '44444444-4444-4444-8444-444444444444';

  const teamAId = '55555555-5555-4555-8555-555555555555';

  const teamBId = '66666666-6666-4666-8666-666666666666';

  const campaignBId = '88888888-8888-4888-8888-888888888888';

  const prospectorAId = '99999999-9999-4999-8999-999999999999';

  const prospectorBId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  const now = new Date('2026-09-14T10:00:00.000Z');

  const organizationA = {
    id: organizationAId,

    tenantId,

    name: 'Organization A',

    slug: 'organization-a',

    status: 'active',

    createdAt: now,

    updatedAt: now,
  };

  const organizationB = {
    id: organizationBId,

    tenantId,

    name: 'Organization B',

    slug: 'organization-b',

    status: 'active',

    createdAt: now,

    updatedAt: now,
  };

  const teamB = {
    id: teamBId,

    tenantId,

    organizationId: organizationBId,

    name: 'Team B',

    slug: 'team-b',

    status: 'active',

    createdAt: now,

    updatedAt: now,
  };

  const campaignB = {
    id: campaignBId,

    tenantId,

    organizationId: organizationBId,

    name: 'Campaign B',

    description: null,

    status: 'active',

    startsAt: null,

    endsAt: null,

    createdAt: now,

    updatedAt: now,
  };

  const prospectorA = {
    id: prospectorAId,

    tenantId,

    email: 'prospector-a@trackroster.test',

    passwordHash: 'hash',

    status: 'active',

    createdAt: now,

    updatedAt: now,
  };

  const prospectorB = {
    id: prospectorBId,

    tenantId,

    email: 'prospector-b@trackroster.test',

    passwordHash: 'hash',

    status: 'active',

    createdAt: now,

    updatedAt: now,
  };

  function clientAdminGrant() {
    return {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',

      tenantId,

      userId,

      role: 'client_admin' as const,

      scopeType: 'tenant' as const,

      organizationId: null,

      teamId: null,

      createdAt: now,
    };
  }

  function prospectorGrant(organizationId: string, teamId: string, grantUserId = userId) {
    return {
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',

      tenantId,

      userId: grantUserId,

      role: 'prospector' as const,

      scopeType: 'team' as const,

      organizationId,

      teamId,

      createdAt: now,
    };
  }

  function observerGrant() {
    return {
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',

      tenantId,

      userId,

      role: 'observer' as const,

      scopeType: 'tenant' as const,

      organizationId: null,

      teamId: null,

      createdAt: now,
    };
  }

  function directorGrant(organizationId: string) {
    return {
      id: `director-${organizationId}`,

      tenantId,

      userId,

      role: 'director' as const,

      scopeType: 'organization' as const,

      organizationId,

      teamId: null,

      createdAt: now,
    };
  }

  function managerGrant(organizationId: string, teamId: string) {
    return {
      id: `manager-${teamId}`,

      tenantId,

      userId,

      role: 'manager' as const,

      scopeType: 'team' as const,

      organizationId,

      teamId,

      createdAt: now,
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

    service = new ManagerDashboardScopeService(
      authorizationService as unknown as AuthorizationService,

      organizationRepository as unknown as OrganizationRepository,

      teamRepository as unknown as TeamRepository,

      userRepository as unknown as UserRepository,

      campaignRepository as unknown as CampaignRepository,
    );
  });

  it('allows a client admin to report across the tenant', async () => {
    authorizationService.getUserGrants.mockResolvedValue([clientAdminGrant()]);

    await expect(
      service.resolve({
        tenantId,

        userId,

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
      prospectorGrant(organizationAId, teamAId),
    ]);

    await expect(
      service.resolve({
        tenantId,

        userId,

        filters: {
          organizationId: organizationBId,
        },
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(organizationRepository.findById).not.toHaveBeenCalled();

    expect(teamRepository.findById).not.toHaveBeenCalled();

    expect(campaignRepository.findById).not.toHaveBeenCalled();

    expect(userRepository.findById).not.toHaveBeenCalled();
  });

  it('denies an observer from manager reporting', async () => {
    authorizationService.getUserGrants.mockResolvedValue([observerGrant()]);

    await expect(
      service.resolve({
        tenantId,

        userId,

        filters: {},
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('infers the organization when a director has exactly one organization grant', async () => {
    authorizationService.getUserGrants.mockResolvedValue([directorGrant(organizationAId)]);

    await expect(
      service.resolve({
        tenantId,

        userId,

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

        userId,

        filters: {},
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows a director to select one of their authorized organizations', async () => {
    authorizationService.getUserGrants.mockResolvedValue([
      directorGrant(organizationAId),

      directorGrant(organizationBId),
    ]);

    organizationRepository.findById.mockResolvedValue(organizationB);

    await expect(
      service.resolve({
        tenantId,

        userId,

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

  it('masks a director organization outside their authorization', async () => {
    authorizationService.getUserGrants.mockResolvedValue([directorGrant(organizationAId)]);

    organizationRepository.findById.mockResolvedValue(organizationB);

    await expect(
      service.resolve({
        tenantId,

        userId,

        filters: {
          organizationId: organizationBId,
        },
      }),
    ).rejects.toThrow('Reporting resource not found');
  });

  it('infers the team when a manager has exactly one team grant', async () => {
    authorizationService.getUserGrants.mockResolvedValue([managerGrant(organizationAId, teamAId)]);

    await expect(
      service.resolve({
        tenantId,

        userId,

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

        userId,

        filters: {},
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('masks a manager team outside their authorization', async () => {
    authorizationService.getUserGrants.mockResolvedValue([managerGrant(organizationAId, teamAId)]);

    teamRepository.findById.mockResolvedValue(teamB);

    await expect(
      service.resolve({
        tenantId,

        userId,

        filters: {
          teamId: teamBId,
        },
      }),
    ).rejects.toThrow('Reporting resource not found');
  });

  it('rejects a team that does not belong to the requested organization', async () => {
    /*
     * Client admin legitimately knows both
     * resources, so exposing the relationship error
     * is safe.
     */
    authorizationService.getUserGrants.mockResolvedValue([clientAdminGrant()]);

    organizationRepository.findById.mockResolvedValue(organizationA);

    teamRepository.findById.mockResolvedValue(teamB);

    await expect(
      service.resolve({
        tenantId,

        userId,

        filters: {
          organizationId: organizationAId,

          teamId: teamBId,
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a campaign that does not belong to the requested organization', async () => {
    /*
     * Both resources are visible to the client
     * admin. The invalid relationship may therefore
     * safely remain a 400.
     */
    authorizationService.getUserGrants.mockResolvedValue([clientAdminGrant()]);

    organizationRepository.findById.mockResolvedValue(organizationA);

    campaignRepository.findById.mockResolvedValue(campaignB);

    await expect(
      service.resolve({
        tenantId,

        userId,

        filters: {
          organizationId: organizationAId,

          campaignId: campaignBId,
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an unknown team after reporting authority is established', async () => {
    authorizationService.getUserGrants.mockResolvedValue([managerGrant(organizationAId, teamAId)]);

    teamRepository.findById.mockResolvedValue(null);

    await expect(
      service.resolve({
        tenantId,

        userId,

        filters: {
          teamId: teamAId,
        },
      }),
    ).rejects.toThrow('Reporting resource not found');
  });

  it('allows a manager to filter by a prospector in the managed team', async () => {
    authorizationService.getUserGrants
      .mockResolvedValueOnce([managerGrant(organizationAId, teamAId)])
      .mockResolvedValueOnce([prospectorGrant(organizationAId, teamAId, prospectorAId)]);

    userRepository.findById.mockResolvedValue(prospectorA);

    await expect(
      service.resolve({
        tenantId,

        userId,

        filters: {
          userId: prospectorAId,
        },
      }),
    ).resolves.toEqual({
      authority: 'manager',

      organizationId: organizationAId,

      teamId: teamAId,
    });

    expect(authorizationService.getUserGrants).toHaveBeenNthCalledWith(
      2,

      tenantId,

      prospectorAId,
    );
  });

  it('masks a prospector filter outside the manager team', async () => {
    authorizationService.getUserGrants
      .mockResolvedValueOnce([managerGrant(organizationAId, teamAId)])
      .mockResolvedValueOnce([prospectorGrant(organizationBId, teamBId, prospectorBId)]);

    userRepository.findById.mockResolvedValue(prospectorB);

    await expect(
      service.resolve({
        tenantId,

        userId,

        filters: {
          userId: prospectorBId,
        },
      }),
    ).rejects.toThrow('Reporting resource not found');
  });

  it('masks a campaign outside a manager organization', async () => {
    authorizationService.getUserGrants.mockResolvedValue([managerGrant(organizationAId, teamAId)]);

    campaignRepository.findById.mockResolvedValue(campaignB);

    await expect(
      service.resolve({
        tenantId,

        userId,

        filters: {
          campaignId: campaignBId,
        },
      }),
    ).rejects.toThrow('Reporting resource not found');
  });

  it('uses client admin authority before lower scoped grants', async () => {
    authorizationService.getUserGrants.mockResolvedValue([
      managerGrant(organizationAId, teamAId),

      directorGrant(organizationAId),

      clientAdminGrant(),
    ]);

    organizationRepository.findById.mockResolvedValue(organizationB);

    teamRepository.findById.mockResolvedValue(teamB);

    campaignRepository.findById.mockResolvedValue(campaignB);

    await expect(
      service.resolve({
        tenantId,

        userId,

        filters: {
          organizationId: organizationBId,

          teamId: teamBId,

          campaignId: campaignBId,
        },
      }),
    ).resolves.toEqual({
      authority: 'client_admin',

      organizationId: null,

      teamId: null,
    });
  });
});
