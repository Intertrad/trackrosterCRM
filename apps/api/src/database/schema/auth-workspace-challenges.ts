import { sql } from 'drizzle-orm';
import { check, index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { identities } from './identities.js';

/** Short-lived, single-use workspace selection after password verification. */
export const authWorkspaceChallenges = pgTable(
  'auth_workspace_challenges',
  {
    tokenHash: varchar('token_hash', { length: 64 }).primaryKey(),
    identityId: uuid('identity_id')
      .notNull()
      .references(() => identities.id, { onDelete: 'cascade' }),
    credentialsUpdatedAt: timestamp('credentials_updated_at', { withTimezone: true }).notNull(),
    securityStateUpdatedAt: timestamp('security_state_updated_at', {
      withTimezone: true,
    }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check('auth_workspace_challenges_hash_check', sql`${table.tokenHash} ~ '^[0-9a-f]{64}$'`),
    check('auth_workspace_challenges_expiry_check', sql`${table.expiresAt} > ${table.createdAt}`),
    index('auth_workspace_challenges_expiry_idx').on(table.expiresAt),
  ],
);
