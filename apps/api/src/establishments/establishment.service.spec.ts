import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Establishment } from '../database/schema/establishments.js';
import type { Region } from '../database/schema/regions.js';
import { RegionRepository } from '../regions/region.repository.js';
import { EstablishmentRepository } from './establishment.repository.js';
import { EstablishmentService } from './establishment.service.js';

describe('EstablishmentService', () => {
  let repository: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findByTenant: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };

  let regionRepository: {
    findById: ReturnType<typeof vi.fn>;
  };

  let service: EstablishmentService;

  const establishment: Establishment = {
    id: '11111111-1111-4111-8111-111111111111',

    tenantId: '22222222-2222-4222-8222-222222222222',

    regionId: null,

    externalReference: null,

    name: 'Restaurant Le Paris',

    normalizedName: 'restaurant le paris',

    addressLine1: null,

    postalCode: '75001',

    city: 'Paris',

    countryCode: 'FR',

    phone: null,

    website: null,

    latitude: null,

    longitude: null,

    status: 'active',

    source: 'manual',

    category: null,
    createdAt: new Date(),

    updatedAt: new Date(),
  };

  const region: Region = {
    id: '33333333-3333-4333-8333-333333333333',

    tenantId: establishment.tenantId,

    name: 'Paris',

    code: 'PARIS',

    type: 'city',

    parentRegionId: null,

    status: 'active',

    createdAt: new Date(),

    updatedAt: new Date(),
  };

  beforeEach(() => {
    repository = {
      create: vi.fn(),

      findById: vi.fn(),

      findByTenant: vi.fn(),

      update: vi.fn(),
    };

    regionRepository = {
      findById: vi.fn(),
    };

    service = new EstablishmentService(
      repository as unknown as EstablishmentRepository,

      regionRepository as unknown as RegionRepository,
    );
  });

  it('creates and normalizes an establishment', async () => {
    repository.create.mockResolvedValue(establishment);

    await service.create({
      tenantId: establishment.tenantId,

      name: '  Restaurant   Le Paris  ',

      countryCode: 'fr',

      postalCode: ' 75001 ',

      city: ' Paris ',
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: establishment.tenantId,

        regionId: null,

        name: 'Restaurant   Le Paris',

        normalizedName: 'restaurant le paris',

        countryCode: 'FR',

        postalCode: '75001',

        city: 'Paris',

        source: 'manual',

        status: 'active',
      }),

      undefined,
    );

    expect(regionRepository.findById).not.toHaveBeenCalled();
  });

  it('creates an establishment assigned to an active region', async () => {
    regionRepository.findById.mockResolvedValue(region);

    repository.create.mockResolvedValue({
      ...establishment,

      regionId: region.id,
    });

    const result = await service.create({
      tenantId: establishment.tenantId,

      regionId: region.id,

      name: 'Restaurant Le Paris',

      countryCode: 'FR',
    });

    expect(regionRepository.findById).toHaveBeenCalledWith(
      establishment.tenantId,

      region.id,

      undefined,
    );

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: establishment.tenantId,

        regionId: region.id,
      }),

      undefined,
    );

    expect(result.regionId).toBe(region.id);
  });

  it('rejects an unknown region during establishment creation', async () => {
    regionRepository.findById.mockResolvedValue(null);

    await expect(
      service.create({
        tenantId: establishment.tenantId,

        regionId: region.id,

        name: 'Restaurant Le Paris',

        countryCode: 'FR',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rejects an inactive region during establishment creation', async () => {
    regionRepository.findById.mockResolvedValue({
      ...region,

      status: 'inactive',
    });

    await expect(
      service.create({
        tenantId: establishment.tenantId,

        regionId: region.id,

        name: 'Restaurant Le Paris',

        countryCode: 'FR',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rejects a blank name', async () => {
    await expect(
      service.create({
        tenantId: establishment.tenantId,

        name: '   ',

        countryCode: 'FR',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rejects an invalid country code', async () => {
    await expect(
      service.create({
        tenantId: establishment.tenantId,

        name: 'Test',

        countryCode: 'FRA',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires latitude and longitude together', async () => {
    await expect(
      service.create({
        tenantId: establishment.tenantId,

        name: 'Test',

        countryCode: 'FR',

        latitude: 48.8566,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns 404 for an unknown establishment', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(
      service.findById(
        establishment.tenantId,

        establishment.id,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('maps duplicate external references to conflict', async () => {
    repository.create.mockRejectedValue({
      cause: {
        code: '23505',
      },
    });

    await expect(
      service.create({
        tenantId: establishment.tenantId,

        name: 'Test',

        countryCode: 'FR',

        externalReference: 'ABC-123',

        source: 'import',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('lists tenant establishments', async () => {
    repository.findByTenant.mockResolvedValue([establishment]);

    const result = await service.list(establishment.tenantId);

    /* No category argument means no category filter, not "filter by undefined". */
    expect(repository.findByTenant).toHaveBeenCalledWith(establishment.tenantId, undefined);

    expect(result).toEqual([establishment]);
  });

  it('passes a category filter through to the repository', async () => {
    repository.findByTenant.mockResolvedValue([establishment]);

    await service.list(establishment.tenantId, 'cra');

    expect(repository.findByTenant).toHaveBeenCalledWith(establishment.tenantId, 'cra');
  });

  it('updates the name and normalized name together', async () => {
    repository.update.mockResolvedValue({
      ...establishment,

      name: 'New Restaurant',

      normalizedName: 'new restaurant',
    });

    await service.update(
      establishment.tenantId,

      establishment.id,

      {
        name: '  New Restaurant  ',
      },
    );

    expect(repository.update).toHaveBeenCalledWith(
      establishment.tenantId,

      establishment.id,

      expect.objectContaining({
        name: 'New Restaurant',

        normalizedName: 'new restaurant',
      }),
    );
  });

  it('assigns an active region during update', async () => {
    regionRepository.findById.mockResolvedValue(region);

    repository.update.mockResolvedValue({
      ...establishment,

      regionId: region.id,
    });

    const result = await service.update(
      establishment.tenantId,

      establishment.id,

      {
        regionId: region.id,
      },
    );

    expect(regionRepository.findById).toHaveBeenCalledWith(
      establishment.tenantId,

      region.id,

      undefined,
    );

    expect(repository.update).toHaveBeenCalledWith(
      establishment.tenantId,

      establishment.id,

      expect.objectContaining({
        regionId: region.id,
      }),
    );

    expect(result.regionId).toBe(region.id);
  });

  it('clears a region assignment with null', async () => {
    repository.update.mockResolvedValue({
      ...establishment,

      regionId: null,
    });

    await service.update(
      establishment.tenantId,

      establishment.id,

      {
        regionId: null,
      },
    );

    expect(regionRepository.findById).not.toHaveBeenCalled();

    expect(repository.update).toHaveBeenCalledWith(
      establishment.tenantId,

      establishment.id,

      expect.objectContaining({
        regionId: null,
      }),
    );
  });

  it('rejects an unknown region during update', async () => {
    regionRepository.findById.mockResolvedValue(null);

    await expect(
      service.update(
        establishment.tenantId,

        establishment.id,

        {
          regionId: region.id,
        },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(repository.update).not.toHaveBeenCalled();
  });

  it('rejects an archived region during update', async () => {
    regionRepository.findById.mockResolvedValue({
      ...region,

      status: 'archived',
    });

    await expect(
      service.update(
        establishment.tenantId,

        establishment.id,

        {
          regionId: region.id,
        },
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(repository.update).not.toHaveBeenCalled();
  });
});
