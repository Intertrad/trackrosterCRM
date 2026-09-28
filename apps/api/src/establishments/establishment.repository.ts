import { and, asc, eq, getTableColumns, isNotNull, sql } from 'drizzle-orm';
import { Inject, Injectable } from '@nestjs/common';

import { DATABASE } from '../database/database.constants.js';
import type { Database, DatabaseExecutor } from '../database/database.types.js';
import {
  establishments,
  type Establishment,
  type EstablishmentCategory,
  type NewEstablishment,
} from '../database/schema/establishments.js';

const { location: internalLocationColumn, ...establishmentColumns } =
  getTableColumns(establishments);

/*
 * Prevent TypeScript/no-unused-locals from treating
 * the intentionally omitted internal column as
 * accidental.
 */
void internalLocationColumn;

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
    | 'category'
    | 'regionId'
  >
>;

export type NearbyEstablishment = Establishment & {
  distanceMeters: number;
};

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
    const [establishment] = await executor
      .insert(establishments)
      .values(input)
      .returning(establishmentColumns);

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
      .select(establishmentColumns)
      .from(establishments)
      .where(and(eq(establishments.tenantId, tenantId), eq(establishments.id, establishmentId)))
      .limit(1);

    return establishment ?? null;
  }

  async findByTenant(tenantId: string, category?: EstablishmentCategory): Promise<Establishment[]> {
    return this.database
      .select(establishmentColumns)
      .from(establishments)
      .where(
        category
          ? and(eq(establishments.tenantId, tenantId), eq(establishments.category, category))
          : eq(establishments.tenantId, tenantId),
      )
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
      .returning(establishmentColumns);

    return establishment ?? null;
  }

  /*
   * Searches are performed using geography rather
   * than geometry because geography gives distance
   * and radius semantics in meters on WGS84.
   *
   * Tenant filtering is mandatory and lives inside
   * the database query rather than being applied
   * after results are loaded.
   */
  async findNearby(
    tenantId: string,
    latitude: number,
    longitude: number,
    radiusMeters: number,
    limit: number,
    executor: DatabaseExecutor = this.database,
  ): Promise<NearbyEstablishment[]> {
    const queryPoint = sql`
      ST_SetSRID(
        ST_MakePoint(
          ${longitude},
          ${latitude}
        ),
        4326
      )::geography
    `;

    const distanceMeters = sql<number>`
      ST_Distance(
        ${establishments.location}::geography,
        ${queryPoint}
      )
    `.mapWith(Number);

    const results = await executor
      .select({
        ...establishmentColumns,

        distanceMeters,
      })
      .from(establishments)
      .where(
        and(
          /*
           * Never allow spatial searches to cross
           * tenant boundaries.
           */
          eq(establishments.tenantId, tenantId),

          isNotNull(establishments.location),

          sql`
            ST_DWithin(
              ${establishments.location}::geography,
              ${queryPoint},
              ${radiusMeters}
            )
          `,
        ),
      )
      .orderBy(
        distanceMeters,

        /*
         * Deterministic ordering for establishments
         * at identical/effectively identical distance.
         */
        asc(establishments.id),
      )
      .limit(limit);

    return results;
  }

  async findByExternalReference(
    tenantId: string,
    source: Establishment['source'],
    externalReference: string,
    executor: DatabaseExecutor = this.database,
  ): Promise<Establishment | null> {
    const [establishment] = await executor
      .select(establishmentColumns)
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
      .select(establishmentColumns)
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
