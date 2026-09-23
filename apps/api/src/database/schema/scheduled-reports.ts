import {
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { tenantMemberships } from './tenant-memberships.js';
import { tenants } from './tenants.js';

export const scheduledReports = pgTable(
  'scheduled_reports',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    ownerId: uuid('owner_id').notNull(),
    reportKey: varchar('report_key', { length: 80 }).notNull(),
    cadence: varchar('cadence', { length: 40 }).notNull(),
    format: varchar('format', { length: 10 }).notNull(),
    recipients: jsonb('recipients').$type<string[]>().notNull(),
    filters: jsonb('filters').$type<Record<string, unknown>>().default({}).notNull(),
    timezone: varchar('timezone', { length: 80 }).default('UTC').notNull(),
    nextRunAt: timestamp('next_run_at', { withTimezone: true }).notNull(),
    active: integer('active').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    foreignKey({ columns: [t.tenantId], foreignColumns: [tenants.id] }),
    foreignKey({
      columns: [t.tenantId, t.ownerId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
    }),
    index('scheduled_reports_owner_idx').on(t.tenantId, t.ownerId),
  ],
);
export const scheduledReportDeliveries = pgTable(
  'scheduled_report_deliveries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    scheduleId: uuid('schedule_id').notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    error: varchar('error', { length: 1000 }),
    rowCount: integer('row_count'),
  },
  (t) => [
    foreignKey({ columns: [t.tenantId], foreignColumns: [tenants.id] }),
    foreignKey({ columns: [t.scheduleId], foreignColumns: [scheduledReports.id] }),
    index('scheduled_report_deliveries_idx').on(t.tenantId, t.scheduleId, t.startedAt),
  ],
);
