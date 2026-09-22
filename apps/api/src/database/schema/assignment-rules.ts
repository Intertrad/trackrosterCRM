import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { campaigns } from './campaigns.js';
export type AssignmentRuleTarget = { teamId: string; assignedUserId: string | null };
export const assignmentRules = pgTable(
  'assignment_rules',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    campaignId: uuid('campaign_id').notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    strategy: varchar('strategy', { length: 20 }).$type<'capacity' | 'round_robin'>().notNull(),
    // Target references are validated on save AND use; inactive/moved targets never receive assignments.
    targets: jsonb('targets').$type<AssignmentRuleTarget[]>().notNull(),
    priority: integer('priority').notNull().default(100),
    isActive: boolean('is_active').notNull().default(true),
    nextTarget: integer('next_target').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    foreignKey({
      name: 'assignment_rules_campaign_fk',
      columns: [t.tenantId, t.campaignId],
      foreignColumns: [campaigns.tenantId, campaigns.id],
    }).onDelete('cascade'),
    check('assignment_rules_strategy_check', sql`${t.strategy} IN ('capacity', 'round_robin')`),
    check(
      'assignment_rules_bounds_check',
      sql`${t.priority} BETWEEN 0 AND 10000 AND ${t.nextTarget} BETWEEN 0 AND 49 AND length(trim(${t.name})) > 0`,
    ),
    check(
      'assignment_rules_targets_check',
      sql`jsonb_typeof(${t.targets}) = 'array' AND jsonb_array_length(${t.targets}) BETWEEN 1 AND 50`,
    ),
    index('assignment_rules_campaign_order_idx').on(t.tenantId, t.campaignId, t.priority, t.id),
  ],
);
