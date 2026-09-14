import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { EstablishmentContact } from '../database/schema/establishment-contacts.js';
import type { Establishment } from '../database/schema/establishments.js';
import { EstablishmentRepository } from '../establishments/establishment.repository.js';
import { EstablishmentContactRepository } from './establishment-contact.repository.js';
import { EstablishmentContactService } from './establishment-contact.service.js';

describe('EstablishmentContactService', () => {
  let contactRepository: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findByEstablishment: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };

  let establishmentRepository: {
    findById: ReturnType<typeof vi.fn>;
  };

  let service: EstablishmentContactService;

  const establishment: Establishment = {
    id: '11111111-1111-4111-8111-111111111111',
    regionId: null,
    tenantId: '22222222-2222-4222-8222-222222222222',

    externalReference: null,
    name: 'Restaurant Paris',
    normalizedName: 'restaurant paris',

    addressLine1: null,
    postalCode: null,
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

  const contact: EstablishmentContact = {
    id: '33333333-3333-4333-8333-333333333333',

    tenantId: establishment.tenantId,

    establishmentId: establishment.id,

    name: 'Marie Dupont',
    jobTitle: 'Purchasing Manager',

    email: 'marie@example.com',

    phone: '+33123456789',

    isPrimary: true,

    status: 'active',
    source: 'manual',

    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    contactRepository = {
      create: vi.fn(),
      findById: vi.fn(),
      findByEstablishment: vi.fn(),
      update: vi.fn(),
    };

    establishmentRepository = {
      findById: vi.fn(),
    };

    service = new EstablishmentContactService(
      contactRepository as unknown as EstablishmentContactRepository,

      establishmentRepository as unknown as EstablishmentRepository,
    );
  });

  it('creates and normalizes a contact', async () => {
    establishmentRepository.findById.mockResolvedValue(establishment);

    contactRepository.create.mockResolvedValue(contact);

    await service.create({
      tenantId: establishment.tenantId,

      establishmentId: establishment.id,

      name: '  Marie Dupont  ',

      jobTitle: ' Purchasing Manager ',

      email: ' MARIE@EXAMPLE.COM ',

      phone: ' +33123456789 ',

      isPrimary: true,
    });

    expect(contactRepository.create).toHaveBeenCalledWith({
      tenantId: establishment.tenantId,

      establishmentId: establishment.id,

      name: 'Marie Dupont',

      jobTitle: 'Purchasing Manager',

      email: 'marie@example.com',

      phone: '+33123456789',

      isPrimary: true,
      status: 'active',
      source: 'manual',
    });
  });

  it('rejects a contact with no identity information', async () => {
    establishmentRepository.findById.mockResolvedValue(establishment);

    await expect(
      service.create({
        tenantId: establishment.tenantId,

        establishmentId: establishment.id,

        name: '   ',
        email: '   ',
        phone: '   ',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(contactRepository.create).not.toHaveBeenCalled();
  });

  it('returns 404 when the establishment is outside the tenant', async () => {
    establishmentRepository.findById.mockResolvedValue(null);

    await expect(
      service.create({
        tenantId: establishment.tenantId,

        establishmentId: establishment.id,

        name: 'Marie Dupont',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(contactRepository.create).not.toHaveBeenCalled();
  });

  it('maps duplicate contact email to conflict', async () => {
    establishmentRepository.findById.mockResolvedValue(establishment);

    contactRepository.create.mockRejectedValue({
      cause: {
        code: '23505',

        constraint: 'establishment_contacts_tenant_establishment_email_unique',
      },
    });

    await expect(
      service.create({
        tenantId: establishment.tenantId,

        establishmentId: establishment.id,

        email: 'marie@example.com',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('maps a second primary contact to conflict', async () => {
    establishmentRepository.findById.mockResolvedValue(establishment);

    contactRepository.create.mockRejectedValue({
      cause: {
        code: '23505',

        constraint: 'establishment_contacts_primary_unique',
      },
    });

    await expect(
      service.create({
        tenantId: establishment.tenantId,

        establishmentId: establishment.id,

        name: 'John Martin',

        isPrimary: true,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('lists contacts for an existing establishment', async () => {
    establishmentRepository.findById.mockResolvedValue(establishment);

    contactRepository.findByEstablishment.mockResolvedValue([contact]);

    const result = await service.list(establishment.tenantId, establishment.id);

    expect(contactRepository.findByEstablishment).toHaveBeenCalledWith(
      establishment.tenantId,
      establishment.id,
    );

    expect(result).toEqual([contact]);
  });

  it('returns 404 for an unknown contact', async () => {
    contactRepository.findById.mockResolvedValue(null);

    await expect(
      service.findById(establishment.tenantId, establishment.id, contact.id),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('removes primary status when archiving a contact', async () => {
    contactRepository.findById.mockResolvedValue(contact);

    contactRepository.update.mockResolvedValue({
      ...contact,
      isPrimary: false,
      status: 'archived',
    });

    await service.update(establishment.tenantId, establishment.id, contact.id, {
      status: 'archived',
    });

    expect(contactRepository.update).toHaveBeenCalledWith(
      establishment.tenantId,
      establishment.id,
      contact.id,
      expect.objectContaining({
        status: 'archived',
        isPrimary: false,
      }),
    );
  });
});
