import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { territories } from './resource-scopes.js';
import { campaigns } from './campaigns.js';
import { teams } from './teams.js';
import { tenantMemberships } from './tenant-memberships.js';

const columns = () => ({
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  membershipId: uuid('membership_id'),
  teamId: uuid('team_id'),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull().defaultNow(),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
export const territoryAssignments = pgTable(
  'territory_assignments',
  {
    ...columns(),
    territoryId: uuid('territory_id').notNull(),
    priority: integer('priority').notNull().default(100),
  },
  (t) => [
    foreignKey({
      columns: [t.tenantId, t.territoryId],
      foreignColumns: [territories.tenantId, territories.id],
      name: 'territory_assignments_resource_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [t.tenantId, t.membershipId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
      name: 'territory_assignments_member_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [t.tenantId, t.teamId],
      foreignColumns: [teams.tenantId, teams.id],
      name: 'territory_assignments_team_fk',
    }).onDelete('restrict'),
    check(
      'territory_assignments_subject_check',
      sql`(${t.membershipId} IS NOT NULL)::int + (${t.teamId} IS NOT NULL)::int = 1`,
    ),
    check(
      'territory_assignments_dates_check',
      sql`${t.endsAt} IS NULL OR ${t.endsAt} > ${t.startsAt}`,
    ),
    check('territory_assignments_priority_check', sql`${t.priority} BETWEEN 0 AND 100000`),
    index('territory_assignments_resource_idx').on(t.tenantId, t.territoryId),
    index('territory_assignments_member_idx').on(t.tenantId, t.membershipId),
    index('territory_assignments_team_idx').on(t.tenantId, t.teamId),
  ],
);
export const campaignMembers = pgTable(
  'campaign_members',
  {
    ...columns(),
    campaignId: uuid('campaign_id').notNull(),
    campaignRole: varchar('campaign_role', { length: 24 })
      .$type<'member' | 'coordinator' | 'observer'>()
      .notNull()
      .default('member'),
  },
  (t) => [
    foreignKey({
      columns: [t.tenantId, t.campaignId],
      foreignColumns: [campaigns.tenantId, campaigns.id],
      name: 'campaign_members_resource_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [t.tenantId, t.membershipId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
      name: 'campaign_members_member_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [t.tenantId, t.teamId],
      foreignColumns: [teams.tenantId, teams.id],
      name: 'campaign_members_team_fk',
    }).onDelete('restrict'),
    check(
      'campaign_members_subject_check',
      sql`(${t.membershipId} IS NOT NULL)::int + (${t.teamId} IS NOT NULL)::int = 1`,
    ),
    check('campaign_members_dates_check', sql`${t.endsAt} IS NULL OR ${t.endsAt} > ${t.startsAt}`),
    check(
      'campaign_members_role_check',
      sql`${t.campaignRole} IN ('member','coordinator','observer')`,
    ),
    index('campaign_members_resource_idx').on(t.tenantId, t.campaignId),
    index('campaign_members_member_idx').on(t.tenantId, t.membershipId),
    index('campaign_members_team_idx').on(t.tenantId, t.teamId),
  ],
);
