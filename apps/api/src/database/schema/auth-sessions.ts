import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { identities } from './identities.js';
import { tenantMemberships } from './tenant-memberships.js';
import { users } from './users.js';

export const authSessions = pgTable(
  'auth_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'cascade',
      onUpdate: 'cascade',
    }),

    identityId: uuid('identity_id').notNull(),

    membershipId: uuid('membership_id').notNull(),

    tenantId: uuid('tenant_id').notNull(),

    refreshTokenHash: varchar('refresh_token_hash', {
      length: 64,
    }).notNull(),

    expiresAt: timestamp('expires_at', {
      withTimezone: true,
      mode: 'date',
    }).notNull(),

    absoluteExpiresAt: timestamp('absolute_expires_at', {
      withTimezone: true,
      mode: 'date',
    }).notNull(),

    revokedAt: timestamp('revoked_at', {
      withTimezone: true,
      mode: 'date',
    }),

    revokedReason: varchar('revoked_reason', {
      length: 64,
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
    foreignKey({
      columns: [table.identityId],
      foreignColumns: [identities.id],
      name: 'auth_sessions_identity_fk',
    })
      .onDelete('cascade')
      .onUpdate('cascade'),

    foreignKey({
      columns: [table.tenantId, table.membershipId, table.identityId],
      foreignColumns: [
        tenantMemberships.tenantId,
        tenantMemberships.id,
        tenantMemberships.identityId,
      ],
      name: 'auth_sessions_tenant_membership_identity_fk',
    })
      .onDelete('cascade')
      .onUpdate('cascade'),

    unique('auth_sessions_refresh_token_hash_unique').on(table.refreshTokenHash),

    check(
      'auth_sessions_legacy_user_context_check',
      sql`
        ${table.userId} IS NULL
        OR (
          ${table.userId} = ${table.identityId}
          AND ${table.userId} = ${table.membershipId}
        )
      `,
    ),

    check(
      'auth_sessions_refresh_token_hash_format_check',
      sql`${table.refreshTokenHash} ~ '^[0-9a-f]{64}$'`,
    ),

    check(
      'auth_sessions_timestamp_order_check',
      sql`
        ${table.updatedAt} >= ${table.createdAt}
        AND ${table.expiresAt} > ${table.createdAt}
        AND ${table.absoluteExpiresAt} >= ${table.expiresAt}
        AND (
          (
            ${table.revokedAt} IS NULL
            AND ${table.revokedReason} IS NULL
          )
          OR (
            ${table.revokedAt} IS NOT NULL
            AND ${table.revokedAt} >= ${table.createdAt}
            AND ${table.revokedAt} <= ${table.updatedAt}
            AND ${table.revokedReason} IS NOT NULL
            AND ${table.revokedReason} = btrim(${table.revokedReason})
            AND char_length(${table.revokedReason}) > 0
          )
        )
      `,
    ),

    index('auth_sessions_user_id_idx').on(table.userId),

    index('auth_sessions_identity_id_idx').on(table.identityId),

    index('auth_sessions_tenant_membership_identity_idx').on(
      table.tenantId,
      table.membershipId,
      table.identityId,
    ),

    index('auth_sessions_active_identity_session_idx')
      .on(table.identityId, table.id)
      .where(sql`${table.revokedAt} IS NULL`),

    index('auth_sessions_expires_at_idx').on(table.expiresAt),
  ],
);

export type AuthSession = typeof authSessions.$inferSelect;
export type NewAuthSession = typeof authSessions.$inferInsert;
