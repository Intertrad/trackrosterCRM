import { jsonb, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';

import { tenants } from './tenants.js';
import type { ProspectReservation } from '../../reservations/reservation.types.js';

/**
 * Append-only intent written before the external Redis lease is acquired.
 *
 * This table deliberately has no campaign/establishment foreign keys or guard
 * trigger. It is the independent durable boundary for an irreversible Redis
 * side effect; reconciliation can promote it after a process restart even when
 * the request transaction that initiated the claim has rolled back.
 */
export const reservationIntents = pgTable('reservation_intents', {
  id: uuid('id').primaryKey(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  campaignId: uuid('campaign_id').notNull(),
  campaignProspectId: uuid('campaign_prospect_id').notNull(),
  establishmentId: uuid('establishment_id').notNull(),
  ownerMembershipId: uuid('owner_membership_id').notNull(),
  lease: jsonb('lease').$type<ProspectReservation>().notNull(),
  ruleSnapshot: jsonb('rule_snapshot').$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type ReservationIntent = typeof reservationIntents.$inferSelect;
