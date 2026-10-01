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
    shortName: null,
    slug: 'france-sales',
    phone: null,
    email: null,
    website: null,
    address: null,
    color: '#05124A',
    currency: 'EUR',
    argumentaire: null,
    prospectedSectors: [],
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
    } as unknown as TeamRepository;

    organizationRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findBySlug: vi.fn(),
      findByTenant: vi.fn(),
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
});
