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

export interface CompleteIdempotencyRecordInput {
  id: string;

  responseStatus: number;

  responseBody: unknown;

  finalizedAt: Date;
}

export interface MarkIdempotencyRecordUncertainInput {
  id: string;

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
   * The status predicate prevents a second
   * request from overwriting a finalized
   * response.
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
   * TR-026 does not need a cleanup worker yet,
   * but keeping this repository primitive here
   * avoids raw SQL elsewhere later.
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

  async deleteProcessing(id: string, executor: DatabaseExecutor = this.database): Promise<boolean> {
    const deleted = await executor
      .delete(idempotencyRecords)
      .where(
        and(
          eq(idempotencyRecords.id, id),

          eq(idempotencyRecords.status, 'processing'),
        ),
      )
      .returning({
        id: idempotencyRecords.id,
      });

    return deleted.length > 0;
  }
}
