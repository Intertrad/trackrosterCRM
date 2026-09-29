import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  pgEnum,
  pgTable,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { identities } from './identities.js';

export const platformRoleEnum = pgEnum('platform_role', ['super_admin', 'support_operator']);

export const platformAccessGrantSourceEnum = pgEnum('platform_access_grant_source', [
  'bootstrap',
  'platform_admin',
]);

export const platformAccessGrants = pgTable(
  'platform_access_grants',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    identityId: uuid('identity_id').notNull(),

    role: platformRoleEnum('role').notNull(),

    grantSource: platformAccessGrantSourceEnum('grant_source').notNull(),

    grantedByIdentityId: uuid('granted_by_identity_id'),

    grantReason: varchar('grant_reason', {
      length: 1000,
    }).notNull(),

    externalReference: varchar('external_reference', {
      length: 255,
    }).notNull(),

    grantedAt: timestamp('granted_at', {
      withTimezone: true,
      mode: 'date',
    })
      .defaultNow()
      .notNull(),

    revokedByIdentityId: uuid('revoked_by_identity_id'),

    revokedAt: timestamp('revoked_at', {
      withTimezone: true,
      mode: 'date',
    }),

    revocationReason: varchar('revocation_reason', {
      length: 1000,
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
      name: 'platform_access_grants_identity_fk',
    })
      .onDelete('restrict')
      .onUpdate('cascade'),

    foreignKey({
      columns: [table.grantedByIdentityId],
      foreignColumns: [identities.id],
      name: 'platform_access_grants_granted_by_identity_fk',
    })
      .onDelete('restrict')
      .onUpdate('cascade'),

    foreignKey({
      columns: [table.revokedByIdentityId],
      foreignColumns: [identities.id],
      name: 'platform_access_grants_revoked_by_identity_fk',
    })
      .onDelete('restrict')
      .onUpdate('cascade'),

    unique('platform_access_grants_identity_id_role_unique').on(
      table.identityId,
      table.id,
      table.role,
    ),

    check(
      'platform_access_grants_source_actor_check',
      sql`
        (
          ${table.grantSource} = 'bootstrap'
          AND ${table.role} = 'super_admin'
          AND ${table.grantedByIdentityId} IS NULL
        )
        OR
        (
          ${table.grantSource} = 'platform_admin'
          AND ${table.grantedByIdentityId} IS NOT NULL
          AND ${table.grantedByIdentityId} <> ${table.identityId}
        )
      `,
    ),

    check(
      'platform_access_grants_reason_check',
      sql`
        ${table.grantReason} = btrim(${table.grantReason})
        AND char_length(${table.grantReason}) > 0
      `,
    ),

    check(
      'platform_access_grants_external_reference_check',
      sql`
        ${table.externalReference} = btrim(${table.externalReference})
        AND char_length(${table.externalReference}) > 0
      `,
    ),

    check(
      'platform_access_grants_revocation_check',
      sql`
        (
          ${table.revokedAt} IS NULL
          AND ${table.revokedByIdentityId} IS NULL
          AND ${table.revocationReason} IS NULL
        )
        OR
        (
          ${table.revokedAt} IS NOT NULL
          AND ${table.revokedByIdentityId} IS NOT NULL
          AND ${table.revocationReason} IS NOT NULL
          AND ${table.revocationReason} = btrim(${table.revocationReason})
          AND char_length(${table.revocationReason}) > 0
        )
      `,
    ),

    check(
      'platform_access_grants_timestamp_order_check',
      sql`
        ${table.updatedAt} >= ${table.createdAt}
        AND ${table.grantedAt} >= ${table.createdAt}
        AND (
          ${table.revokedAt} IS NULL
          OR ${table.revokedAt} >= ${table.grantedAt}
        )
      `,
    ),

    uniqueIndex('platform_access_grants_identity_role_unrevoked_unique')
      .on(table.identityId, table.role)
      .where(sql`${table.revokedAt} IS NULL`),

    index('platform_access_grants_unrevoked_role_identity_idx')
      .on(table.role, table.identityId)
      .where(sql`${table.revokedAt} IS NULL`),

    index('platform_access_grants_granted_by_identity_idx').on(table.grantedByIdentityId),

    index('platform_access_grants_revoked_by_identity_idx').on(table.revokedByIdentityId),
  ],
);

export type PlatformAccessGrant = typeof platformAccessGrants.$inferSelect;
export type NewPlatformAccessGrant = typeof platformAccessGrants.$inferInsert;
export type PlatformRole = (typeof platformRoleEnum.enumValues)[number];
export type PlatformAccessGrantSource = (typeof platformAccessGrantSourceEnum.enumValues)[number];
