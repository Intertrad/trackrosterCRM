import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  pgEnum,
  pgTable,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { establishments } from './establishments.js';
import { tenants } from './tenants.js';

export const establishmentContactStatusEnum = pgEnum('establishment_contact_status', [
  'active',
  'inactive',
  'archived',
]);

export const establishmentContactSourceEnum = pgEnum('establishment_contact_source', [
  'manual',
  'import',
  'api',
]);

export const establishmentContacts = pgTable(
  'establishment_contacts',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),

    establishmentId: uuid('establishment_id').notNull(),

    name: varchar('name', {
      length: 255,
    }),

    jobTitle: varchar('job_title', {
      length: 150,
    }),

    email: varchar('email', {
      length: 320,
    }),

    phone: varchar('phone', {
      length: 50,
    }),

    isPrimary: boolean('is_primary').default(false).notNull(),

    status: establishmentContactStatusEnum('status').default('active').notNull(),

    source: establishmentContactSourceEnum('source').default('manual').notNull(),

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
     * Allows future tenant-safe foreign keys
     * to contacts.
     */
    unique('establishment_contacts_tenant_id_id_unique').on(table.tenantId, table.id),

    /*
     * A contact must belong to an establishment
     * from the SAME tenant.
     */
    foreignKey({
      columns: [table.tenantId, table.establishmentId],

      foreignColumns: [establishments.tenantId, establishments.id],

      name: 'establishment_contacts_tenant_establishment_fk',
    })
      .onUpdate('cascade')
      .onDelete('restrict'),

    /*
     * Same email cannot appear twice for the
     * same establishment.
     */
    uniqueIndex('establishment_contacts_tenant_establishment_email_unique')
      .on(table.tenantId, table.establishmentId, table.email)
      .where(sql`${table.email} IS NOT NULL`),

    /*
     * Only one primary contact per establishment.
     */
    uniqueIndex('establishment_contacts_primary_unique')
      .on(table.tenantId, table.establishmentId)
      .where(sql`${table.isPrimary} = true`),

    index('establishment_contacts_tenant_id_idx').on(table.tenantId),

    index('establishment_contacts_establishment_id_idx').on(table.tenantId, table.establishmentId),

    /*
     * Contacts may not be completely empty.
     */
    check(
      'establishment_contacts_identity_check',
      sql`
        nullif(btrim(${table.name}), '') IS NOT NULL
        OR nullif(btrim(${table.email}), '') IS NOT NULL
        OR nullif(btrim(${table.phone}), '') IS NOT NULL
      `,
    ),

    /*
     * Service will normalize emails before writing.
     * Database also protects that invariant.
     */
    check(
      'establishment_contacts_email_lowercase_check',
      sql`
        ${table.email} IS NULL
        OR ${table.email} = lower(btrim(${table.email}))
      `,
    ),
    check(
      'establishment_contacts_primary_active_check',
      sql`
    ${table.isPrimary} = false
    OR ${table.status} = 'active'
  `,
    ),
  ],
);

export type EstablishmentContact = typeof establishmentContacts.$inferSelect;

export type NewEstablishmentContact = typeof establishmentContacts.$inferInsert;

export type EstablishmentContactStatus = (typeof establishmentContactStatusEnum.enumValues)[number];

export type EstablishmentContactSource = (typeof establishmentContactSourceEnum.enumValues)[number];
