import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { tenants } from './tenants.js';
import { users } from './users.js';

/*
 * Audit actors are intentionally limited to
 * authenticated users and trusted system processes.
 *
 * action/resourceType remain strings because the
 * audit vocabulary will grow as TrackRoster grows.
 */
export const auditActorTypeEnum = pgEnum('audit_actor_type', ['user', 'system']);

export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),

    /*
     * user:
     *   actor_user_id is required.
     *
     * system:
     *   actor_user_id must be null.
     */
    actorType: auditActorTypeEnum('actor_type').notNull(),

    actorUserId: uuid('actor_user_id'),

    /*
     * Stable domain action.
     *
     * Examples:
     *
     * access_grant.created
     * assignment.reassigned
     * campaign.updated
     */
    action: varchar('action', {
      length: 128,
    }).notNull(),

    /*
     * Logical resource affected by the action.
     *
     * Examples:
     *
     * campaign
     * campaign_prospect
     * access_grant
     */
    resourceType: varchar('resource_type', {
      length: 128,
    }).notNull(),

    /*
     * Deliberately stored as text rather than UUID.
     *
     * Most current TrackRoster resources use UUIDs,
     * but the audit foundation must also support
     * future stable non-UUID identifiers.
     */
    resourceId: varchar('resource_id', {
      length: 512,
    }).notNull(),

    /*
     * Context only.
     *
     * Never store passwords, tokens, secrets,
     * authorization headers, raw CSV contents,
     * or unrestricted request bodies here.
     */
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),

    /*
     * Audit time is controlled by the server /
     * database, never by the frontend.
     */
    occurredAt: timestamp('occurred_at', {
      withTimezone: true,
      mode: 'date',
    })
      .defaultNow()
      .notNull(),
  },

  (table) => [
    /*
     * Enforce same-tenant actor identity.
     *
     * PostgreSQL allows the nullable composite FK
     * for system actors; the actor check below
     * defines when null is legitimate.
     */
    foreignKey({
      name: 'audit_events_tenant_actor_user_fk',

      columns: [table.tenantId, table.actorUserId],

      foreignColumns: [users.tenantId, users.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),

    /*
     * user   -> actor_user_id required
     * system -> actor_user_id forbidden
     */
    check(
      'audit_events_actor_check',
      sql`
        (
          ${table.actorType} = 'user'
          AND
          ${table.actorUserId} IS NOT NULL
        )
        OR
        (
          ${table.actorType} = 'system'
          AND
          ${table.actorUserId} IS NULL
        )
      `,
    ),

    check(
      'audit_events_action_not_blank_check',
      sql`
        char_length(
          btrim(${table.action})
        ) > 0
      `,
    ),

    check(
      'audit_events_resource_type_not_blank_check',
      sql`
        char_length(
          btrim(${table.resourceType})
        ) > 0
      `,
    ),

    check(
      'audit_events_resource_id_not_blank_check',
      sql`
        char_length(
          btrim(${table.resourceId})
        ) > 0
      `,
    ),

    /*
     * General tenant audit timeline.
     */
    index('audit_events_tenant_occurred_idx').on(table.tenantId, table.occurredAt),

    /*
     * "What did this actor do?"
     */
    index('audit_events_tenant_actor_occurred_idx').on(
      table.tenantId,
      table.actorUserId,
      table.occurredAt,
    ),

    /*
     * "What happened to this resource?"
     */
    index('audit_events_tenant_resource_occurred_idx').on(
      table.tenantId,
      table.resourceType,
      table.resourceId,
      table.occurredAt,
    ),

    /*
     * "Show every assignment.reassigned event."
     */
    index('audit_events_tenant_action_occurred_idx').on(
      table.tenantId,
      table.action,
      table.occurredAt,
    ),
  ],
);

export type AuditEvent = typeof auditEvents.$inferSelect;

export type NewAuditEvent = typeof auditEvents.$inferInsert;

export type AuditActorType = (typeof auditActorTypeEnum.enumValues)[number];
