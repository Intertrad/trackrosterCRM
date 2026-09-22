import { index, integer, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { identities } from './identities.js';
export const authPasswordResets = pgTable(
  'auth_password_resets',
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
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('auth_password_resets_identity_idx').on(t.identityId),
    index('auth_password_resets_expiry_idx').on(t.expiresAt),
  ],
);

export const authMailOutbox = pgTable(
  'auth_mail_outbox',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    encryptedPayload: text('encrypted_payload'),
    attempts: integer('attempts').default(0).notNull(),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    failedAt: timestamp('failed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('auth_mail_outbox_pending_idx').on(t.nextAttemptAt)],
);
