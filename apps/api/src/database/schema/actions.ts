import { campaignProspects } from './campaign-prospects.js';
import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  jsonb,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { campaignProspectAssignments } from './campaign-prospect-assignments.js';
import { tenantMemberships } from './tenant-memberships.js';
export const actions = pgTable(
  'actions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    campaignId: uuid('campaign_id').notNull(),
    campaignProspectId: uuid('campaign_prospect_id').notNull(),
    establishmentId: uuid('establishment_id').notNull(),
    assignmentId: uuid('assignment_id').notNull(),
    assigneeMembershipId: uuid('assignee_membership_id').notNull(),
    createdBy: uuid('created_by').notNull(),
    type: varchar('type', { length: 16 })
      .$type<'call' | 'email' | 'message' | 'visit' | 'task' | 'note'>()
      .notNull(),
    status: varchar('status', { length: 16 })
      .$type<'planned' | 'started' | 'completed' | 'cancelled'>()
      .notNull()
      .default('planned'),
    subject: varchar('subject', { length: 255 }).notNull(),
    notes: varchar('notes', { length: 10000 }),
    dueAt: timestamp('due_at', { withTimezone: true }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    reservationId: uuid('reservation_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    foreignKey({
      columns: [t.tenantId, t.campaignId, t.campaignProspectId, t.establishmentId],
      foreignColumns: [
        campaignProspects.tenantId,
        campaignProspects.campaignId,
        campaignProspects.id,
        campaignProspects.establishmentId,
      ],
      name: 'actions_prospect_fk',
    }).onDelete('restrict'),
    unique('actions_tenant_id_unique').on(t.tenantId, t.id),
    foreignKey({
      columns: [t.tenantId, t.campaignProspectId, t.assignmentId],
      foreignColumns: [
        campaignProspectAssignments.tenantId,
        campaignProspectAssignments.campaignProspectId,
        campaignProspectAssignments.id,
      ],
      name: 'actions_assignment_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [t.tenantId, t.assigneeMembershipId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
      name: 'actions_assignee_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [t.tenantId, t.createdBy],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
      name: 'actions_creator_fk',
    }).onDelete('restrict'),
    check('actions_type_check', sql`${t.type} IN ('call','email','message','visit','task','note')`),
    check(
      'actions_status_check',
      sql`${t.status} IN ('planned','started','completed','cancelled')`,
    ),
    check('actions_subject_check', sql`length(btrim(${t.subject}))>0`),
    index('actions_queue_idx').on(t.tenantId, t.assigneeMembershipId, t.status, t.dueAt),
    index('actions_prospect_idx').on(t.tenantId, t.establishmentId),
  ],
);
export const actionOutcomes = pgTable(
  'action_outcomes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    actionId: uuid('action_id').notNull(),
    outcomeCode: varchar('outcome_code', { length: 40 }).notNull(),
    notes: varchar('notes', { length: 10000 }),
    recordedBy: uuid('recorded_by').notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique('action_outcomes_one_per_action').on(t.tenantId, t.actionId),
    foreignKey({
      columns: [t.tenantId, t.actionId],
      foreignColumns: [actions.tenantId, actions.id],
      name: 'action_outcomes_action_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [t.tenantId, t.recordedBy],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
      name: 'action_outcomes_actor_fk',
    }).onDelete('restrict'),
  ],
);
export const actionEvents = pgTable(
  'action_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    actionId: uuid('action_id').notNull(),
    eventType: varchar('event_type', { length: 30 }).notNull(),
    actorMembershipId: uuid('actor_membership_id').notNull(),
    data: jsonb('data').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    foreignKey({
      columns: [t.tenantId, t.actionId],
      foreignColumns: [actions.tenantId, actions.id],
      name: 'action_events_action_fk',
    }).onDelete('restrict'),
    foreignKey({
      columns: [t.tenantId, t.actorMembershipId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
      name: 'action_events_actor_fk',
    }).onDelete('restrict'),
    index('action_events_action_idx').on(t.tenantId, t.actionId, t.createdAt),
  ],
);
export const actionEffects = pgTable(
  'action_effects',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    actionId: uuid('action_id').notNull(),
    type: varchar('type', { length: 24 })
      .$type<'release_reservation' | 'schedule_follow_up'>()
      .notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  },
  (t) => [
    foreignKey({
      columns: [t.tenantId, t.actionId],
      foreignColumns: [actions.tenantId, actions.id],
      name: 'action_effects_action_fk',
    }).onDelete('restrict'),
    index('action_effects_pending_idx')
      .on(t.createdAt)
      .where(sql`${t.deliveredAt} IS NULL`),
  ],
);
