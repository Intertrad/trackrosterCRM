import {
  foreignKey,
  integer,
  jsonb,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { tenantMemberships } from './tenant-memberships.js';

export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    tenantId: uuid('tenant_id').notNull(),
    membershipId: uuid('membership_id').notNull(),
    preferences: jsonb('preferences')
      .$type<Record<string, { email?: boolean; push?: boolean; inApp?: boolean }>>()
      .default({})
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique('notification_preferences_pk').on(t.tenantId, t.membershipId),
    foreignKey({
      columns: [t.tenantId, t.membershipId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
    }),
  ],
);
export const pushDevices = pgTable(
  'push_devices',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    membershipId: uuid('membership_id').notNull(),
    token: varchar('token', { length: 500 }).notNull(),
    platform: varchar('platform', { length: 20 }).notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [
    unique('push_devices_member_token_unique').on(t.tenantId, t.membershipId, t.token),
    foreignKey({
      columns: [t.tenantId, t.membershipId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
    }),
  ],
);
export const messageAttachments = pgTable(
  'message_attachments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    messageId: uuid('message_id').notNull(),
    uploadedBy: uuid('uploaded_by').notNull(),
    objectKey: varchar('object_key', { length: 500 }).notNull(),
    filename: varchar('filename', { length: 255 }).notNull(),
    contentType: varchar('content_type', { length: 120 }).notNull(),
    byteSize: integer('byte_size').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    foreignKey({
      columns: [t.tenantId, t.uploadedBy],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
    }),
    unique('message_attachments_object_unique').on(t.tenantId, t.objectKey),
  ],
);
