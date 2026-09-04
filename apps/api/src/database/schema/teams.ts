import {
  foreignKey,
  index,
  pgEnum,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { organizations } from './organizations.js';
import { tenants } from './tenants.js';

export const teamStatusEnum = pgEnum('team_status', ['active', 'inactive']);

export const teams = pgTable(
  'teams',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),

    organizationId: uuid('organization_id').notNull(),

    name: varchar('name', {
      length: 255,
    }).notNull(),

    slug: varchar('slug', {
      length: 100,
    }).notNull(),

    status: teamStatusEnum('status').default('active').notNull(),

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
    foreignKey({
      name: 'teams_tenant_organization_fk',
      columns: [table.tenantId, table.organizationId],
      foreignColumns: [organizations.tenantId, organizations.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),

    unique('teams_tenant_organization_slug_unique').on(
      table.tenantId,
      table.organizationId,
      table.slug,
    ),

    index('teams_tenant_id_idx').on(table.tenantId),

    index('teams_tenant_organization_id_idx').on(table.tenantId, table.organizationId),
  ],
);

export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
