import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { prospectFollowUps } from './prospect-follow-ups.js';
import { tenants } from './tenants.js';
import { tenantMemberships } from './tenant-memberships.js';

export const notificationTypeEnum = pgEnum('notification_type', [
  'follow_up_reminder',
  'follow_up_due',
  'reservation_expired_without_summary',
  'collision_or_recent_contact',
  'override_requested',
  'no_activity_for_x_days',
  'import_completed_with_anomalies',
]);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, {
        onDelete: 'restrict',
        onUpdate: 'cascade',
      }),

    /*
     * Notifications are individual inbox records.
     *
     * Even team-owned follow-ups fan out to one
     * notification row per eligible prospector.
     */
    recipientUserId: uuid('recipient_user_id').notNull(),

    type: notificationTypeEnum('type').default('follow_up_reminder').notNull(),
    severity: varchar('severity', { length: 16 })
      .$type<'info' | 'warning' | 'error' | 'critical'>()
      .default('info')
      .notNull(),

    /*
     * Source follow-up.
     *
     * TR-021 currently persists notifications only
     * for follow-up reminders.
     */
    followUpId: uuid('follow_up_id'),

    /*
     * Exact follow-up dueAt that generated this
     * notification.
     *
     * This makes reminder processing retry-safe and
     * distinguishes different schedules following a
     * reschedule.
     */
    scheduledFor: timestamp('scheduled_for', {
      withTimezone: true,
      mode: 'date',
    }),

    eventKey: varchar('event_key', { length: 512 }).notNull().default('legacy'),

    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),

    title: varchar('title', {
      length: 200,
    }).notNull(),

    message: varchar('message', {
      length: 1000,
    }).notNull(),

    readAt: timestamp('read_at', {
      withTimezone: true,
      mode: 'date',
    }),

    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'date',
    })
      .defaultNow()
      .notNull(),
  },

  (table) => [
    unique('notifications_tenant_id_unique').on(table.tenantId, table.id),
    check(
      'notifications_severity_check',
      sql`${table.severity} IN ('info','warning','error','critical')`,
    ),
    /*
     * Recipient must belong to the same tenant.
     */
    foreignKey({
      name: 'notifications_tenant_recipient_fk',

      columns: [table.tenantId, table.recipientUserId],

      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),

    /*
     * Source follow-up must belong to the same
     * tenant.
     */
    foreignKey({
      name: 'notifications_tenant_follow_up_fk',

      columns: [table.tenantId, table.followUpId],

      foreignColumns: [prospectFollowUps.tenantId, prospectFollowUps.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),

    /*
     * Worker-level idempotency invariant.
     *
     * Retrying the same reminder for the same user
     * and schedule must never create duplicates.
     */
    uniqueIndex('notifications_event_dedup_unique').on(
      table.tenantId,
      table.recipientUserId,
      table.type,
      table.eventKey,
    ),

    /*
     * Notification inbox.
     */
    index('notifications_tenant_recipient_created_idx').on(
      table.tenantId,
      table.recipientUserId,
      table.createdAt,
    ),

    /*
     * Unread/read filtering.
     */
    index('notifications_tenant_recipient_read_idx').on(
      table.tenantId,
      table.recipientUserId,
      table.readAt,
    ),

    /*
     * Useful for retry/debug/source lookups.
     */
    index('notifications_tenant_follow_up_idx').on(table.tenantId, table.followUpId),

    index('notifications_tenant_event_key_idx').on(table.tenantId, table.eventKey),
  ],
);

export type Notification = typeof notifications.$inferSelect;

export type NewNotification = typeof notifications.$inferInsert;

export type NotificationType = (typeof notificationTypeEnum.enumValues)[number];
