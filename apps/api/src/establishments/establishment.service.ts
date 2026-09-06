import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type {
  Establishment,
  EstablishmentSource,
  EstablishmentStatus,
} from '../database/schema/establishments.js';
import { EstablishmentRepository, type UpdateEstablishment } from './establishment.repository.js';
import { normalizeEstablishmentName } from './establishment.utils.js';

export interface CreateEstablishmentInput {
  tenantId: string;
  name: string;
  externalReference?: string | null;
  addressLine1?: string | null;
  postalCode?: string | null;
  city?: string | null;
  countryCode: string;
  phone?: string | null;
  website?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  source?: EstablishmentSource;
}

export interface UpdateEstablishmentInput {
  name?: string;
  externalReference?: string | null;
  addressLine1?: string | null;
  postalCode?: string | null;
  city?: string | null;
  countryCode?: string;
  phone?: string | null;
  website?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status?: EstablishmentStatus;
}

@Injectable()
export class EstablishmentService {
  constructor(private readonly establishmentRepository: EstablishmentRepository) {}

  async create(input: CreateEstablishmentInput): Promise<Establishment> {
    const name = input.name.trim();

    if (!name) {
      throw new BadRequestException('Establishment name is required');
    }

    const countryCode = this.normalizeCountryCode(input.countryCode);

    this.validateCoordinates(input.latitude, input.longitude);

    try {
      return await this.establishmentRepository.create({
        tenantId: input.tenantId,
        name,
        normalizedName: normalizeEstablishmentName(name),
        externalReference: this.normalizeOptionalText(input.externalReference),
        addressLine1: this.normalizeOptionalText(input.addressLine1),
        postalCode: this.normalizeOptionalText(input.postalCode),
        city: this.normalizeOptionalText(input.city),
        countryCode,
        phone: this.normalizeOptionalText(input.phone),
        website: this.normalizeOptionalText(input.website),
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        source: input.source ?? 'manual',
        status: 'active',
      });
    } catch (error: unknown) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Establishment external reference already exists');
      }

      throw error;
    }
  }

  async findById(tenantId: string, establishmentId: string): Promise<Establishment> {
    const establishment = await this.establishmentRepository.findById(tenantId, establishmentId);

    if (!establishment) {
      throw new NotFoundException('Establishment not found');
    }

    return establishment;
  }

  async list(tenantId: string): Promise<Establishment[]> {
    return this.establishmentRepository.findByTenant(tenantId);
  }

  async update(
    tenantId: string,
    establishmentId: string,
    input: UpdateEstablishmentInput,
  ): Promise<Establishment> {
    const update: UpdateEstablishment = {};

    if (input.name !== undefined) {
      const name = input.name.trim();

      if (!name) {
        throw new BadRequestException('Establishment name is required');
      }

      update.name = name;
      update.normalizedName = normalizeEstablishmentName(name);
    }

    if (input.externalReference !== undefined) {
      update.externalReference = this.normalizeOptionalText(input.externalReference);
    }

    if (input.addressLine1 !== undefined) {
      update.addressLine1 = this.normalizeOptionalText(input.addressLine1);
    }

    if (input.postalCode !== undefined) {
      update.postalCode = this.normalizeOptionalText(input.postalCode);
    }

    if (input.city !== undefined) {
      update.city = this.normalizeOptionalText(input.city);
    }

    if (input.countryCode !== undefined) {
      update.countryCode = this.normalizeCountryCode(input.countryCode);
    }

    if (input.phone !== undefined) {
      update.phone = this.normalizeOptionalText(input.phone);
    }

    if (input.website !== undefined) {
      update.website = this.normalizeOptionalText(input.website);
    }

    if (input.latitude !== undefined || input.longitude !== undefined) {
      const current = await this.findById(tenantId, establishmentId);

      const latitude = input.latitude !== undefined ? input.latitude : current.latitude;

      const longitude = input.longitude !== undefined ? input.longitude : current.longitude;

      this.validateCoordinates(latitude, longitude);

      update.latitude = latitude;
      update.longitude = longitude;
    }

    if (input.status !== undefined) {
      update.status = input.status;
    }

    try {
      const establishment = await this.establishmentRepository.update(
        tenantId,
        establishmentId,
        update,
      );

      if (!establishment) {
        throw new NotFoundException('Establishment not found');
      }

      return establishment;
    } catch (error: unknown) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Establishment external reference already exists');
      }

      throw error;
    }
  }

  private normalizeCountryCode(value: string): string {
    const normalized = value.trim().toUpperCase();

    if (!/^[A-Z]{2}$/.test(normalized)) {
      throw new BadRequestException('Country code must contain exactly two letters');
    }

    return normalized;
  }

  private normalizeOptionalText(value: string | null | undefined): string | null {
    if (value == null) {
      return null;
    }

    const normalized = value.trim();

    return normalized || null;
  }

  private validateCoordinates(
    latitude: number | null | undefined,
    longitude: number | null | undefined,
  ): void {
    const hasLatitude = latitude !== null && latitude !== undefined;

    const hasLongitude = longitude !== null && longitude !== undefined;

    if (hasLatitude !== hasLongitude) {
      throw new BadRequestException('Latitude and longitude must be provided together');
    }

    if (hasLatitude && (latitude < -90 || latitude > 90)) {
      throw new BadRequestException('Latitude must be between -90 and 90');
    }

    if (hasLongitude && (longitude < -180 || longitude > 180)) {
      throw new BadRequestException('Longitude must be between -180 and 180');
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    if (typeof error !== 'object' || error === null || !('cause' in error)) {
      return false;
    }

    const cause = error.cause;

    return typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === '23505';
  }
}
