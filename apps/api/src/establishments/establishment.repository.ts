import { and, asc, eq, sql } from 'drizzle-orm';
import { Inject, Injectable } from '@nestjs/common';

import { DATABASE } from '../database/database.constants.js';
import type { Database, DatabaseExecutor } from '../database/database.types.js';
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

  async create(
    input: NewEstablishment,
    executor: DatabaseExecutor = this.database,
  ): Promise<Establishment> {
    const [establishment] = await executor.insert(establishments).values(input).returning();

    if (!establishment) {
      throw new Error('Failed to create establishment');
    }

    return establishment;
  }

  async findById(
    tenantId: string,
    establishmentId: string,
    executor: DatabaseExecutor = this.database,
  ): Promise<Establishment | null> {
    const [establishment] = await executor
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

  async findByExternalReference(
    tenantId: string,
    source: Establishment['source'],
    externalReference: string,
    executor: DatabaseExecutor = this.database,
  ): Promise<Establishment | null> {
    const [establishment] = await executor
      .select()
      .from(establishments)
      .where(
        and(
          eq(establishments.tenantId, tenantId),
          eq(establishments.source, source),
          eq(establishments.externalReference, externalReference),
        ),
      )
      .limit(1);

    return establishment ?? null;
  }

  async findByIdentity(
    tenantId: string,
    normalizedName: string,
    postalCode: string | null,
    city: string | null,
    countryCode: string,
    executor: DatabaseExecutor = this.database,
  ): Promise<Establishment | null> {
    const normalizedPostalCode = this.normalizeLookupText(postalCode);

    const normalizedCity = this.normalizeLookupText(city);

    const [establishment] = await executor
      .select()
      .from(establishments)
      .where(
        and(
          eq(establishments.tenantId, tenantId),

          eq(establishments.normalizedName, normalizedName),

          eq(establishments.countryCode, countryCode),

          sql`
            lower(
              btrim(
                coalesce(
                  ${establishments.postalCode},
                  ''
                )
              )
            )
            =
            ${normalizedPostalCode}
          `,

          sql`
            lower(
              btrim(
                coalesce(
                  ${establishments.city},
                  ''
                )
              )
            )
            =
            ${normalizedCity}
          `,
        ),
      )
      .limit(1);

    return establishment ?? null;
  }

  private normalizeLookupText(value: string | null): string {
    return value?.trim().toLowerCase() ?? '';
  }
}
