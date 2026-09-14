import { sql } from 'drizzle-orm';

import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { tenants } from './tenants.js';
import { users } from './users.js';

export const idempotencyRecordStatusEnum = pgEnum('idempotency_record_status', [
  'processing',
  'completed',
  'uncertain',
]);

export const idempotencyRecords = pgTable(
  'idempotency_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),

    /*
     * Idempotency is isolated by the
     * authenticated actor as well as tenant.
     *
     * Two users may therefore use the same
     * client-supplied Idempotency-Key safely.
     */
    userId: uuid('user_id').notNull(),

    /*
     * Server-owned operation identifier.
     *
     * Examples:
     *
     * assignment.assign
     * activity.record
     * follow_up.complete
     * collision_override.create
     *
     * Never derive this value from client input.
     */
    operation: varchar('operation', {
      length: 128,
    }).notNull(),

    /*
     * SHA-256 of the raw Idempotency-Key.
     *
     * We intentionally do not persist the
     * client key itself.
     */
    idempotencyKeyHash: varchar('idempotency_key_hash', {
      length: 64,
    }).notNull(),

    /*
     * SHA-256 of the canonical request identity.
     *
     * Same key + different request hash must
     * be rejected rather than executed.
     */
    requestHash: varchar('request_hash', {
      length: 64,
    }).notNull(),

    status: idempotencyRecordStatusEnum('status').default('processing').notNull(),

    /*
     * Stored only for replayable completed
     * requests.
     */
    responseStatus: integer('response_status'),

    /*
     * Protected endpoints currently return
     * JSON-compatible API responses.
     *
     * Do not store secrets or raw authorization
     * material here.
     */
    responseBody: jsonb('response_body').$type<unknown>(),

    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'date',
    })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp('updated_at', {
      withTimezone: true,
      mode: 'date',
    })
      .defaultNow()
      .notNull(),

    /*
     * Set when the record reaches either
     * completed or uncertain.
     */
    finalizedAt: timestamp('finalized_at', {
      withTimezone: true,
      mode: 'date',
    }),

    /*
     * V1 retention is controlled by the
     * application when claiming the key.
     */
    expiresAt: timestamp('expires_at', {
      withTimezone: true,
      mode: 'date',
    }).notNull(),
  },

  (table) => [
    /*
     * Enforce tenant-safe user ownership.
     *
     * users already exposes a unique
     * (tenant_id, id) identity.
     */
    foreignKey({
      name: 'idempotency_records_tenant_user_fk',

      columns: [table.tenantId, table.userId],

      foreignColumns: [users.tenantId, users.id],
    })
      .onDelete('cascade')
      .onUpdate('cascade'),

    /*
     * This is the actual idempotency boundary:
     *
     * tenant + actor + operation + key.
     */
    unique('idempotency_records_boundary_unique').on(
      table.tenantId,
      table.userId,
      table.operation,
      table.idempotencyKeyHash,
    ),

    index('idempotency_records_expires_at_idx').on(table.expiresAt),

    index('idempotency_records_tenant_status_idx').on(table.tenantId, table.status),

    /*
     * Both hashes must be lowercase
     * hexadecimal SHA-256 digests.
     */
    check(
      'idempotency_records_key_hash_check',
      sql`
          ${table.idempotencyKeyHash}
          ~ '^[0-9a-f]{64}$'
        `,
    ),

    check(
      'idempotency_records_request_hash_check',
      sql`
          ${table.requestHash}
          ~ '^[0-9a-f]{64}$'
        `,
    ),

    /*
     * Keep operation names aligned with
     * TrackRoster's domain.verb convention.
     */
    check(
      'idempotency_records_operation_check',
      sql`
          ${table.operation}
          ~ '^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$'
        `,
    ),

    check(
      'idempotency_records_expiry_check',
      sql`
          ${table.expiresAt}
          > ${table.createdAt}
        `,
    ),

    /*
     * processing:
     *   no response/finalization yet
     *
     * completed:
     *   replayable HTTP response exists
     *
     * uncertain:
     *   execution outcome cannot safely be
     *   replayed or executed again.
     */
    check(
      'idempotency_records_state_check',
      sql`
          (
            ${table.status} = 'processing'
            AND ${table.responseStatus} IS NULL
            AND ${table.responseBody} IS NULL
            AND ${table.finalizedAt} IS NULL
          )
          OR
          (
            ${table.status} = 'completed'
            AND ${table.responseStatus}
              BETWEEN 100 AND 599
            AND ${table.finalizedAt} IS NOT NULL
          )
          OR
          (
            ${table.status} = 'uncertain'
            AND ${table.responseStatus} IS NULL
            AND ${table.responseBody} IS NULL
            AND ${table.finalizedAt} IS NOT NULL
          )
        `,
    ),
  ],
);

export type IdempotencyRecord = typeof idempotencyRecords.$inferSelect;

export type NewIdempotencyRecord = typeof idempotencyRecords.$inferInsert;

export type IdempotencyRecordStatus = (typeof idempotencyRecordStatusEnum.enumValues)[number];
