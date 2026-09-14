import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EstablishmentRepository,
  type NearbyEstablishment,
  type UpdateEstablishment,
} from './establishment.repository.js';

import type { DatabaseExecutor } from '../database/database.types.js';
import type {
  Establishment,
  EstablishmentSource,
  EstablishmentStatus,
} from '../database/schema/establishments.js';
import { RegionRepository } from '../regions/region.repository.js';
import { normalizeEstablishmentName } from './establishment.utils.js';

export interface CreateEstablishmentInput {
  tenantId: string;

  regionId?: string | null;

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

export interface FindNearbyEstablishmentsInput {
  tenantId: string;

  latitude: number;

  longitude: number;

  radiusMeters: number;

  limit?: number;
}

export interface UpdateEstablishmentInput {
  name?: string;

  regionId?: string | null;

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
  constructor(
    private readonly establishmentRepository: EstablishmentRepository,

    private readonly regionRepository: RegionRepository,
  ) {}

  async create(
    input: CreateEstablishmentInput,
    executor?: DatabaseExecutor,
  ): Promise<Establishment> {
    const name = input.name.trim();

    if (!name) {
      throw new BadRequestException('Establishment name is required');
    }

    const countryCode = this.normalizeCountryCode(input.countryCode);

    this.validateCoordinates(input.latitude, input.longitude);

    /*
     * Region assignment is explicit.
     *
     * We deliberately do not infer a region from
     * country, city, postal code or coordinates.
     */
    if (input.regionId) {
      await this.requireAssignableRegion(input.tenantId, input.regionId, executor);
    }

    const createInput = {
      tenantId: input.tenantId,

      regionId: input.regionId ?? null,

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

      status: 'active' as const,
    };

    try {
      return await this.establishmentRepository.create(createInput, executor);
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
  async findNearby(input: FindNearbyEstablishmentsInput): Promise<NearbyEstablishment[]> {
    this.validateCoordinates(input.latitude, input.longitude);

    if (
      !Number.isInteger(input.radiusMeters) ||
      input.radiusMeters < 1 ||
      input.radiusMeters > 100_000
    ) {
      throw new BadRequestException('Radius must be an integer between 1 and 100000 meters');
    }

    const limit = input.limit ?? 50;

    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new BadRequestException('Limit must be an integer between 1 and 100');
    }

    return this.establishmentRepository.findNearby(
      input.tenantId,
      input.latitude,
      input.longitude,
      input.radiusMeters,
      limit,
    );
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

    /*
     * Support partial coordinate updates while still
     * maintaining the latitude/longitude pair
     * invariant.
     */
    if (input.latitude !== undefined || input.longitude !== undefined) {
      const current = await this.findById(tenantId, establishmentId);

      const latitude = input.latitude !== undefined ? input.latitude : current.latitude;

      const longitude = input.longitude !== undefined ? input.longitude : current.longitude;

      this.validateCoordinates(latitude, longitude);

      update.latitude = latitude;

      update.longitude = longitude;
    }

    /*
     * undefined = do not change region
     * null      = remove region assignment
     * UUID      = validate and assign region
     */
    if (input.regionId !== undefined) {
      if (input.regionId === null) {
        update.regionId = null;
      } else {
        await this.requireAssignableRegion(tenantId, input.regionId);

        update.regionId = input.regionId;
      }
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

  /*
   * RegionRepository always scopes by tenantId.
   *
   * Therefore a region belonging to another tenant
   * is intentionally indistinguishable from a region
   * that does not exist.
   */
  private async requireAssignableRegion(
    tenantId: string,
    regionId: string,
    executor?: DatabaseExecutor,
  ): Promise<void> {
    const region = await this.regionRepository.findById(tenantId, regionId, executor);

    if (!region) {
      throw new NotFoundException('Region not found');
    }

    if (region.status !== 'active') {
      throw new ConflictException('Region is not active');
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
    if (typeof error !== 'object' || error === null) {
      return false;
    }

    if ('code' in error && error.code === '23505') {
      return true;
    }

    if (!('cause' in error)) {
      return false;
    }

    const cause = error.cause;

    return typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === '23505';
  }
}
