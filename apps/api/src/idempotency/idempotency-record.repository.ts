import { and, eq, lte } from 'drizzle-orm';
import { Inject, Injectable } from '@nestjs/common';

import { DATABASE } from '../database/database.constants.js';

import type { Database, DatabaseExecutor } from '../database/database.types.js';

import {
  idempotencyRecords,
  type IdempotencyRecord,
} from '../database/schema/idempotency-records.js';

export interface IdempotencyBoundary {
  tenantId: string;

  userId: string;

  operation: string;

  idempotencyKeyHash: string;
}

export interface ClaimIdempotencyRecordInput extends IdempotencyBoundary {
  requestHash: string;

  expiresAt: Date;
}

/*
 * Lifecycle mutations must prove ownership of the
 * idempotency record rather than relying only on
 * its opaque primary key.
 *
 * This prevents an incorrect internal record ID
 * from mutating another tenant/user boundary.
 */
export interface IdempotencyRecordOwnership {
  id: string;

  tenantId: string;

  userId: string;
}

export interface CompleteIdempotencyRecordInput extends IdempotencyRecordOwnership {
  responseStatus: number;

  responseBody: unknown;

  finalizedAt: Date;
}

export interface MarkIdempotencyRecordUncertainInput extends IdempotencyRecordOwnership {
  finalizedAt: Date;
}

@Injectable()
export class IdempotencyRecordRepository {
  constructor(
    @Inject(DATABASE)
    private readonly database: Database,
  ) {}

  /*
   * Attempts to acquire ownership of an
   * idempotency boundary.
   *
   * PostgreSQL's unique constraint is the
   * concurrency authority here.
   *
   * Exactly one concurrent caller can receive
   * a newly-created record.
   */
  async tryClaim(
    input: ClaimIdempotencyRecordInput,
    executor: DatabaseExecutor = this.database,
  ): Promise<IdempotencyRecord | null> {
    const [record] = await executor
      .insert(idempotencyRecords)
      .values({
        tenantId: input.tenantId,

        userId: input.userId,

        operation: input.operation,

        idempotencyKeyHash: input.idempotencyKeyHash,

        requestHash: input.requestHash,

        status: 'processing',

        expiresAt: input.expiresAt,
      })
      .onConflictDoNothing({
        target: [
          idempotencyRecords.tenantId,

          idempotencyRecords.userId,

          idempotencyRecords.operation,

          idempotencyRecords.idempotencyKeyHash,
        ],
      })
      .returning();

    return record ?? null;
  }

  /*
   * Reads only one exact idempotency boundary.
   *
   * Tenant and authenticated user are always
   * part of the predicate.
   */
  async findByBoundary(
    boundary: IdempotencyBoundary,
    executor: DatabaseExecutor = this.database,
  ): Promise<IdempotencyRecord | null> {
    const [record] = await executor
      .select()
      .from(idempotencyRecords)
      .where(
        and(
          eq(idempotencyRecords.tenantId, boundary.tenantId),

          eq(idempotencyRecords.userId, boundary.userId),

          eq(idempotencyRecords.operation, boundary.operation),

          eq(idempotencyRecords.idempotencyKeyHash, boundary.idempotencyKeyHash),
        ),
      )
      .limit(1);

    return record ?? null;
  }

  /*
   * Transitions processing -> completed.
   *
   * The transition is bound to:
   *
   * - exact record
   * - exact tenant
   * - exact authenticated user
   * - processing state
   *
   * The ownership predicates ensure that an
   * internal record ID alone is never sufficient
   * to finalize another tenant/user request.
   */
  async markCompleted(
    input: CompleteIdempotencyRecordInput,
    executor: DatabaseExecutor = this.database,
  ): Promise<IdempotencyRecord | null> {
    const [record] = await executor
      .update(idempotencyRecords)
      .set({
        status: 'completed',

        responseStatus: input.responseStatus,

        responseBody: input.responseBody,

        finalizedAt: input.finalizedAt,

        updatedAt: input.finalizedAt,
      })
      .where(
        and(
          eq(idempotencyRecords.id, input.id),

          eq(idempotencyRecords.tenantId, input.tenantId),

          eq(idempotencyRecords.userId, input.userId),

          eq(idempotencyRecords.status, 'processing'),
        ),
      )
      .returning();

    return record ?? null;
  }

