import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { campaignProspectAssignments } from './campaign-prospect-assignments.js';
import { campaignProspects } from './campaign-prospects.js';
import { campaigns } from './campaigns.js';
import { teams } from './teams.js';
import { tenants } from './tenants.js';
import { userRoleEnum } from './user-access-grants.js';
import { tenantMemberships } from './tenant-memberships.js';

/*
 * Only collisions that may legitimately be
 * overridden belong here.
 *
 * ACTIVE_RESERVATION is intentionally absent.
 * A live reservation remains an authoritative
 * anti-collision boundary and can never be
 * bypassed by a manager override.
 */
export const collisionOverrideReasonEnum = pgEnum('collision_override_reason', [
  'PLANNED_ACTION',
  'RECENT_CONTACT',
  'ACTIVE_ASSIGNMENT',
]);

export const collisionOverrides = pgTable(
  'collision_overrides',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),

    /*
     * Exact prospect context for which the
     * override was approved.
     */
    campaignId: uuid('campaign_id').notNull(),

    campaignProspectId: uuid('campaign_prospect_id').notNull(),

    establishmentId: uuid('establishment_id').notNull(),

    /*
     * Current assignment at approval time.
     *
     * Reservation consumption will reject the
     * override if the assignment has changed.
     */
    assignmentId: uuid('assignment_id').notNull(),

    organizationId: uuid('organization_id').notNull(),

    teamId: uuid('team_id').notNull(),

    /*
     * Override is issued to one specific
     * prospector. It cannot be shared with
     * another user.
     */
    prospectorUserId: uuid('prospector_user_id').notNull(),

    /*
     * Authenticated manager/director/admin who
     * approved the exception.
     */
    approvedByUserId: uuid('approved_by_user_id').notNull(),

    /*
     * Snapshot of the authority used at approval
     * time. Only these roles may authorize.
     */
    approvedByRole: userRoleEnum('approved_by_role').notNull(),

    reasonCode: collisionOverrideReasonEnum('reason_code').notNull(),

    /*
     * Deterministic identity of the exact collision
     * approved by the manager.
     *
     * Examples:
     *
     * planned_action:<followUpId>:<dueAt>
     *
     * recent_contact:<activityId>:<expiresAt>
     *
     * active_assignment:<assignmentId>:<assignedAt>
     *
     * Reservation consumption re-computes this key.
     * A changed collision therefore invalidates the
     * approval automatically.
     */
    conflictKey: varchar('conflict_key', {
      length: 512,
    }).notNull(),

    /*
     * Full server-generated collision snapshot.
     *
     * This preserves what the manager actually
     * approved even if the conflicting domain
     * record later changes.
     */
    conflictSnapshot: jsonb('conflict_snapshot').$type<Record<string, unknown>>().notNull(),

    /*
     * Human justification supplied by the
     * approving manager.
     */
    reason: text('reason').notNull(),

    /*
     * Overrides are intentionally short-lived.
     * The service will provide the expiry rather
     * than accepting it from the client.
     */
    expiresAt: timestamp('expires_at', {
      withTimezone: true,
      mode: 'date',
    }).notNull(),

    /*
     * Append-only approval timestamp.
     *
     * No updated_at column: the approval itself
     * should never be rewritten.
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
     * Tenant-safe reference for future audit and
     * workflow relationships.
     */
    unique('collision_overrides_tenant_id_id_unique').on(table.tenantId, table.id),

    /*
     * Proves campaign + prospect + establishment
     * represent the same canonical campaign
     * membership.
     */
    foreignKey({
      name: 'collision_overrides_tenant_campaign_prospect_establishment_fk',

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
     * Organization must be the organization
     * owning the target campaign.
     */
    foreignKey({
      name: 'collision_overrides_tenant_campaign_organization_fk',

      columns: [table.tenantId, table.campaignId, table.organizationId],

      foreignColumns: [campaigns.tenantId, campaigns.id, campaigns.organizationId],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),

    /*
     * Team must belong to the same tenant and
     * organization.
     */
    foreignKey({
      name: 'collision_overrides_tenant_organization_team_fk',

      columns: [table.tenantId, table.organizationId, table.teamId],

      foreignColumns: [teams.tenantId, teams.organizationId, teams.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),

    /*
     * Assignment referenced by the override must
     * belong to the same tenant and exact campaign
     * prospect.
     */
    foreignKey({
      name: 'collision_overrides_tenant_prospect_assignment_fk',

      columns: [table.tenantId, table.campaignProspectId, table.assignmentId],

      foreignColumns: [
        campaignProspectAssignments.tenantId,
        campaignProspectAssignments.campaignProspectId,
        campaignProspectAssignments.id,
      ],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),

    /*
     * Prospector receiving the override must
     * belong to the same tenant.
     */
    foreignKey({
      name: 'collision_overrides_tenant_prospector_fk',

      columns: [table.tenantId, table.prospectorUserId],

      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),

    /*
     * Approver must also belong to the tenant.
     */
    foreignKey({
      name: 'collision_overrides_tenant_approver_fk',

      columns: [table.tenantId, table.approvedByUserId],

      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),

    /*
     * Defense in depth: observers and prospectors
     * can never appear as an override authority,
     * even if application code is incorrect.
     */
    check(
      'collision_overrides_approver_role_check',
      sql`
        ${table.approvedByRole}
        IN (
          'client_admin',
          'director',
          'manager'
        )
      `,
    ),

    /*
     * Require a meaningful manager explanation.
     *
     * DTO validation will enforce the same rule.
     */
    check(
      'collision_overrides_reason_length_check',
      sql`
        char_length(
          btrim(${table.reason})
        )
        BETWEEN 10 AND 1000
      `,
    ),

    check(
      'collision_overrides_conflict_key_check',
      sql`
        char_length(
          btrim(${table.conflictKey})
        ) > 0
      `,
    ),

    /*
     * Service controls both timestamps, but keep
     * the invariant at the DB layer as well.
     */
    check(
      'collision_overrides_expiry_check',
      sql`
        ${table.expiresAt}
        > ${table.createdAt}
      `,
    ),

    /*
     * Primary lookup when a prospector supplies
     * overrideId during reservation acquisition.
     */
    index('collision_overrides_tenant_prospect_idx').on(
      table.tenantId,
      table.campaignProspectId,
      table.prospectorUserId,
    ),

    /*
     * Supports assignment-scoped joins and the
     * composite assignment-context foreign key.
     */
    index('collision_overrides_tenant_assignment_prospect_idx').on(
      table.tenantId,
      table.assignmentId,
      table.campaignProspectId,
    ),

    /*
     * Useful for manager/audit history.
     */
    index('collision_overrides_tenant_approver_created_idx').on(
      table.tenantId,
      table.approvedByUserId,
      table.createdAt,
    ),

    /*
     * Team-scoped manager history.
     */
    index('collision_overrides_tenant_team_created_idx').on(
      table.tenantId,
      table.teamId,
      table.createdAt,
    ),

    /*
     * Helps validate the currently applicable
     * collision approval.
     */
    index('collision_overrides_validation_idx').on(
      table.tenantId,
      table.campaignProspectId,
      table.prospectorUserId,
      table.reasonCode,
      table.conflictKey,
      table.expiresAt,
    ),
  ],
);

export type CollisionOverride = typeof collisionOverrides.$inferSelect;

export type NewCollisionOverride = typeof collisionOverrides.$inferInsert;

export type CollisionOverrideReason = (typeof collisionOverrideReasonEnum.enumValues)[number];
