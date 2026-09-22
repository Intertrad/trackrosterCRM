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
export const membershipInvitations = pgTable(
  'membership_invitations',
  {
    tokenHash: varchar('token_hash', { length: 64 }).primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    membershipId: uuid('membership_id').notNull(),
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
    check('membership_invitation_attempts_check', sql`${t.attempts} BETWEEN 0 AND 10`),
    index('membership_invitations_membership_idx').on(t.tenantId, t.membershipId),
  ],
);
