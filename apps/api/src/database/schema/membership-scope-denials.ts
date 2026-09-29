import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { tenantMemberships } from './tenant-memberships.js';
export const membershipScopeDenials = pgTable(
  'membership_scope_denials',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    userId: uuid('user_id').notNull(),
    scopeType: varchar('scope_type', { length: 20 })
      .$type<'tenant' | 'organization' | 'team' | 'campaign' | 'territory'>()
      .notNull(),
    resourceId: uuid('resource_id').notNull(),
    reason: varchar('reason', { length: 1000 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    foreignKey({
      columns: [t.tenantId, t.userId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
    }).onDelete('cascade'),
    uniqueIndex('membership_scope_denials_unique').on(
      t.tenantId,
      t.userId,
      t.scopeType,
      t.resourceId,
    ),
    index('membership_scope_denials_member_idx').on(t.tenantId, t.userId),
    check(
      'membership_scope_denials_type_check',
      sql`${t.scopeType} IN ('tenant','organization','team','campaign','territory')`,
    ),
    check('membership_scope_denials_reason_check', sql`char_length(btrim(${t.reason}))>=3`),
  ],
);
