import { ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Organization } from '../database/schema/organizations.js';
import { Tenant } from '../database/schema/tenants.js';
import { TenantRepository } from '../tenants/tenant.repository.js';
import { OrganizationRepository } from './organization.repository.js';
import { OrganizationService } from './organization.service.js';

describe('OrganizationService', () => {
  let organizationRepository: OrganizationRepository;
  let tenantRepository: TenantRepository;
  let service: OrganizationService;

  const tenant: Tenant = {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Intertrad',
    slug: 'intertrad',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const organization: Organization = {
    id: '22222222-2222-4222-8222-222222222222',
    tenantId: tenant.id,
    name: 'France Sales',
    slug: 'france-sales',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    organizationRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findBySlug: vi.fn(),
      findByTenant: vi.fn(),
    } as unknown as OrganizationRepository;

    tenantRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findBySlug: vi.fn(),
    } as unknown as TenantRepository;

    service = new OrganizationService(organizationRepository, tenantRepository);
  });

  it('normalizes organization data before creation', async () => {
    vi.mocked(tenantRepository.findById).mockResolvedValue(tenant);
    vi.mocked(organizationRepository.findBySlug).mockResolvedValue(null);
    vi.mocked(organizationRepository.create).mockResolvedValue(organization);

    await service.create({
      tenantId: tenant.id,
      name: '  France Sales  ',
      slug: '  FRANCE-SALES  ',
    });

    expect(organizationRepository.findBySlug).toHaveBeenCalledWith(tenant.id, 'france-sales');

    expect(organizationRepository.create).toHaveBeenCalledWith({
      tenantId: tenant.id,
      name: 'France Sales',
      slug: 'france-sales',
      status: 'active',
    });
  });

  it('rejects creation when tenant does not exist', async () => {
    vi.mocked(tenantRepository.findById).mockResolvedValue(null);

    await expect(
      service.create({
        tenantId: tenant.id,
        name: 'France Sales',
        slug: 'france-sales',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(organizationRepository.create).not.toHaveBeenCalled();
  });

  it('rejects duplicate organization slug inside tenant', async () => {
    vi.mocked(tenantRepository.findById).mockResolvedValue(tenant);
    vi.mocked(organizationRepository.findBySlug).mockResolvedValue(organization);

    await expect(
      service.create({
        tenantId: tenant.id,
        name: 'Another France Sales',
        slug: 'FRANCE-SALES',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(organizationRepository.create).not.toHaveBeenCalled();
  });
});
