import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  jsonb,
  pgTable,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { campaignProspects } from './campaign-prospects.js';
import { campaignProspectAssignments } from './campaign-prospect-assignments.js';
import { tenantMemberships } from './tenant-memberships.js';
import { collisionOverrides } from './collision-overrides.js';
import type { CollisionDecisionResult } from '../../collisions/collision.types.js';

export const collisionEvents = pgTable(
  'collision_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    campaignId: uuid('campaign_id').notNull(),
    campaignProspectId: uuid('campaign_prospect_id').notNull(),
    establishmentId: uuid('establishment_id').notNull(),
    assignmentId: uuid('assignment_id').notNull(),
    detectedBy: uuid('detected_by').notNull(),
    decision: varchar('decision', { length: 24 })
      .$type<CollisionDecisionResult['decision']>()
      .notNull(),
    reasonCode: varchar('reason_code', { length: 40 })
      .$type<CollisionDecisionResult['reasonCode']>()
      .notNull(),
    conflictKey: varchar('conflict_key', { length: 512 }),
    evaluation: jsonb('evaluation').$type<CollisionDecisionResult>().notNull(),
    policySnapshot: jsonb('policy_snapshot').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    unique('collision_events_tenant_id_unique').on(t.tenantId, t.id),
    unique('collision_events_request_context_unique').on(
      t.tenantId,
      t.id,
      t.campaignProspectId,
      t.detectedBy,
    ),
    foreignKey({
      name: 'collision_events_prospect_fk',
      columns: [t.tenantId, t.campaignId, t.campaignProspectId, t.establishmentId],
      foreignColumns: [
        campaignProspects.tenantId,
        campaignProspects.campaignId,
        campaignProspects.id,
        campaignProspects.establishmentId,
      ],
    }).onDelete('restrict'),
    foreignKey({
      name: 'collision_events_assignment_fk',
      columns: [t.tenantId, t.campaignProspectId, t.assignmentId],
      foreignColumns: [
        campaignProspectAssignments.tenantId,
        campaignProspectAssignments.campaignProspectId,
        campaignProspectAssignments.id,
      ],
    }).onDelete('restrict'),
    foreignKey({
      name: 'collision_events_actor_fk',
      columns: [t.tenantId, t.detectedBy],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
    }).onDelete('restrict'),
    check(
      'collision_events_decision_check',
      sql`${t.decision} IN ('block','warn','require_override')`,
    ),
    check(
      'collision_events_reason_check',
      sql`${t.reasonCode} IN ('ACTIVE_RESERVATION','ACTIVE_ASSIGNMENT','PLANNED_ACTION','RECENT_CONTACT')`,
    ),
    check('collision_events_expiry_check', sql`${t.expiresAt}>${t.createdAt}`),
    index('collision_events_queue_idx').on(t.tenantId, t.campaignId, t.id),
    index('collision_events_prospect_idx').on(t.tenantId, t.campaignProspectId),
    index('collision_events_assignment_idx').on(t.tenantId, t.assignmentId),
    index('collision_events_actor_idx').on(t.tenantId, t.detectedBy),
  ],
);
export const overrideRequests = pgTable(
  'override_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    collisionId: uuid('collision_id').notNull(),
    campaignProspectId: uuid('campaign_prospect_id').notNull(),
    requestedBy: uuid('requested_by').notNull(),
    reason: varchar('reason', { length: 1000 }).notNull(),
    status: varchar('status', { length: 16 })
      .$type<'pending' | 'approved' | 'rejected' | 'cancelled'>()
      .default('pending')
      .notNull(),
    decidedBy: uuid('decided_by'),
    decisionReason: varchar('decision_reason', { length: 1000 }),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    overrideId: uuid('override_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique('override_requests_tenant_id_unique').on(t.tenantId, t.id),
    foreignKey({
      name: 'override_requests_collision_fk',
      columns: [t.tenantId, t.collisionId, t.campaignProspectId, t.requestedBy],
      foreignColumns: [
        collisionEvents.tenantId,
        collisionEvents.id,
        collisionEvents.campaignProspectId,
        collisionEvents.detectedBy,
      ],
    }).onDelete('restrict'),
    foreignKey({
      name: 'override_requests_decider_fk',
      columns: [t.tenantId, t.decidedBy],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
    }).onDelete('restrict'),
    foreignKey({
      name: 'override_requests_approval_fk',
      columns: [t.tenantId, t.overrideId],
      foreignColumns: [collisionOverrides.tenantId, collisionOverrides.id],
    }).onDelete('restrict'),
    check('override_requests_reason_check', sql`length(btrim(${t.reason})) BETWEEN 10 AND 1000`),
    check(
      'override_requests_state_check',
      sql`(${t.status}='pending' AND ${t.decidedBy} IS NULL AND ${t.decidedAt} IS NULL AND ${t.decisionReason} IS NULL AND ${t.overrideId} IS NULL) OR (${t.status} IN ('approved','rejected','cancelled') AND ${t.decidedBy} IS NOT NULL AND ${t.decidedAt} IS NOT NULL AND ${t.decisionReason} IS NOT NULL AND length(btrim(${t.decisionReason})) BETWEEN 10 AND 1000 AND ((${t.status}='approved' AND ${t.overrideId} IS NOT NULL AND ${t.decidedBy}<>${t.requestedBy}) OR (${t.status}<>'approved' AND ${t.overrideId} IS NULL)))`,
    ),
    uniqueIndex('override_requests_one_pending')
      .on(t.tenantId, t.campaignProspectId, t.requestedBy)
      .where(sql`${t.status}='pending'`),
    index('override_requests_queue_idx').on(t.tenantId, t.status, t.id),
    index('override_requests_collision_idx').on(t.tenantId, t.collisionId),
    index('override_requests_decider_idx').on(t.tenantId, t.decidedBy),
    index('override_requests_approval_idx').on(t.tenantId, t.overrideId),
  ],
);
