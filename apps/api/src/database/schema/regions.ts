import { sql } from 'drizzle-orm';
import {
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

import { tenants } from './tenants.js';

export const regionTypeEnum = pgEnum('region_type', [
  'country',
  'administrative',
  'city',
  'sales_territory',
]);

export const regionStatusEnum = pgEnum('region_status', ['active', 'inactive', 'archived']);

export const regions = pgTable(
  'regions',
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

    /*
     * Optional tenant-controlled business identifier.
     *
     * Examples:
     *   FR
     *   IDF
     *   PARIS
     *   PARIS_NORTH
     *
     * Service-layer normalization will keep this
     * stable when supplied.
     */
    code: varchar('code', {
      length: 100,
    }),

    type: regionTypeEnum('type').notNull(),

    /*
     * Nullable self-reference used to form the
     * region hierarchy.
     *
     * Examples:
     *
     * France
     *   └── Île-de-France
     *       └── Paris
     *           └── Paris North
     *
     * The composite FK below guarantees that
     * parent and child belong to the same tenant.
     */
    parentRegionId: uuid('parent_region_id'),

    status: regionStatusEnum('status').default('active').notNull(),

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
     * Required for tenant-safe composite
     * relationships to regions.
     */
    unique('regions_tenant_id_id_unique').on(table.tenantId, table.id),

    /*
     * A parent region must belong to the same
     * tenant as its child.
     *
     * parentRegionId is nullable, so root regions
     * are allowed.
     */
    foreignKey({
      name: 'regions_tenant_parent_region_fk',

      columns: [table.tenantId, table.parentRegionId],

      foreignColumns: [table.tenantId, table.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),

    /*
     * Region codes are optional, but when supplied
     * they identify a region uniquely inside one
     * tenant.
     *
     * Service code will normalize codes before
     * persistence.
     */
    uniqueIndex('regions_tenant_code_unique')
      .on(table.tenantId, table.code)
      .where(sql`${table.code} IS NOT NULL`),

    index('regions_tenant_id_idx').on(table.tenantId),

    index('regions_tenant_parent_idx').on(table.tenantId, table.parentRegionId),

    index('regions_tenant_type_idx').on(table.tenantId, table.type),

    index('regions_tenant_status_idx').on(table.tenantId, table.status),

    /*
     * Reject whitespace-only region names even if
     * an application path bypasses RegionService.
     */
    check(
      'regions_name_not_blank_check',
      sql`
        length(
          btrim(${table.name})
        ) > 0
      `,
    ),

    /*
     * Nullable is valid, but a supplied code cannot
     * contain only whitespace.
     */
    check(
      'regions_code_not_blank_check',
      sql`
        ${table.code} IS NULL
        OR length(
          btrim(${table.code})
        ) > 0
      `,
    ),

    /*
     * Immediate self-parenting is always invalid.
     *
     * Longer cycles such as A -> B -> A require
     * service-level hierarchy validation because
     * they cannot be expressed with a simple row
     * CHECK constraint.
     */
    check(
      'regions_parent_not_self_check',
      sql`
        ${table.parentRegionId} IS NULL
        OR ${table.parentRegionId} <> ${table.id}
      `,
    ),
  ],
);

export type Region = typeof regions.$inferSelect;

export type NewRegion = typeof regions.$inferInsert;

export type RegionType = (typeof regionTypeEnum.enumValues)[number];

export type RegionStatus = (typeof regionStatusEnum.enumValues)[number];
