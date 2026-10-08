import { sql } from 'drizzle-orm';
import { check, foreignKey, integer, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { teams } from './teams.js';
import { tenants } from './tenants.js';
import { tenantMemberships } from './tenant-memberships.js';

export const tenantSettings = pgTable('tenant_settings', {
  tenantId: uuid('tenant_id')
    .primaryKey()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  locale: varchar('locale', { length: 35 }).default('fr').notNull(),
  timezone: varchar('timezone', { length: 100 }).default('UTC').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const teamSettings = pgTable(
  'team_settings',
  {
    teamId: uuid('team_id').primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    organizationId: uuid('organization_id').notNull(),
    managerMembershipId: uuid('manager_membership_id'),
    capacity: integer('capacity').default(100).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      name: 'team_settings_team_fk',
      columns: [table.tenantId, table.organizationId, table.teamId],
      foreignColumns: [teams.tenantId, teams.organizationId, teams.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'team_settings_manager_fk',
      columns: [table.tenantId, table.managerMembershipId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
    }).onDelete('restrict'),
    check('team_settings_capacity_check', sql`${table.capacity} between 1 and 100000`),
  ],
);
