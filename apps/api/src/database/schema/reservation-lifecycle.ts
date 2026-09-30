import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { campaigns } from './campaigns.js';
import type { ProspectReservation } from '../../reservations/reservation.types.js';
export const reservationRules = pgTable(
  'reservation_rules',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    campaignId: uuid('campaign_id'),
    durationMinutes: integer('duration_minutes').notNull().default(20),
    cooldownMinutes: integer('cooldown_minutes').notNull().default(60),
    maxHoldMinutes: integer('max_hold_minutes').notNull().default(120),
    allowHeartbeat: boolean('allow_heartbeat').notNull().default(true),
    allowExtension: boolean('allow_extension').notNull().default(true),
    allowManagerOverride: boolean('allow_manager_override').notNull().default(true),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique('reservation_rules_tenant_id_unique').on(t.tenantId, t.id),
    foreignKey({
      name: 'reservation_rules_campaign_fk',
      columns: [t.tenantId, t.campaignId],
      foreignColumns: [campaigns.tenantId, campaigns.id],
    }).onDelete('cascade'),
    uniqueIndex('reservation_rules_active_tenant')
      .on(t.tenantId)
      .where(sql`${t.isActive} AND ${t.campaignId} IS NULL`),
    uniqueIndex('reservation_rules_active_campaign')
      .on(t.tenantId, t.campaignId)
      .where(sql`${t.isActive} AND ${t.campaignId} IS NOT NULL`),
    check(
      'reservation_rules_bounds',
      sql`${t.durationMinutes} BETWEEN 1 AND 240 AND ${t.maxHoldMinutes} BETWEEN ${t.durationMinutes} AND 1440 AND ${t.cooldownMinutes} BETWEEN 0 AND 10080`,
    ),
  ],
);
// This is evidence of an external Redis lease, not the authority for prospect ownership.
// Context IDs are retained snapshots; they deliberately do not lock mutable assignment/prospect rows.
export const reservationRecords = pgTable(
  'reservation_records',
  {
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
    status: varchar('status', { length: 16 })
      .$type<'pending' | 'active' | 'released' | 'expired' | 'lost' | 'failed'>()
      .notNull()
      .default('pending'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique('reservation_records_tenant_id_unique').on(t.tenantId, t.id),
    check(
      'reservation_records_status_check',
      sql`${t.status} IN ('pending','active','released','expired','lost','failed')`,
    ),
    index('reservation_records_queue_idx').on(t.tenantId, t.status, t.id),
    index('reservation_records_due_idx').on(t.status, t.expiresAt),
    index('reservation_records_scope_idx').on(t.tenantId, t.campaignProspectId),
    uniqueIndex('reservation_records_active_prospect_unique')
      .on(t.tenantId, t.campaignProspectId)
      .where(sql`${t.status} = 'active'`),
    index('reservation_records_open_establishment_idx').on(
      t.tenantId,
      t.establishmentId,
      t.status,
      t.expiresAt,
    ),
  ],
);
export const reservationEvents = pgTable(
  'reservation_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    reservationId: uuid('reservation_id').notNull(),
    type: varchar('type', { length: 50 }).notNull(),
    data: jsonb('data').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    foreignKey({
      name: 'reservation_events_record_fk',
      columns: [t.tenantId, t.reservationId],
      foreignColumns: [reservationRecords.tenantId, reservationRecords.id],
    }).onDelete('cascade'),
    index('reservation_events_record_idx').on(t.tenantId, t.reservationId, t.createdAt),
  ],
);
