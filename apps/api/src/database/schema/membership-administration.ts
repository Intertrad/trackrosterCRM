import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { tenantMemberships } from './tenant-memberships.js';
import { tenants } from './tenants.js';
export const membershipSettings = pgTable(
  'membership_settings',
  {
    membershipId: uuid('membership_id').primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    capacity: integer('capacity'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    foreignKey({
      columns: [t.tenantId, t.membershipId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
    }).onDelete('cascade'),
    check(
      'membership_capacity_check',
      sql`${t.capacity} IS NULL OR ${t.capacity} BETWEEN 0 AND 100000`,
    ),
  ],
);
export const tenantRolePermissions = pgTable(
  'tenant_role_permissions',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 32 }).notNull(),
    permissions: jsonb('permissions').$type<string[]>().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.tenantId, t.role] }),
    check(
      'tenant_role_permissions_role_check',
      sql`${t.role} IN ('director', 'manager', 'prospector', 'auditor')`,
    ),
    check('tenant_role_permissions_array_check', sql`jsonb_typeof(${t.permissions}) = 'array'`),
  ],
);
