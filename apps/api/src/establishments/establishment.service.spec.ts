import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Establishment } from '../database/schema/establishments.js';
import { EstablishmentRepository } from './establishment.repository.js';
import { EstablishmentService } from './establishment.service.js';

describe('EstablishmentService', () => {
  let repository: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findByTenant: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };

  let service: EstablishmentService;

  const establishment: Establishment = {
    id: '11111111-1111-4111-8111-111111111111',
    tenantId: '22222222-2222-4222-8222-222222222222',
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

    service = new EstablishmentService(repository as unknown as EstablishmentRepository);
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
        name: 'Restaurant   Le Paris',
        normalizedName: 'restaurant le paris',
        countryCode: 'FR',
        postalCode: '75001',
        city: 'Paris',
        source: 'manual',
        status: 'active',
      }),
    );
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

    await expect(service.findById(establishment.tenantId, establishment.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
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

    expect(repository.findByTenant).toHaveBeenCalledWith(establishment.tenantId);

    expect(result).toEqual([establishment]);
  });

  it('updates the name and normalized name together', async () => {
    repository.update.mockResolvedValue({
      ...establishment,
      name: 'New Restaurant',
      normalizedName: 'new restaurant',
    });

    await service.update(establishment.tenantId, establishment.id, {
      name: '  New Restaurant  ',
    });

    expect(repository.update).toHaveBeenCalledWith(
      establishment.tenantId,
      establishment.id,
      expect.objectContaining({
        name: 'New Restaurant',
        normalizedName: 'new restaurant',
      }),
    );
  });
});
