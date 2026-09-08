import { foreignKey, index, pgEnum, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

import { campaignProspectAssignments } from './campaign-prospect-assignments.js';
import { campaignProspects } from './campaign-prospects.js';
import { tenants } from './tenants.js';
import { users } from './users.js';

export const prospectActivityTypeEnum = pgEnum('prospect_activity_type', [
  'call',
  'email',
  'message',
  'visit',
]);

export const prospectActivities = pgTable(
  'prospect_activities',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),

    /*
     * Campaign context in which the
     * prospecting action occurred.
     */
    campaignId: uuid('campaign_id').notNull(),

    campaignProspectId: uuid('campaign_prospect_id').notNull(),

    /*
     * Canonical establishment identity.
     *
     * Cooling-off rules operate across campaign
     * contexts using this ID.
     */
    establishmentId: uuid('establishment_id').notNull(),

    /*
     * Assignment that authorized the work.
     *
     * Assignment history already preserves
     * organization/team ownership.
     */
    assignmentId: uuid('assignment_id').notNull(),

    /*
     * Authenticated user who performed
     * the action.
     */
    userId: uuid('user_id').notNull(),

    /*
     * Reservation IDs live in Redis and are
     * temporary, but keeping the ID here gives
     * us permanent evidence of the reservation
     * under which this activity was recorded.
     */
    reservationId: uuid('reservation_id').notNull(),

    type: prospectActivityTypeEnum('type').notNull(),

    /*
     * Business event timestamp.
     *
     * For TR-017 this will always be generated
     * by the backend rather than accepted from
     * the prospector.
     */
    occurredAt: timestamp('occurred_at', {
      withTimezone: true,
      mode: 'date',
    })
      .defaultNow()
      .notNull(),

    /*
     * Append-only history row creation time.
     *
     * Intentionally no updated_at column.
     */
    createdAt: timestamp('created_at', {
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
    unique('prospect_activities_tenant_id_id_unique').on(table.tenantId, table.id),

    /*
     * Strong canonical identity invariant.
     *
     * This proves that tenant + campaign +
     * campaign prospect + establishment all
     * represent the same campaign membership.
     */
    foreignKey({
      name: 'prospect_activities_tenant_campaign_prospect_establishment_fk',

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
     * The service will also verify that this is
     * the current assignment for the exact
     * campaign prospect before recording an
     * activity.
     */
    foreignKey({
      name: 'prospect_activities_tenant_assignment_fk',

      columns: [table.tenantId, table.assignmentId],

      foreignColumns: [campaignProspectAssignments.tenantId, campaignProspectAssignments.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),

    /*
     * Actor must belong to the same tenant.
     */
    foreignKey({
      name: 'prospect_activities_tenant_user_fk',

      columns: [table.tenantId, table.userId],

      foreignColumns: [users.tenantId, users.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),

    /*
     * Main TR-017 cooling-off lookup:
     *
     * latest activity for a canonical
     * establishment.
     */
    index('prospect_activities_tenant_establishment_occurred_idx').on(
      table.tenantId,
      table.establishmentId,
      table.occurredAt,
    ),

    /*
     * Campaign prospect activity timeline.
     */
    index('prospect_activities_tenant_prospect_occurred_idx').on(
      table.tenantId,
      table.campaignProspectId,
      table.occurredAt,
    ),

    /*
     * User activity history.
     */
    index('prospect_activities_tenant_user_occurred_idx').on(
      table.tenantId,
      table.userId,
      table.occurredAt,
    ),
  ],
);

export type ProspectActivity = typeof prospectActivities.$inferSelect;

export type NewProspectActivity = typeof prospectActivities.$inferInsert;

export type ProspectActivityType = (typeof prospectActivityTypeEnum.enumValues)[number];
