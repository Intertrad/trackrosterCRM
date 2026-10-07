import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { tenantMemberships } from './tenant-memberships.js';

export const conversationKindEnum = pgEnum('conversation_kind', [
  'direct',
  'team',
  'prospect',
  'campaign',
]);
export const conversationStatusEnum = pgEnum('conversation_status', ['active', 'archived']);
export const messageStatusEnum = pgEnum('message_status', ['sent', 'edited', 'deleted']);

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    kind: conversationKindEnum('kind').notNull(),
    title: varchar('title', { length: 200 }),
    status: conversationStatusEnum('status').default('active').notNull(),
    createdBy: uuid('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (t) => [
    foreignKey({
      columns: [t.tenantId, t.createdBy],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
    }),
    index('conversations_tenant_updated_idx').on(t.tenantId, t.updatedAt),
  ],
);

export const conversationParticipants = pgTable(
  'conversation_participants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    conversationId: uuid('conversation_id').notNull(),
    membershipId: uuid('membership_id').notNull(),
    lastReadAt: timestamp('last_read_at', { withTimezone: true, mode: 'date' }),
    mutedUntil: timestamp('muted_until', { withTimezone: true, mode: 'date' }),
    joinedAt: timestamp('joined_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (t) => [
    unique('conversation_participants_unique').on(t.tenantId, t.conversationId, t.membershipId),
    foreignKey({
      columns: [t.tenantId, t.membershipId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
    }),
    index('conversation_participants_member_idx').on(t.tenantId, t.membershipId),
  ],
);

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    conversationId: uuid('conversation_id').notNull(),
    senderId: uuid('sender_id').notNull(),
    body: text('body').notNull(),
    status: messageStatusEnum('status').default('sent').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (t) => [
    check('messages_body_check', sql`length(trim(${t.body})) > 0 AND length(${t.body}) <= 10000`),
    foreignKey({
      columns: [t.tenantId, t.senderId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
    }),
    index('messages_conversation_created_idx').on(t.tenantId, t.conversationId, t.createdAt),
  ],
);

export const messageReactions = pgTable(
  'message_reactions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    messageId: uuid('message_id').notNull(),
    membershipId: uuid('membership_id').notNull(),
    emoji: varchar('emoji', { length: 32 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).defaultNow().notNull(),
  },
  (t) => [
    unique('message_reactions_member_emoji_unique').on(
      t.tenantId,
      t.messageId,
      t.membershipId,
      t.emoji,
    ),
    foreignKey({
      columns: [t.tenantId, t.membershipId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
    }),
    index('message_reactions_message_idx').on(t.tenantId, t.messageId),
  ],
);
