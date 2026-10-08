import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  pgTable,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
  text,
} from 'drizzle-orm/pg-core';

import { campaignProspects } from './campaign-prospects.js';
import { campaigns } from './campaigns.js';
import { teams } from './teams.js';
import { tenants } from './tenants.js';
import { tenantMemberships } from './tenant-memberships.js';

export const campaignProspectAssignments = pgTable(
  'campaign_prospect_assignments',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),

    /*
     * Stored explicitly so PostgreSQL can enforce
     * that campaign, prospect, organization and team
     * all belong together.
     */
    campaignId: uuid('campaign_id').notNull(),

    campaignProspectId: uuid('campaign_prospect_id').notNull(),

    organizationId: uuid('organization_id').notNull(),

    /*
     * Every assignment has a team owner.
     */
    teamId: uuid('team_id').notNull(),

    /*
     * Optional because a prospect may initially
     * belong to a team without a specific prospector.
     */
    assignedUserId: uuid('assigned_user_id'),

    /*
     * The manager accountable for the assignment.  Keeping this separate
     * from assigned_user_id lets an admin dispatch to a manager's queue
     * before the manager chooses an individual prospector.
     */
    managerId: uuid('manager_id'),

    /* Optional due date for the current assignment. */
    deadlineAt: timestamp('deadline_at', {
      withTimezone: true,
      mode: 'date',
    }),

    assignedAt: timestamp('assigned_at', {
      withTimezone: true,
      mode: 'date',
    })
      .defaultNow()
      .notNull(),

    /*
     * NULL means this is the current assignment.
     *
     * A timestamp means the assignment belongs
     * to assignment history.
     */
    status: varchar('status', { length: 16 })
      .$type<'active' | 'paused' | 'completed' | 'revoked'>()
      .notNull()
      .default('active'),
    priority: varchar('priority', { length: 16 })
      .$type<'low' | 'normal' | 'high' | 'critical'>()
      .notNull()
      .default('normal'),
    endReason: text('end_reason'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),

    endedAt: timestamp('ended_at', {
      withTimezone: true,
      mode: 'date',
    }),
  },

  (table) => [
    check(
      'assignment_status_check',
      sql`${table.status} IN ('active','paused','completed','revoked')`,
    ),
    check(
      'assignment_priority_check',
      sql`${table.priority} IN ('low','normal','high','critical')`,
    ),
    check(
      'assignment_ended_status_check',
      sql`(${table.endedAt} IS NULL AND ${table.status} IN ('active','paused')) OR (${table.endedAt} IS NOT NULL AND ${table.status} IN ('completed','revoked'))`,
    ),
    /*
     * Useful for future tenant-safe references.
     */
    unique('campaign_prospect_assignments_tenant_id_id_unique').on(table.tenantId, table.id),

    /*
     * Allows child history rows to prove that an
     * assignment belongs to the exact campaign
     * prospect they record.
     */
    unique('campaign_prospect_assignments_tenant_prospect_id_unique').on(
      table.tenantId,
      table.campaignProspectId,
      table.id,
    ),

    /*
     * Campaign + prospect must represent the
     * same campaign membership.
     */
    foreignKey({
      name: 'campaign_prospect_assignments_tenant_campaign_prospect_fk',

      columns: [table.tenantId, table.campaignId, table.campaignProspectId],

      foreignColumns: [
        campaignProspects.tenantId,
        campaignProspects.campaignId,
        campaignProspects.id,
      ],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),

    /*
     * organization_id must be the organization
     * owning this campaign.
     */
    foreignKey({
      name: 'campaign_prospect_assignments_tenant_campaign_organization_fk',

      columns: [table.tenantId, table.campaignId, table.organizationId],

      foreignColumns: [campaigns.tenantId, campaigns.id, campaigns.organizationId],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),

    /*
     * Team must belong to the campaign's
     * tenant AND organization.
     */
    foreignKey({
      name: 'campaign_prospect_assignments_tenant_organization_team_fk',

      columns: [table.tenantId, table.organizationId, table.teamId],

      foreignColumns: [teams.tenantId, teams.organizationId, teams.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),

    /*
     * If a user is specified, the user must
     * belong to the same tenant.
     *
     * assigned_user_id is nullable, which is
     * valid for a composite PostgreSQL FK.
     */
    foreignKey({
      name: 'campaign_prospect_assignments_tenant_user_fk',

      columns: [table.tenantId, table.assignedUserId],

      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),

    foreignKey({
      name: 'campaign_prospect_assignments_tenant_manager_fk',
      columns: [table.tenantId, table.managerId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),

    /*
     * Critical ownership invariant:
     *
     * only ONE current assignment may exist
     * for a campaign prospect.
     */
    uniqueIndex('campaign_prospect_assignments_active_unique')
      .on(table.tenantId, table.campaignProspectId)
      .where(sql`${table.endedAt} IS NULL`),

    /*
     * An assignment cannot end before
     * it started.
     */
    check(
      'campaign_prospect_assignments_date_range_check',
      sql`
        ${table.endedAt} IS NULL
        OR ${table.endedAt} >= ${table.assignedAt}
      `,
    ),

    index('campaign_prospect_assignments_tenant_campaign_idx').on(table.tenantId, table.campaignId),

    index('campaign_prospect_assignments_tenant_prospect_idx').on(
      table.tenantId,
      table.campaignProspectId,
    ),

    index('campaign_prospect_assignments_tenant_team_idx').on(table.tenantId, table.teamId),

    index('campaign_prospect_assignments_tenant_user_idx').on(table.tenantId, table.assignedUserId),

    index('campaign_prospect_assignments_tenant_manager_idx').on(table.tenantId, table.managerId),
    index('campaign_prospect_assignments_tenant_deadline_idx').on(table.tenantId, table.deadlineAt),
  ],
);

export type CampaignProspectAssignment = typeof campaignProspectAssignments.$inferSelect;

export type NewCampaignProspectAssignment = typeof campaignProspectAssignments.$inferInsert;
