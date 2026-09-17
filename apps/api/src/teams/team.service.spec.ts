import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Organization } from '../database/schema/organizations.js';
import { Team } from '../database/schema/teams.js';
import { OrganizationRepository } from '../organizations/organization.repository.js';
import { TeamRepository } from './team.repository.js';
import { TeamService } from './team.service.js';

describe('TeamService', () => {
  let teamRepository: TeamRepository;
  let organizationRepository: OrganizationRepository;
  let service: TeamService;

  const tenantId = '11111111-1111-4111-8111-111111111111';

  const organization: Organization = {
    id: '22222222-2222-4222-8222-222222222222',
    tenantId,
    name: 'France Sales',
    slug: 'france-sales',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const team: Team = {
    id: '33333333-3333-4333-8333-333333333333',
    tenantId,
    organizationId: organization.id,
    name: 'Paris Prospecting',
    slug: 'paris-prospecting',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    teamRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findBySlug: vi.fn(),
      findByOrganization: vi.fn(),
      updateStatus: vi.fn(),
    } as unknown as TeamRepository;

    organizationRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findBySlug: vi.fn(),
      findByTenant: vi.fn(),
      updateStatus: vi.fn(),
    } as unknown as OrganizationRepository;

    service = new TeamService(teamRepository, organizationRepository);
  });

  it('normalizes team data before creation', async () => {
    vi.mocked(organizationRepository.findById).mockResolvedValue(organization);

    vi.mocked(teamRepository.findBySlug).mockResolvedValue(null);
    vi.mocked(teamRepository.create).mockResolvedValue(team);

    await service.create({
      tenantId,
      organizationId: organization.id,
      name: '  Paris Prospecting  ',
      slug: '  PARIS-PROSPECTING  ',
    });

    expect(organizationRepository.findById).toHaveBeenCalledWith(tenantId, organization.id);

    expect(teamRepository.create).toHaveBeenCalledWith({
      tenantId,
      organizationId: organization.id,
      name: 'Paris Prospecting',
      slug: 'paris-prospecting',
      status: 'active',
    });
  });

  it('rejects creation when organization does not belong to tenant', async () => {
    vi.mocked(organizationRepository.findById).mockResolvedValue(null);

    await expect(
      service.create({
        tenantId,
        organizationId: organization.id,
        name: 'Paris Prospecting',
        slug: 'paris-prospecting',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(teamRepository.create).not.toHaveBeenCalled();
  });

  it('rejects duplicate team slug inside organization', async () => {
    vi.mocked(organizationRepository.findById).mockResolvedValue(organization);

    vi.mocked(teamRepository.findBySlug).mockResolvedValue(team);

    await expect(
      service.create({
        tenantId,
        organizationId: organization.id,
        name: 'Another Paris Team',
        slug: 'PARIS-PROSPECTING',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(teamRepository.create).not.toHaveBeenCalled();
  });

  it('lists teams only after validating the organization belongs to the tenant', async () => {
    vi.mocked(organizationRepository.findById).mockResolvedValue(organization);

    vi.mocked(teamRepository.findByOrganization).mockResolvedValue([team]);

    const result = await service.findByOrganization(tenantId, organization.id);

    expect(organizationRepository.findById).toHaveBeenCalledWith(tenantId, organization.id);

    expect(teamRepository.findByOrganization).toHaveBeenCalledWith(tenantId, organization.id);

    expect(result).toEqual([team]);
  });

  it('rejects team listing when organization does not belong to tenant', async () => {
    vi.mocked(organizationRepository.findById).mockResolvedValue(null);

    await expect(service.findByOrganization(tenantId, organization.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(teamRepository.findByOrganization).not.toHaveBeenCalled();
  });

  it('updates team status inside the tenant and organization', async () => {
    const inactiveTeam: Team = {
      ...team,
      status: 'inactive',
      updatedAt: new Date(),
    };

    vi.mocked(organizationRepository.findById).mockResolvedValue(organization);

    vi.mocked(teamRepository.updateStatus).mockResolvedValue(inactiveTeam);

    const result = await service.updateStatus(tenantId, organization.id, team.id, 'inactive');

    expect(teamRepository.updateStatus).toHaveBeenCalledWith(
      tenantId,
      organization.id,
      team.id,
      'inactive',
    );

    expect(result).toBe(inactiveTeam);
  });

  it('rejects team status update when organization does not belong to tenant', async () => {
    vi.mocked(organizationRepository.findById).mockResolvedValue(null);

    await expect(
      service.updateStatus(tenantId, organization.id, team.id, 'inactive'),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(teamRepository.updateStatus).not.toHaveBeenCalled();
  });

  it('rejects team status update when team does not belong to the organization', async () => {
    vi.mocked(organizationRepository.findById).mockResolvedValue(organization);

    vi.mocked(teamRepository.updateStatus).mockResolvedValue(null);

    await expect(
      service.updateStatus(tenantId, organization.id, team.id, 'inactive'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
