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
} from 'drizzle-orm/pg-core';

import { campaignProspects } from './campaign-prospects.js';
import { campaigns } from './campaigns.js';
import { teams } from './teams.js';
import { tenants } from './tenants.js';
import { users } from './users.js';

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
    endedAt: timestamp('ended_at', {
      withTimezone: true,
      mode: 'date',
    }),
  },

  (table) => [
    /*
     * Useful for future tenant-safe references.
     */
    unique('campaign_prospect_assignments_tenant_id_id_unique').on(table.tenantId, table.id),

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

      foreignColumns: [users.tenantId, users.id],
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
  ],
);

export type CampaignProspectAssignment = typeof campaignProspectAssignments.$inferSelect;

export type NewCampaignProspectAssignment = typeof campaignProspectAssignments.$inferInsert;
