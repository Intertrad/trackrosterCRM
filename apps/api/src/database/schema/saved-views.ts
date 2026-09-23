import { boolean, foreignKey, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { tenantMemberships } from './tenant-memberships.js';
export const savedViews = pgTable(
  'saved_views',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    ownerId: uuid('owner_id').notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    resource: varchar('resource', { length: 40 }).notNull(),
    filters: jsonb('filters').$type<Record<string, unknown>>().notNull(),
    sort: jsonb('sort').$type<Record<string, string>>().default({}).notNull(),
    columns: jsonb('columns').$type<string[]>().default([]).notNull(),
    shared: boolean('shared').default(false).notNull(),
    isDefault: boolean('is_default').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    foreignKey({ columns: [t.tenantId], foreignColumns: [tenants.id] }),
    foreignKey({
      columns: [t.tenantId, t.ownerId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
    }),
  ],
);
