import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { tenantMemberships } from './tenant-memberships.js';
import type { ImportPreviewRow } from '../../imports/import-preview.types.js';
export type ImportMapping = Record<string, string>;
export const importJobs = pgTable(
  'import_jobs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    requesterId: uuid('requester_id').notNull(),
    status: varchar('status', { length: 16 })
      .$type<'draft' | 'uploaded' | 'validated' | 'committed' | 'cancelled'>()
      .notNull()
      .default('draft'),
    filename: varchar('filename', { length: 255 }),
    fileHash: varchar('file_hash', { length: 64 }),
    headers: jsonb('headers').$type<string[]>().notNull().default([]),
    records: jsonb('records').$type<string[][]>().notNull().default([]),
    mapping: jsonb('mapping').$type<ImportMapping>().notNull().default({}),
    summary: jsonb('summary').$type<Record<string, number>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('import_jobs_tenant_id_unique').on(t.tenantId, t.id),
    foreignKey({
      columns: [t.tenantId, t.requesterId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
    }).onDelete('restrict'),
    check(
      'import_jobs_status_check',
      sql`${t.status} IN ('draft','uploaded','validated','committed','cancelled')`,
    ),
    index('import_jobs_list_idx').on(t.tenantId, t.id),
  ],
);
export const importRows = pgTable(
  'import_rows',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    importId: uuid('import_id').notNull(),
    rowNumber: integer('row_number').notNull(),
    data: jsonb('data').$type<ImportPreviewRow>().notNull(),
    resolution: varchar('resolution', { length: 24 }).$type<'skip' | 'reuse' | null>(),
    existingId: uuid('existing_id'),
    establishmentId: uuid('establishment_id'),
    contactId: uuid('contact_id'),
    result: varchar('result', { length: 16 }).$type<'created' | 'reused' | 'skipped' | null>(),
  },
  (t) => [
    unique('import_rows_tenant_id_unique').on(t.tenantId, t.id),
    unique('import_rows_job_number_unique').on(t.tenantId, t.importId, t.rowNumber),
    foreignKey({
      columns: [t.tenantId, t.importId],
      foreignColumns: [importJobs.tenantId, importJobs.id],
    }).onDelete('cascade'),
    index('import_rows_job_idx').on(t.tenantId, t.importId, t.rowNumber),
  ],
);
export const importIssues = pgTable(
  'import_issues',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    importId: uuid('import_id').notNull(),
    rowId: uuid('row_id').notNull(),
    code: varchar('code', { length: 64 }).notNull(),
    severity: varchar('severity', { length: 16 }).notNull(),
    message: text('message').notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (t) => [
    foreignKey({
      columns: [t.tenantId, t.rowId],
      foreignColumns: [importRows.tenantId, importRows.id],
    }).onDelete('cascade'),
    foreignKey({
      columns: [t.tenantId, t.importId],
      foreignColumns: [importJobs.tenantId, importJobs.id],
    }).onDelete('cascade'),
    index('import_issues_job_idx').on(t.tenantId, t.importId, t.id),
  ],
);
export const exportJobs = pgTable(
  'export_jobs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    requesterId: uuid('requester_id').notNull(),
    status: varchar('status', { length: 16 })
      .$type<'queued' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'expired'>()
      .notNull()
      .default('queued'),
    request: jsonb('request').$type<Record<string, unknown>>().notNull(),
    authorityHash: varchar('authority_hash', { length: 64 }).notNull(),
    filename: varchar('filename', { length: 255 }),
    contentType: varchar('content_type', { length: 128 }),
    contentBase64: text('content_base64'),
    rowCount: integer('row_count'),
    failureCode: varchar('failure_code', { length: 64 }),
    attempts: integer('attempts').notNull().default(0),
    leaseId: uuid('lease_id'),
    leaseUntil: timestamp('lease_until', { withTimezone: true }),
    downloadHash: varchar('download_hash', { length: 64 }),
    downloadExpiresAt: timestamp('download_expires_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      columns: [t.tenantId, t.requesterId],
      foreignColumns: [tenantMemberships.tenantId, tenantMemberships.id],
    }).onDelete('restrict'),
    check(
      'export_jobs_status_check',
      sql`${t.status} IN ('queued','processing','completed','failed','cancelled','expired')`,
    ),
    index('export_jobs_queue_idx').on(t.status, t.leaseUntil, t.createdAt),
    index('export_jobs_owner_idx').on(t.tenantId, t.requesterId, t.id),
  ],
);
