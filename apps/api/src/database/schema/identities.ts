import { sql } from 'drizzle-orm';
import {
  check,
  index,
  pgEnum,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const identityStatusEnum = pgEnum('identity_status', ['active', 'suspended', 'disabled']);

export const identities = pgTable(
  'identities',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    email: varchar('email', {
      length: 320,
    }).notNull(),

    /*
     * Nullable by design so a later SSO-only identity does not need a
     * synthetic local credential. Every legacy user is backfilled exactly.
     */
    passwordHash: varchar('password_hash', {
      length: 255,
    }),

    status: identityStatusEnum('status').default('active').notNull(),

    emailVerifiedAt: timestamp('email_verified_at', {
      withTimezone: true,
      mode: 'date',
    }),

    mfaEnrolledAt: timestamp('mfa_enrolled_at', {
      withTimezone: true,
      mode: 'date',
    }),

    mfaRecoveryCodesRotatedAt: timestamp('mfa_recovery_codes_rotated_at', {
      withTimezone: true,
      mode: 'date',
    }),

    lastAuthenticatedAt: timestamp('last_authenticated_at', {
      withTimezone: true,
      mode: 'date',
    }),

    credentialsUpdatedAt: timestamp('credentials_updated_at', {
      withTimezone: true,
      mode: 'date',
    })
      .defaultNow()
      .notNull(),

    securityStateUpdatedAt: timestamp('security_state_updated_at', {
      withTimezone: true,
      mode: 'date',
    })
      .defaultNow()
      .notNull(),

    suspendedAt: timestamp('suspended_at', {
      withTimezone: true,
      mode: 'date',
    }),

    disabledAt: timestamp('disabled_at', {
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
    unique('identities_email_unique').on(table.email),

    check('identities_email_normalized_check', sql`${table.email} = lower(btrim(${table.email}))`),

    check('identities_email_not_blank_check', sql`char_length(${table.email}) > 0`),

    check(
      'identities_password_hash_not_blank_check',
      sql`${table.passwordHash} IS NULL OR char_length(btrim(${table.passwordHash})) > 0`,
    ),

    check(
      'identities_mfa_recovery_state_check',
      sql`${table.mfaRecoveryCodesRotatedAt} IS NULL OR ${table.mfaEnrolledAt} IS NOT NULL`,
    ),

    check(
      'identities_status_timestamps_check',
      sql`
        (
          ${table.status} = 'active'
          AND ${table.suspendedAt} IS NULL
          AND ${table.disabledAt} IS NULL
        )
        OR
        (
          ${table.status} = 'suspended'
          AND ${table.suspendedAt} IS NOT NULL
          AND ${table.disabledAt} IS NULL
        )
        OR
        (
          ${table.status} = 'disabled'
          AND ${table.disabledAt} IS NOT NULL
        )
      `,
    ),

    check(
      'identities_timestamp_order_check',
      sql`
        ${table.updatedAt} >= ${table.createdAt}
        AND ${table.credentialsUpdatedAt} >= ${table.createdAt}
        AND ${table.securityStateUpdatedAt} >= ${table.createdAt}
        AND (
          ${table.emailVerifiedAt} IS NULL
          OR ${table.emailVerifiedAt} >= ${table.createdAt}
        )
        AND (
          ${table.mfaEnrolledAt} IS NULL
          OR ${table.mfaEnrolledAt} >= ${table.createdAt}
        )
        AND (
          ${table.mfaRecoveryCodesRotatedAt} IS NULL
          OR ${table.mfaRecoveryCodesRotatedAt} >= ${table.mfaEnrolledAt}
        )
        AND (
          ${table.lastAuthenticatedAt} IS NULL
          OR ${table.lastAuthenticatedAt} >= ${table.createdAt}
        )
        AND (
          ${table.suspendedAt} IS NULL
          OR ${table.suspendedAt} >= ${table.createdAt}
        )
        AND (
          ${table.disabledAt} IS NULL
          OR ${table.disabledAt} >= ${table.createdAt}
        )
      `,
    ),

    index('identities_status_idx').on(table.status),
  ],
);

export type Identity = typeof identities.$inferSelect;
export type NewIdentity = typeof identities.$inferInsert;
export type IdentityStatus = (typeof identityStatusEnum.enumValues)[number];
