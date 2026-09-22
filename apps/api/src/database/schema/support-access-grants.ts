import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { identities } from './identities.js';
import { platformAccessGrants, platformRoleEnum } from './platform-access-grants.js';
import { tenants } from './tenants.js';

export const supportAccessScopeEnum = pgEnum('support_access_scope', ['read_only']);

export const supportAccessGrantStatusEnum = pgEnum('support_access_grant_status', [
  'requested',
  'approved',
  'denied',
  'revoked',
]);

export const supportAccessGrants = pgTable(
  'support_access_grants',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    platformIdentityId: uuid('platform_identity_id').notNull(),

    platformAccessGrantId: uuid('platform_access_grant_id').notNull(),

    platformRole: platformRoleEnum('platform_role').default('support_operator').notNull(),

    tenantId: uuid('tenant_id').notNull(),

    scope: supportAccessScopeEnum('scope').default('read_only').notNull(),

    reason: varchar('reason', {
      length: 1000,
    }).notNull(),

    externalReference: varchar('external_reference', {
      length: 255,
    }).notNull(),

    status: supportAccessGrantStatusEnum('status').default('requested').notNull(),

    requestedByIdentityId: uuid('requested_by_identity_id').notNull(),

    requestedAt: timestamp('requested_at', {
      withTimezone: true,
      mode: 'date',
    })
      .defaultNow()
      .notNull(),

    approvedByIdentityId: uuid('approved_by_identity_id'),

    approvedAt: timestamp('approved_at', {
      withTimezone: true,
      mode: 'date',
    }),

    activatedAt: timestamp('activated_at', {
      withTimezone: true,
      mode: 'date',
    }),

    expiresAt: timestamp('expires_at', {
      withTimezone: true,
      mode: 'date',
    }),

    deniedByIdentityId: uuid('denied_by_identity_id'),

    deniedAt: timestamp('denied_at', {
      withTimezone: true,
      mode: 'date',
    }),

    denialReason: varchar('denial_reason', {
      length: 1000,
    }),

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
      columns: [table.platformIdentityId, table.platformAccessGrantId, table.platformRole],
      foreignColumns: [
        platformAccessGrants.identityId,
        platformAccessGrants.id,
        platformAccessGrants.role,
      ],
      name: 'support_access_grants_platform_identity_grant_role_fk',
    })
      .onDelete('restrict')
      .onUpdate('cascade'),

    foreignKey({
      columns: [table.tenantId],
      foreignColumns: [tenants.id],
      name: 'support_access_grants_tenant_fk',
    })
      .onDelete('restrict')
      .onUpdate('cascade'),

    foreignKey({
      columns: [table.requestedByIdentityId],
      foreignColumns: [identities.id],
      name: 'support_access_grants_requested_by_identity_fk',
    })
      .onDelete('restrict')
      .onUpdate('cascade'),

    foreignKey({
      columns: [table.approvedByIdentityId],
      foreignColumns: [identities.id],
      name: 'support_access_grants_approved_by_identity_fk',
    })
      .onDelete('restrict')
      .onUpdate('cascade'),

    foreignKey({
      columns: [table.deniedByIdentityId],
      foreignColumns: [identities.id],
      name: 'support_access_grants_denied_by_identity_fk',
    })
      .onDelete('restrict')
      .onUpdate('cascade'),

    foreignKey({
      columns: [table.revokedByIdentityId],
      foreignColumns: [identities.id],
      name: 'support_access_grants_revoked_by_identity_fk',
    })
      .onDelete('restrict')
      .onUpdate('cascade'),

    check(
      'support_access_grants_platform_role_check',
      sql`${table.platformRole} = 'support_operator'`,
    ),

    check(
      'support_access_grants_reason_not_blank_check',
      sql`${table.reason} = btrim(${table.reason}) AND char_length(${table.reason}) > 0`,
    ),

    check(
      'support_access_grants_external_reference_not_blank_check',
      sql`
        ${table.externalReference} = btrim(${table.externalReference})
        AND char_length(${table.externalReference}) > 0
      `,
    ),

    check(
      'support_access_grants_decision_actor_separation_check',
      sql`
        (
          ${table.approvedByIdentityId} IS NULL
          OR (
            ${table.approvedByIdentityId} <> ${table.platformIdentityId}
            AND ${table.approvedByIdentityId} <> ${table.requestedByIdentityId}
          )
        )
        AND (
          ${table.deniedByIdentityId} IS NULL
          OR (
            ${table.deniedByIdentityId} <> ${table.platformIdentityId}
            AND ${table.deniedByIdentityId} <> ${table.requestedByIdentityId}
          )
        )
      `,
    ),

    check(
      'support_access_grants_state_shape_check',
      sql`
        (
          ${table.status} = 'requested'
          AND ${table.approvedByIdentityId} IS NULL
          AND ${table.approvedAt} IS NULL
          AND ${table.activatedAt} IS NULL
          AND ${table.expiresAt} IS NULL
          AND ${table.deniedByIdentityId} IS NULL
          AND ${table.deniedAt} IS NULL
          AND ${table.denialReason} IS NULL
          AND ${table.revokedByIdentityId} IS NULL
          AND ${table.revokedAt} IS NULL
          AND ${table.revocationReason} IS NULL
        )
        OR
        (
          ${table.status} = 'approved'
          AND ${table.approvedByIdentityId} IS NOT NULL
          AND ${table.approvedAt} IS NOT NULL
          AND ${table.activatedAt} IS NOT NULL
          AND ${table.expiresAt} IS NOT NULL
          AND ${table.deniedByIdentityId} IS NULL
          AND ${table.deniedAt} IS NULL
          AND ${table.denialReason} IS NULL
          AND ${table.revokedByIdentityId} IS NULL
          AND ${table.revokedAt} IS NULL
          AND ${table.revocationReason} IS NULL
        )
        OR
        (
          ${table.status} = 'denied'
          AND ${table.approvedByIdentityId} IS NULL
          AND ${table.approvedAt} IS NULL
          AND ${table.activatedAt} IS NULL
          AND ${table.expiresAt} IS NULL
          AND ${table.deniedByIdentityId} IS NOT NULL
          AND ${table.deniedAt} IS NOT NULL
          AND ${table.denialReason} IS NOT NULL
          AND ${table.revokedByIdentityId} IS NULL
          AND ${table.revokedAt} IS NULL
          AND ${table.revocationReason} IS NULL
        )
        OR
        (
          ${table.status} = 'revoked'
          AND ${table.approvedByIdentityId} IS NOT NULL
          AND ${table.approvedAt} IS NOT NULL
          AND ${table.activatedAt} IS NOT NULL
          AND ${table.expiresAt} IS NOT NULL
          AND ${table.deniedByIdentityId} IS NULL
          AND ${table.deniedAt} IS NULL
          AND ${table.denialReason} IS NULL
          AND ${table.revokedByIdentityId} IS NOT NULL
          AND ${table.revokedAt} IS NOT NULL
          AND ${table.revocationReason} IS NOT NULL
        )
      `,
    ),

    check(
      'support_access_grants_decision_reason_check',
      sql`
        (
          ${table.denialReason} IS NULL
          OR (
            ${table.denialReason} = btrim(${table.denialReason})
            AND char_length(${table.denialReason}) > 0
          )
        )
        AND (
          ${table.revocationReason} IS NULL
          OR (
            ${table.revocationReason} = btrim(${table.revocationReason})
            AND char_length(${table.revocationReason}) > 0
          )
        )
      `,
    ),

    check(
      'support_access_grants_timestamp_order_check',
      sql`
        ${table.updatedAt} >= ${table.createdAt}
        AND ${table.requestedAt} >= ${table.createdAt}
        AND (
          ${table.approvedAt} IS NULL
          OR ${table.approvedAt} >= ${table.requestedAt}
        )
        AND (
          ${table.activatedAt} IS NULL
          OR ${table.activatedAt} >= ${table.approvedAt}
        )
        AND (
          ${table.expiresAt} IS NULL
          OR (
            ${table.expiresAt} > ${table.activatedAt}
            AND ${table.expiresAt} <= ${table.activatedAt} + interval '8 hours'
          )
        )
        AND (
          ${table.deniedAt} IS NULL
          OR ${table.deniedAt} >= ${table.requestedAt}
        )
        AND (
          ${table.revokedAt} IS NULL
          OR ${table.revokedAt} >= ${table.approvedAt}
        )
      `,
    ),

    uniqueIndex('support_access_grants_pending_unique')
      .on(table.platformIdentityId, table.tenantId, table.scope)
      .where(sql`${table.status} = 'requested'`),

    index('support_access_grants_platform_identity_grant_idx').on(
      table.platformIdentityId,
      table.platformAccessGrantId,
    ),

    index('support_access_grants_effective_lookup_idx')
      .on(table.platformIdentityId, table.tenantId, table.expiresAt)
      .where(sql`${table.status} = 'approved'`),

    index('support_access_grants_tenant_history_idx').on(table.tenantId, table.requestedAt),

    index('support_access_grants_requested_queue_idx')
      .on(table.requestedAt)
      .where(sql`${table.status} = 'requested'`),

    index('support_access_grants_requested_by_identity_idx').on(table.requestedByIdentityId),

    index('support_access_grants_approved_by_identity_idx').on(table.approvedByIdentityId),

    index('support_access_grants_denied_by_identity_idx').on(table.deniedByIdentityId),

    index('support_access_grants_revoked_by_identity_idx').on(table.revokedByIdentityId),
  ],
);

export type SupportAccessGrant = typeof supportAccessGrants.$inferSelect;
export type NewSupportAccessGrant = typeof supportAccessGrants.$inferInsert;
export type SupportAccessScope = (typeof supportAccessScopeEnum.enumValues)[number];
export type SupportAccessGrantStatus = (typeof supportAccessGrantStatusEnum.enumValues)[number];
