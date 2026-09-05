import { index, pgTable, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';

import { users } from './users.js';

export const authSessions = pgTable(
  'auth_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),

    refreshTokenHash: varchar('refresh_token_hash', {
      length: 64,
    }).notNull(),

    expiresAt: timestamp('expires_at', {
      withTimezone: true,
      mode: 'date',
    }).notNull(),

    revokedAt: timestamp('revoked_at', {
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
    unique('auth_sessions_refresh_token_hash_unique').on(table.refreshTokenHash),

    index('auth_sessions_user_id_idx').on(table.userId),

    index('auth_sessions_expires_at_idx').on(table.expiresAt),
  ],
);

export type AuthSession = typeof authSessions.$inferSelect;
export type NewAuthSession = typeof authSessions.$inferInsert;
