import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { organizations } from './organizations.js';
import { teams } from './teams.js';
import { campaigns } from './campaigns.js';
import { tenantMemberships } from './tenant-memberships.js';
export const objectives = pgTable(
  'objectives',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id').notNull(),
    teamId: uuid('team_id'),
    campaignId: uuid('campaign_id'),
    ownerId: uuid('owner_id').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    metric: varchar('metric', { length: 40 })
      .$type<
        | 'completed_actions'
        | 'completed_visits'
        | 'qualified_prospects'
        | 'converted_prospects'
        | 'completed_follow_ups'
      >()
      .notNull(),
    target: integer('target').notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique('objectives_tenant_id').on(t.tenantId, t.id),
    foreignKey({
      columns: [t.tenantId, t.organizationId],
      foreignColumns: [organizations.tenantId, organizations.id],
      name: 'objectives_organization_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [t.tenantId, t.organizationId, t.teamId],
      foreignColumns: [teams.tenantId, teams.organizationId, teams.id],
      name: 'objectives_team_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [t.tenantId, t.campaignId, t.organizationId],
      foreignColumns: [campaigns.tenantId, campaigns.id, campaigns.organizationId],
      name: 'objectives_campaign_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [t.tenantId, t.ownerId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
      name: 'objectives_owner_fk',
    }).onDelete('restrict'),
    check('objectives_name', sql`length(btrim(${t.name}))>0`),
    check('objectives_target', sql`${t.target} BETWEEN 1 AND 10000000`),
    check(
      'objectives_period',
      sql`${t.endsAt}>${t.startsAt} AND ${t.endsAt}<=${t.startsAt}+interval '366 days'`,
    ),
    check(
      'objectives_metric',
      sql`${t.metric} IN ('completed_actions','completed_visits','qualified_prospects','converted_prospects','completed_follow_ups')`,
    ),
    index('objectives_scope_period').on(t.tenantId, t.organizationId, t.teamId, t.endsAt),
  ],
);
export const objectiveHistory = pgTable(
  'objective_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    objectiveId: uuid('objective_id').notNull(),
    actorId: uuid('actor_id').notNull(),
    definition: jsonb('definition').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    foreignKey({
      columns: [t.tenantId, t.objectiveId],
      foreignColumns: [objectives.tenantId, objectives.id],
      name: 'objective_history_objective_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [t.tenantId, t.actorId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
      name: 'objective_history_actor_fk',
    }).onDelete('restrict'),
    index('objective_history_order').on(t.tenantId, t.objectiveId, t.createdAt),
  ],
);