  /*
   * Transitions processing -> uncertain.
   *
   * An uncertain record is deliberately
   * retained so a retry cannot silently
   * execute a potentially-successful write
   * for a second time.
   *
   * Tenant/user ownership remains part of the
   * transition predicate.
   */
  async markUncertain(
    input: MarkIdempotencyRecordUncertainInput,
    executor: DatabaseExecutor = this.database,
  ): Promise<IdempotencyRecord | null> {
    const [record] = await executor
      .update(idempotencyRecords)
      .set({
        status: 'uncertain',

        responseStatus: null,

        responseBody: null,

        finalizedAt: input.finalizedAt,

        updatedAt: input.finalizedAt,
      })
      .where(
        and(
          eq(idempotencyRecords.id, input.id),

          eq(idempotencyRecords.tenantId, input.tenantId),

          eq(idempotencyRecords.userId, input.userId),

          eq(idempotencyRecords.status, 'processing'),
        ),
      )
      .returning();

    return record ?? null;
  }

  /*
   * Expired records may be reclaimed after the
   * retention window.
   *
   * The expiry predicate makes deletion safe if
   * multiple requests race to reclaim the same
   * old boundary.
   *
   * After deletion, callers retry tryClaim().
   * PostgreSQL uniqueness still decides the
   * single winner.
   */
  async deleteExpiredBoundary(
    boundary: IdempotencyBoundary,
    now: Date,
    executor: DatabaseExecutor = this.database,
  ): Promise<boolean> {
    const deleted = await executor
      .delete(idempotencyRecords)
      .where(
        and(
          eq(idempotencyRecords.tenantId, boundary.tenantId),

          eq(idempotencyRecords.userId, boundary.userId),

          eq(idempotencyRecords.operation, boundary.operation),

          eq(idempotencyRecords.status, 'completed'),

          eq(idempotencyRecords.idempotencyKeyHash, boundary.idempotencyKeyHash),

          lte(idempotencyRecords.expiresAt, now),
        ),
      )
      .returning({
        id: idempotencyRecords.id,
      });

    return deleted.length > 0;
  }

  /*
   * Maintenance hook for eventual scheduled
   * cleanup.
   *
   * This is intentionally global rather than
   * request-owned. It only removes completed,
   * expired records and is intended for trusted
   * server-side maintenance.
   */
  async deleteExpired(now: Date, executor: DatabaseExecutor = this.database): Promise<number> {
    const deleted = await executor
      .delete(idempotencyRecords)
      .where(
        and(
          eq(idempotencyRecords.status, 'completed'),

          lte(idempotencyRecords.expiresAt, now),
        ),
      )
      .returning({
        id: idempotencyRecords.id,
      });

    return deleted.length;
  }

  /*
   * Releases only the exact processing record
   * owned by the authenticated tenant/user.
   *
   * This prevents an opaque record ID from being
   * sufficient to release another request's
   * idempotency boundary.
   */
  async deleteProcessing(
    ownership: IdempotencyRecordOwnership,
    executor: DatabaseExecutor = this.database,
  ): Promise<boolean> {
    const deleted = await executor
      .delete(idempotencyRecords)
      .where(
        and(
          eq(idempotencyRecords.id, ownership.id),

          eq(idempotencyRecords.tenantId, ownership.tenantId),

          eq(idempotencyRecords.userId, ownership.userId),

          eq(idempotencyRecords.status, 'processing'),
        ),
      )
      .returning({
        id: idempotencyRecords.id,
      });

    return deleted.length > 0;
  }
}
