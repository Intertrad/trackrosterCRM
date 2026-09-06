import { sql } from 'drizzle-orm';
import {
  check,
  doublePrecision,
  index,
  pgEnum,
  pgTable,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { tenants } from './tenants.js';

export const establishmentStatusEnum = pgEnum('establishment_status', [
  'active',
  'inactive',
  'archived',
]);

export const establishmentSourceEnum = pgEnum('establishment_source', ['manual', 'import', 'api']);

export const establishments = pgTable(
  'establishments',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),

    externalReference: varchar('external_reference', {
      length: 255,
    }),

    name: varchar('name', {
      length: 255,
    }).notNull(),

    normalizedName: varchar('normalized_name', {
      length: 255,
    }).notNull(),

    addressLine1: varchar('address_line1', {
      length: 255,
    }),

    postalCode: varchar('postal_code', {
      length: 32,
    }),

    city: varchar('city', {
      length: 150,
    }),

    countryCode: varchar('country_code', {
      length: 2,
    }).notNull(),

    phone: varchar('phone', {
      length: 50,
    }),

    website: varchar('website', {
      length: 2048,
    }),

    latitude: doublePrecision('latitude'),

    longitude: doublePrecision('longitude'),

    status: establishmentStatusEnum('status').default('active').notNull(),

    source: establishmentSourceEnum('source').default('manual').notNull(),

    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'date',
    })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp('updated_at', {
      withTimezone: true,
      mode: 'date',
    })
      .defaultNow()
      .notNull(),
  },

  (table) => [
    /*
     * Useful for future tenant-safe composite
     * relationships such as campaigns,
     * assignments and actions.
     */
    unique('establishments_tenant_id_id_unique').on(table.tenantId, table.id),

    /*
     * External references only need to be
     * unique when one actually exists.
     *
     * The source is part of the identity because
     * two external systems may both have record "123".
     */
    uniqueIndex('establishments_tenant_source_external_reference_unique')
      .on(table.tenantId, table.source, table.externalReference)
      .where(sql`${table.externalReference} IS NOT NULL`),

    index('establishments_tenant_id_idx').on(table.tenantId),

    index('establishments_tenant_normalized_name_idx').on(table.tenantId, table.normalizedName),

    index('establishments_tenant_postal_code_idx').on(table.tenantId, table.postalCode),

    index('establishments_tenant_city_idx').on(table.tenantId, table.city),

    check(
      'establishments_country_code_uppercase_check',
      sql`
        ${table.countryCode}
        =
        upper(${table.countryCode})
      `,
    ),

    check(
      'establishments_coordinates_pair_check',
      sql`
        (
          ${table.latitude} IS NULL
          AND ${table.longitude} IS NULL
        )
        OR
        (
          ${table.latitude} IS NOT NULL
          AND ${table.longitude} IS NOT NULL
        )
      `,
    ),

    check(
      'establishments_latitude_range_check',
      sql`
        ${table.latitude} IS NULL
        OR
        (
          ${table.latitude} >= -90
          AND ${table.latitude} <= 90
        )
      `,
    ),

    check(
      'establishments_longitude_range_check',
      sql`
        ${table.longitude} IS NULL
        OR
        (
          ${table.longitude} >= -180
          AND ${table.longitude} <= 180
        )
      `,
    ),
  ],
);

export type Establishment = typeof establishments.$inferSelect;

export type NewEstablishment = typeof establishments.$inferInsert;

export type EstablishmentStatus = (typeof establishmentStatusEnum.enumValues)[number];

export type EstablishmentSource = (typeof establishmentSourceEnum.enumValues)[number];
