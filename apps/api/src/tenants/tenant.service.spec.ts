import { ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Tenant } from '../database/schema/tenants.js';
import { TenantRepository } from './tenant.repository.js';
import { TenantService } from './tenant.service.js';

describe('TenantService', () => {
  let repository: TenantRepository;
  let service: TenantService;

  const existingTenant: Tenant = {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Intertrad',
    slug: 'intertrad',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    repository = {
      create: vi.fn(),
      findById: vi.fn(),
      findBySlug: vi.fn(),
    } as unknown as TenantRepository;

    service = new TenantService(repository);
  });

  it('normalizes tenant data before creation', async () => {
    vi.mocked(repository.findBySlug).mockResolvedValue(null);
    vi.mocked(repository.create).mockResolvedValue(existingTenant);

    await service.create({
      name: '  Intertrad  ',
      slug: '  INTERTRAD  ',
    });

    expect(repository.findBySlug).toHaveBeenCalledWith('intertrad');

    expect(repository.create).toHaveBeenCalledWith({
      name: 'Intertrad',
      slug: 'intertrad',
      status: 'active',
    });
  });

  it('rejects an existing tenant slug', async () => {
    vi.mocked(repository.findBySlug).mockResolvedValue(existingTenant);

    await expect(
      service.create({
        name: 'Another Intertrad',
        slug: 'INTERTRAD',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(repository.create).not.toHaveBeenCalled();
  });

  it('normalizes slug when finding a tenant', async () => {
    vi.mocked(repository.findBySlug).mockResolvedValue(existingTenant);

    const result = await service.findBySlug('  INTERTRAD  ');

    expect(repository.findBySlug).toHaveBeenCalledWith('intertrad');
    expect(result).toEqual(existingTenant);
  });
});
