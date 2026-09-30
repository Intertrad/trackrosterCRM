import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { tenants } from './tenants.js';

export const organizationStatusEnum = pgEnum('organization_status', ['active', 'inactive']);

export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),

    name: varchar('name', {
      length: 255,
    }).notNull(),

    slug: varchar('slug', {
      length: 100,
    }).notNull(),

    /** Public-facing short code shown beside the full organization name. */
    shortName: varchar('short_name', { length: 100 }),

    phone: varchar('phone', { length: 80 }),
    email: varchar('email', { length: 320 }),
    website: varchar('website', { length: 500 }),
    address: text('address'),
    color: varchar('color', { length: 7 }).default('#05124A'),
    currency: varchar('currency', { length: 3 }).default('EUR'),
    argumentaire: text('argumentaire'),
    prospectedSectors: text('prospected_sectors')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),

    status: organizationStatusEnum('status').default('active').notNull(),

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
    unique('organizations_tenant_id_slug_unique').on(table.tenantId, table.slug),

    unique('organizations_tenant_id_id_unique').on(table.tenantId, table.id),
    index('organizations_tenant_id_idx').on(table.tenantId),
  ],
);

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
