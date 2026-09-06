import { and, asc, eq } from 'drizzle-orm';
import { Inject, Injectable } from '@nestjs/common';

import { DATABASE } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import {
  establishments,
  type Establishment,
  type NewEstablishment,
} from '../database/schema/establishments.js';

export type UpdateEstablishment = Partial<
  Pick<
    Establishment,
    | 'name'
    | 'normalizedName'
    | 'externalReference'
    | 'addressLine1'
    | 'postalCode'
    | 'city'
    | 'countryCode'
    | 'phone'
    | 'website'
    | 'latitude'
    | 'longitude'
    | 'status'
  >
>;

@Injectable()
export class EstablishmentRepository {
  constructor(
    @Inject(DATABASE)
    private readonly database: Database,
  ) {}

  async create(input: NewEstablishment): Promise<Establishment> {
    const [establishment] = await this.database.insert(establishments).values(input).returning();

    if (!establishment) {
      throw new Error('Failed to create establishment');
    }

    return establishment;
  }

  async findById(tenantId: string, establishmentId: string): Promise<Establishment | null> {
    const [establishment] = await this.database
      .select()
      .from(establishments)
      .where(and(eq(establishments.tenantId, tenantId), eq(establishments.id, establishmentId)))
      .limit(1);

    return establishment ?? null;
  }

  async findByTenant(tenantId: string): Promise<Establishment[]> {
    return this.database
      .select()
      .from(establishments)
      .where(eq(establishments.tenantId, tenantId))
      .orderBy(asc(establishments.createdAt));
  }

  async update(
    tenantId: string,
    establishmentId: string,
    input: UpdateEstablishment,
  ): Promise<Establishment | null> {
    const [establishment] = await this.database
      .update(establishments)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(and(eq(establishments.tenantId, tenantId), eq(establishments.id, establishmentId)))
      .returning();

    return establishment ?? null;
  }
}
