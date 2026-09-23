import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  doublePrecision,
  foreignKey,
  unique,
  uniqueIndex,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { establishments } from './establishments.js';
export const prospectAddresses = pgTable(
  'prospect_addresses',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    prospectId: uuid('prospect_id').notNull(),
    label: varchar('label', { length: 100 }),
    line1: varchar('line1', { length: 255 }).notNull(),
    line2: varchar('line2', { length: 255 }),
    postalCode: varchar('postal_code', { length: 32 }),
    city: varchar('city', { length: 150 }),
    region: varchar('region', { length: 150 }),
    countryCode: varchar('country_code', { length: 2 }).notNull(),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    isPrimary: boolean('is_primary').default(false).notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique('prospect_addresses_tenant_id_unique').on(t.tenantId, t.id),
    foreignKey({
      columns: [t.tenantId, t.prospectId],
      foreignColumns: [establishments.tenantId, establishments.id],
    }).onDelete('restrict'),
    index('prospect_addresses_parent_idx').on(t.tenantId, t.prospectId, t.id),
    uniqueIndex('prospect_addresses_primary_unique')
      .on(t.tenantId, t.prospectId)
      .where(sql`${t.isPrimary} AND ${t.deletedAt} IS NULL`),
    check(
      'prospect_addresses_coordinates_check',
      sql`(${t.latitude} IS NULL AND ${t.longitude} IS NULL) OR (${t.latitude} IS NOT NULL AND ${t.longitude} IS NOT NULL AND ${t.latitude} BETWEEN -90 AND 90 AND ${t.longitude} BETWEEN -180 AND 180)`,
    ),
    check('prospect_addresses_country_check', sql`${t.countryCode} ~ '^[A-Z]{2}$'`),
  ],
);
