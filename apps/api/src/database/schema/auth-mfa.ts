import { sql } from 'drizzle-orm';
import {
  check,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  index,
} from 'drizzle-orm/pg-core';
import { identities } from './identities.js';

export const authMfaFactors = pgTable('auth_mfa_factors', {
  identityId: uuid('identity_id')
    .primaryKey()
    .references(() => identities.id, { onDelete: 'cascade' }),
  encryptedSecret: text('encrypted_secret').notNull(),
  lastUsedStep: integer('last_used_step').notNull().default(-1),
  enrolledAt: timestamp('enrolled_at', { withTimezone: true }).defaultNow().notNull(),
});

export const authMfaChallenges = pgTable(
  'auth_mfa_challenges',
  {
    tokenHash: varchar('token_hash', { length: 64 }).primaryKey(),
    identityId: uuid('identity_id')
      .notNull()
      .references(() => identities.id, { onDelete: 'cascade' }),
    purpose: varchar('purpose', { length: 16 }).$type<'login' | 'enroll'>().notNull(),
    encryptedSecret: text('encrypted_secret'),
    credentialsUpdatedAt: timestamp('credentials_updated_at', { withTimezone: true }).notNull(),
    securityStateUpdatedAt: timestamp('security_state_updated_at', {
      withTimezone: true,
    }).notNull(),
    attempts: integer('attempts').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    check(
      'auth_mfa_challenge_purpose_check',
      sql`(${t.purpose} = 'login' AND ${t.encryptedSecret} IS NULL) OR (${t.purpose} = 'enroll' AND ${t.encryptedSecret} IS NOT NULL)`,
    ),
    check('auth_mfa_challenge_attempts_check', sql`${t.attempts} BETWEEN 0 AND 5`),
    index('auth_mfa_challenge_identity_idx').on(t.identityId),
    index('auth_mfa_challenge_expiry_idx').on(t.expiresAt),
  ],
);

export const authMfaRecoveryCodes = pgTable(
  'auth_mfa_recovery_codes',
  {
    codeHash: varchar('code_hash', { length: 64 }).primaryKey(),
    identityId: uuid('identity_id')
      .notNull()
      .references(() => identities.id, { onDelete: 'cascade' }),
    usedAt: timestamp('used_at', { withTimezone: true }),
  },
  (t) => [index('auth_mfa_recovery_identity_idx').on(t.identityId)],
);
