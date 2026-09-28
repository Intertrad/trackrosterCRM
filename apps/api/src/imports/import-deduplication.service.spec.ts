import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Establishment } from '../database/schema/establishments.js';
import { EstablishmentRepository } from '../establishments/establishment.repository.js';
import { ImportDeduplicationService } from './import-deduplication.service.js';

describe('ImportDeduplicationService', () => {
  let repository: {
    findByExternalReference: ReturnType<typeof vi.fn>;

    findByIdentity: ReturnType<typeof vi.fn>;
  };

  let service: ImportDeduplicationService;

  const establishment: Establishment = {
    id: '11111111-1111-4111-8111-111111111111',
    regionId: null,

    tenantId: '22222222-2222-4222-8222-222222222222',

    externalReference: 'REST-001',

    name: 'Restaurant Paris',

    normalizedName: 'restaurant paris',

    addressLine1: null,
    postalCode: '75001',
    city: 'Paris',
    countryCode: 'FR',

    phone: null,
    website: null,

    latitude: null,
    longitude: null,
    category: null,

    status: 'active',
    source: 'import',

    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    repository = {
      findByExternalReference: vi.fn(),

      findByIdentity: vi.fn(),
    };

    service = new ImportDeduplicationService(repository as unknown as EstablishmentRepository);
  });

  it('uses external reference as the first duplicate check', async () => {
    repository.findByExternalReference.mockResolvedValue(establishment);

    const result = await service.findExisting(establishment.tenantId, {
      externalReference: 'REST-001',

      name: 'Restaurant Paris',

      addressLine1: null,
      postalCode: '75001',
      city: 'Paris',
      countryCode: 'FR',

      phone: null,
      website: null,

      latitude: null,
      longitude: null,
      category: null,
    });

    expect(repository.findByExternalReference).toHaveBeenCalledWith(
      establishment.tenantId,
      'import',
      'REST-001',
    );

    expect(repository.findByIdentity).not.toHaveBeenCalled();

    expect(result).toBe(establishment);
  });

  it('falls back to normalized establishment identity', async () => {
    repository.findByExternalReference.mockResolvedValue(null);

    repository.findByIdentity.mockResolvedValue(establishment);

    const result = await service.findExisting(establishment.tenantId, {
      externalReference: 'NEW-REFERENCE',

      name: '  RESTAURANT   PARIS ',

      addressLine1: null,
      postalCode: '75001',
      city: 'Paris',
      countryCode: 'FR',

      phone: null,
      website: null,

      latitude: null,
      longitude: null,
      category: null,
    });

    expect(repository.findByIdentity).toHaveBeenCalledWith(
      establishment.tenantId,
      'restaurant paris',
      '75001',
      'Paris',
      'FR',
    );

    expect(result).toBe(establishment);
  });

  it('uses identity directly when no external reference exists', async () => {
    repository.findByIdentity.mockResolvedValue(null);

    const result = await service.findExisting(establishment.tenantId, {
      externalReference: null,

      name: 'Restaurant Paris',

      addressLine1: null,
      postalCode: '75001',
      city: 'Paris',
      countryCode: 'FR',

      phone: null,
      website: null,

      latitude: null,
      longitude: null,
      category: null,
    });

    expect(repository.findByExternalReference).not.toHaveBeenCalled();

    expect(repository.findByIdentity).toHaveBeenCalled();

    expect(result).toBeNull();
  });
});
