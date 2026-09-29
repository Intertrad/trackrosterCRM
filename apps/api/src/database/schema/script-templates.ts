import {
  boolean,
  foreignKey,
  index,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { organizations } from './organizations.js';
import { tenantMemberships } from './tenant-memberships.js';

export const scriptTemplates = pgTable(
  'script_templates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id'),
    createdBy: uuid('created_by').notNull(),
    updatedBy: uuid('updated_by').notNull(),
    name: varchar('name', { length: 160 }).notNull(),
    channel: varchar('channel', { length: 16 }).notNull(),
    sector: varchar('sector', { length: 80 }),
    subject: varchar('subject', { length: 255 }),
    body: varchar('body', { length: 20000 }).notNull(),
    variables: jsonb('variables').$type<string[]>().notNull().default([]),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('script_templates_tenant_idx').on(table.tenantId, table.updatedAt),
    foreignKey({
      columns: [table.tenantId, table.organizationId],
      foreignColumns: [organizations.tenantId, organizations.id],
    }).onDelete('set null'),
    foreignKey({
      columns: [table.tenantId, table.createdBy],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
    }),
    foreignKey({
      columns: [table.tenantId, table.updatedBy],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
    }),
  ],
);

export type ScriptTemplate = typeof scriptTemplates.$inferSelect;
