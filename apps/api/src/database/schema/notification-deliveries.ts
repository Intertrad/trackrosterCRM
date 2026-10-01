import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { notifications } from './notifications.js';
import { tenants } from './tenants.js';

export const notificationDeliveryChannelEnum = pgEnum('notification_delivery_channel', [
  'email',
  'push',
]);

export const notificationDeliveryStatusEnum = pgEnum('notification_delivery_status', [
  'queued',
  'sending',
  'sent',
  'failed',
]);

/**
 * Durable outbox state for channels that leave the in-app inbox.
 * A notification is always persisted before a delivery row is created.
 */
export const notificationDeliveries = pgTable(
  'notification_deliveries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    notificationId: uuid('notification_id').notNull(),
    channel: notificationDeliveryChannelEnum('channel').notNull(),
    status: notificationDeliveryStatusEnum('status').notNull().default('queued'),
    attempts: integer('attempts').notNull().default(0),
    providerMessageId: varchar('provider_message_id', { length: 255 }),
    lastError: text('last_error'),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('notification_deliveries_tenant_id_unique').on(table.tenantId, table.id),
    unique('notification_deliveries_notification_channel_unique').on(
      table.tenantId,
      table.notificationId,
      table.channel,
    ),
    foreignKey({
      name: 'notification_deliveries_notification_fk',
      columns: [table.tenantId, table.notificationId],
      foreignColumns: [notifications.tenantId, notifications.id],
    })
      .onDelete('cascade')
      .onUpdate('cascade'),
    check('notification_deliveries_attempts_check', sql`${table.attempts} >= 0`),
    index('notification_deliveries_queue_idx').on(
      table.status,
      table.nextAttemptAt,
      table.createdAt,
    ),
    index('notification_deliveries_tenant_idx').on(table.tenantId, table.createdAt),
  ],
);

export type NotificationDelivery = typeof notificationDeliveries.$inferSelect;
export type NewNotificationDelivery = typeof notificationDeliveries.$inferInsert;
