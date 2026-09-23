import { foreignKey, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { tenantMemberships } from './tenant-memberships.js';
export const accessReviews = pgTable(
  'access_reviews',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    startedBy: uuid('started_by').notNull(),
    status: varchar('status', { length: 20 }).notNull().default('open'),
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [
    foreignKey({ columns: [t.tenantId], foreignColumns: [tenants.id] }),
    foreignKey({
      columns: [t.tenantId, t.startedBy],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
    }),
  ],
);
export const accessReviewDecisions = pgTable(
  'access_review_decisions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    reviewId: uuid('review_id').notNull(),
    membershipId: uuid('membership_id').notNull(),
    reviewerId: uuid('reviewer_id').notNull(),
    decision: varchar('decision', { length: 20 }).notNull(),
    reason: varchar('reason', { length: 1000 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    foreignKey({ columns: [t.tenantId], foreignColumns: [tenants.id] }),
    foreignKey({ columns: [t.reviewId], foreignColumns: [accessReviews.id] }),
    foreignKey({
      columns: [t.tenantId, t.membershipId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
    }),
    foreignKey({
      columns: [t.tenantId, t.reviewerId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
    }),
  ],
);
export const complianceReports = pgTable(
  'compliance_reports',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    requestedBy: uuid('requested_by').notNull(),
    reportType: varchar('report_type', { length: 60 }).notNull(),
    parameters: jsonb('parameters').default({}).notNull(),
    status: varchar('status', { length: 20 }).notNull().default('ready'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [
    foreignKey({ columns: [t.tenantId], foreignColumns: [tenants.id] }),
    foreignKey({
      columns: [t.tenantId, t.requestedBy],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
    }),
  ],
);
export const evidenceExports = pgTable(
  'evidence_exports',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    requestedBy: uuid('requested_by').notNull(),
    scope: jsonb('scope').notNull(),
    status: varchar('status', { length: 20 }).notNull().default('ready'),
    objectKey: varchar('object_key', { length: 500 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (t) => [
    foreignKey({ columns: [t.tenantId], foreignColumns: [tenants.id] }),
    foreignKey({
      columns: [t.tenantId, t.requestedBy],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
    }),
  ],
);
