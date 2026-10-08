import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { tenantMemberships } from './tenant-memberships.js';
import { platformRoleEnum } from './platform-access-grants.js';
import { identities } from './identities.js';
export const membershipInvitations = pgTable(
  'membership_invitations',
  {
    tokenHash: varchar('token_hash', { length: 64 }).primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    membershipId: uuid('membership_id').notNull(),
    platformRole: platformRoleEnum('platform_role'),
    platformGrantReason: varchar('platform_grant_reason', { length: 1000 }),
    platformGrantedByIdentityId: uuid('platform_granted_by_identity_id'),
    attempts: integer('attempts').default(0).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    foreignKey({
      columns: [t.tenantId, t.membershipId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
    }).onDelete('cascade'),
    foreignKey({
      columns: [t.platformGrantedByIdentityId],
      foreignColumns: [identities.id],
    })
      .onDelete('restrict')
      .onUpdate('cascade'),
    check(
      'membership_invitation_platform_grant_check',
      sql`(
        ${t.platformRole} IS NULL
        AND ${t.platformGrantReason} IS NULL
        AND ${t.platformGrantedByIdentityId} IS NULL
      ) OR (
        ${t.platformRole} IS NOT NULL
        AND ${t.platformGrantReason} IS NOT NULL
        AND ${t.platformGrantedByIdentityId} IS NOT NULL
        AND ${t.platformGrantReason} = btrim(${t.platformGrantReason})
        AND char_length(${t.platformGrantReason}) > 0
      )`,
    ),
    check('membership_invitation_attempts_check', sql`${t.attempts} BETWEEN 0 AND 10`),
    index('membership_invitations_membership_idx').on(t.tenantId, t.membershipId),
  ],
);
