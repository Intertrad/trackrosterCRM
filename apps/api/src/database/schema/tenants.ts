import { jsonb, pgEnum, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const tenantStatusEnum = pgEnum('tenant_status', ['active', 'suspended', 'inactive']);

export const tenants = pgTable('tenants', {
  id: uuid('id').defaultRandom().primaryKey(),

  name: varchar('name', {
    length: 255,
  }).notNull(),

  slug: varchar('slug', {
    length: 100,
  })
    .notNull()
    .unique(),

  status: tenantStatusEnum('status').default('active').notNull(),

  platformConfig: jsonb('platform_config').$type<Record<string, unknown>>().default({}).notNull(),

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
});
export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
