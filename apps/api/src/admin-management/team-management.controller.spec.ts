import { RequestMethod } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthGuard } from '../auth/auth.guard.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { ClientAdminGuard } from '../authorization/client-admin.guard.js';
import type { Team } from '../database/schema/teams.js';
import { TeamService } from '../teams/team.service.js';
import { TeamManagementController } from './team-management.controller.js';

describe('TeamManagementController', () => {
  let teamService: {
    findByOrganization: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    updateStatus: ReturnType<typeof vi.fn>;
  };

  let controller: TeamManagementController;

  const tenantId = '11111111-1111-4111-8111-111111111111';

  const actorUserId = '22222222-2222-4222-8222-222222222222';

  const organizationId = '33333333-3333-4333-8333-333333333333';

  const teamId = '44444444-4444-4444-8444-444444444444';

  const auth = {
    tenantId,
    userId: actorUserId,
  } as AuthenticatedUser;

  const team: Team = {
    id: teamId,
    tenantId,
    organizationId,
    name: 'Paris Prospecting',
    slug: 'paris-prospecting',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    teamService = {
      findByOrganization: vi.fn(),
      create: vi.fn(),
      updateStatus: vi.fn(),
    };

    controller = new TeamManagementController(teamService as unknown as TeamService);
  });

  it('uses the authenticated tenant and organization route scope when listing teams', async () => {
    teamService.findByOrganization.mockResolvedValue([team]);

    const result = await controller.list(auth, organizationId);

    expect(teamService.findByOrganization).toHaveBeenCalledWith(tenantId, organizationId);

    expect(result).toEqual([team]);
  });

  it('uses the authenticated tenant and organization route scope when creating a team', async () => {
    teamService.create.mockResolvedValue(team);

    const result = await controller.create(auth, organizationId, {
      name: 'Paris Prospecting',
      slug: 'paris-prospecting',
    });

    expect(teamService.create).toHaveBeenCalledWith({
      tenantId,
      organizationId,
      name: 'Paris Prospecting',
      slug: 'paris-prospecting',
    });

    expect(result).toBe(team);
  });

  it('uses authenticated tenant plus organization and team route ids when updating status', async () => {
    const inactiveTeam: Team = {
      ...team,
      status: 'inactive',
    };

    teamService.updateStatus.mockResolvedValue(inactiveTeam);

    const result = await controller.updateStatus(auth, organizationId, teamId, {
      status: 'inactive',
    });

    expect(teamService.updateStatus).toHaveBeenCalledWith(
      tenantId,
      organizationId,
      teamId,
      'inactive',
    );

    expect(result).toBe(inactiveTeam);
  });

  it('is exposed under the organization teams route', () => {
    expect(Reflect.getMetadata(PATH_METADATA, TeamManagementController)).toBe(
      'organizations/:organizationId/teams',
    );
  });

  it('requires authentication and Client Admin authorization', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, TeamManagementController)).toEqual([
      AuthGuard,
      ClientAdminGuard,
    ]);
  });

  it('exposes the expected team management methods', () => {
    const prototype = TeamManagementController.prototype;

    expect(Reflect.getMetadata(PATH_METADATA, prototype.list)).toBe('/');

    expect(Reflect.getMetadata(METHOD_METADATA, prototype.list)).toBe(RequestMethod.GET);

    expect(Reflect.getMetadata(PATH_METADATA, prototype.create)).toBe('/');

    expect(Reflect.getMetadata(METHOD_METADATA, prototype.create)).toBe(RequestMethod.POST);

    expect(Reflect.getMetadata(PATH_METADATA, prototype.updateStatus)).toBe(':teamId/status');

    expect(Reflect.getMetadata(METHOD_METADATA, prototype.updateStatus)).toBe(RequestMethod.PATCH);
  });
});
