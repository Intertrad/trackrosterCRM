import { index, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
/** Immutable database-generated snapshots; no FK to the mutable audit source or membership. */
export const membershipAccessEvidence = pgTable(
  'membership_access_evidence',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    membershipId: uuid('membership_id').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    digest: varchar('digest', { length: 64 }).notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    index('membership_access_evidence_timeline_idx').on(
      t.tenantId,
      t.membershipId,
      t.occurredAt,
      t.id,
    ),
  ],
);
