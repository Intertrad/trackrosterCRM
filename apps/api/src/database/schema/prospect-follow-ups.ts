import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  pgEnum,
  pgTable,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import { campaignProspectAssignments } from './campaign-prospect-assignments.js';
import { campaignProspects } from './campaign-prospects.js';
import { tenants } from './tenants.js';
import { users } from './users.js';

export const prospectFollowUpStatusEnum = pgEnum('prospect_follow_up_status', [
  'pending',
  'completed',
  'cancelled',
]);

export const prospectFollowUps = pgTable(
  'prospect_follow_ups',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),

    /*
     * Campaign context in which the follow-up
     * was scheduled.
     */
    campaignId: uuid('campaign_id').notNull(),

    campaignProspectId: uuid('campaign_prospect_id').notNull(),

    /*
     * Canonical establishment identity.
     *
     * Collision detection uses this to find
     * planned actions across campaign contexts.
     */
    establishmentId: uuid('establishment_id').notNull(),

    /*
     * Assignment under which this follow-up
     * was created.
     *
     * Assignment history preserves the owning
     * organization and team even if the prospect
     * is reassigned later.
     */
    assignmentId: uuid('assignment_id').notNull(),

    /*
     * The specific prospector expected to carry
     * out the follow-up.
     *
     * Nullable so TR-019 can also support
     * team-owned follow-ups.
     */
    assignedUserId: uuid('assigned_user_id'),

    /*
     * Authenticated user who created
     * the follow-up.
     */
    createdBy: uuid('created_by').notNull(),

    /*
     * Business deadline for the planned action.
     *
     * Past pending values are valid because they
     * represent overdue follow-ups.
     */
    dueAt: timestamp('due_at', {
      withTimezone: true,
      mode: 'date',
    }).notNull(),

    status: prospectFollowUpStatusEnum('status').default('pending').notNull(),

    completedAt: timestamp('completed_at', {
      withTimezone: true,
      mode: 'date',
    }),

    cancelledAt: timestamp('cancelled_at', {
      withTimezone: true,
      mode: 'date',
    }),

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
    /*
     * Supports future tenant-safe references.
     */
    unique('prospect_follow_ups_tenant_id_id_unique').on(table.tenantId, table.id),

    /*
     * Strong canonical identity invariant:
     *
     * campaign + campaign prospect +
     * establishment must represent the same
     * campaign membership.
     */
    foreignKey({
      name: 'prospect_follow_ups_tenant_campaign_prospect_establishment_fk',

      columns: [table.tenantId, table.campaignId, table.campaignProspectId, table.establishmentId],

      foreignColumns: [
        campaignProspects.tenantId,
        campaignProspects.campaignId,
        campaignProspects.id,
        campaignProspects.establishmentId,
      ],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),

    /*
     * Assignment must belong to the same tenant.
     *
     * Creation logic in TR-019 will additionally
     * verify that it is the current assignment for
     * this exact campaign prospect.
     */
    foreignKey({
      name: 'prospect_follow_ups_tenant_assignment_fk',

      columns: [table.tenantId, table.assignmentId],

      foreignColumns: [campaignProspectAssignments.tenantId, campaignProspectAssignments.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),

    /*
     * Assigned prospector, when present, must
     * belong to the same tenant.
     */
    foreignKey({
      name: 'prospect_follow_ups_tenant_assigned_user_fk',

      columns: [table.tenantId, table.assignedUserId],

      foreignColumns: [users.tenantId, users.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),

    /*
     * Creator must belong to the same tenant.
     */
    foreignKey({
      name: 'prospect_follow_ups_tenant_created_by_fk',

      columns: [table.tenantId, table.createdBy],

      foreignColumns: [users.tenantId, users.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),

    /*
     * Status and terminal timestamps must agree.
     */
    check(
      'prospect_follow_ups_status_timestamp_check',
      sql`
        (
          ${table.status} = 'pending'
          AND ${table.completedAt} IS NULL
          AND ${table.cancelledAt} IS NULL
        )
        OR
        (
          ${table.status} = 'completed'
          AND ${table.completedAt} IS NOT NULL
          AND ${table.cancelledAt} IS NULL
        )
        OR
        (
          ${table.status} = 'cancelled'
          AND ${table.cancelledAt} IS NOT NULL
          AND ${table.completedAt} IS NULL
        )
      `,
    ),

    /*
     * Main PLANNED_ACTION collision lookup.
     */
    index('prospect_follow_ups_tenant_establishment_status_due_idx').on(
      table.tenantId,
      table.establishmentId,
      table.status,
      table.dueAt,
    ),

    /*
     * Prospect timeline / TR-019 follow-up lookup.
     */
    index('prospect_follow_ups_tenant_prospect_status_due_idx').on(
      table.tenantId,
      table.campaignProspectId,
      table.status,
      table.dueAt,
    ),

    /*
     * Personal due/overdue queue.
     */
    index('prospect_follow_ups_tenant_user_status_due_idx').on(
      table.tenantId,
      table.assignedUserId,
      table.status,
      table.dueAt,
    ),
  ],
);

export type ProspectFollowUp = typeof prospectFollowUps.$inferSelect;

export type NewProspectFollowUp = typeof prospectFollowUps.$inferInsert;

export type ProspectFollowUpStatus = (typeof prospectFollowUpStatusEnum.enumValues)[number];
