import { createHash } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

import {
  IDEMPOTENCY_KEY_PATTERN,
  IDEMPOTENCY_OPERATION_PATTERN,
  IDEMPOTENCY_RETENTION_MS,
} from './idempotency.constants.js';

import {
  IdempotencyRecordRepository,
  type IdempotencyBoundary,
} from './idempotency-record.repository.js';

import type {
  BeginIdempotencyInput,
  CompleteIdempotencyInput,
  IdempotencyDecision,
  IdempotencyLifecycleIdentity,
  IdempotencyRequestIdentity,
} from './idempotency.types.js';

@Injectable()
export class IdempotencyService {
  constructor(private readonly repository: IdempotencyRecordRepository) {}

  async begin(input: BeginIdempotencyInput): Promise<IdempotencyDecision> {
    this.assertOperation(input.operation);

    const key = this.requireKey(input.idempotencyKey);

    const idempotencyKeyHash = this.sha256(key);

    const requestHash = this.sha256(this.stableSerialize(this.buildRequestIdentity(input.request)));

    const boundary: IdempotencyBoundary = {
      tenantId: input.tenantId,

      userId: input.userId,

      operation: input.operation,

      idempotencyKeyHash,
    };

    /*
     * A small bounded loop handles races involving
     * completed-record reclamation.
     *
     * PostgreSQL uniqueness remains the actual
     * concurrency authority.
     */
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const now = new Date();

      const expiresAt = new Date(now.getTime() + IDEMPOTENCY_RETENTION_MS);

      const claimed = await this.repository.tryClaim({
        ...boundary,

        requestHash,

        expiresAt,
      });

      if (claimed) {
        return {
          kind: 'execute',

          recordId: claimed.id,
        };
      }

      const existing = await this.repository.findByBoundary(boundary);

      if (!existing) {
        /*
         * Another transaction may have changed
         * the boundary around the uniqueness race.
         *
         * Retry the bounded acquisition loop.
         */
        continue;
      }

      /*
       * Only COMPLETED records may be reclaimed
       * after the retention window expires.
       *
       * A completed request has a known durable
       * outcome, so reusing the key after expiry
       * is safe.
       */
      if (existing.status === 'completed' && existing.expiresAt.getTime() <= now.getTime()) {
        await this.repository.deleteExpiredBoundary(boundary, now);

        continue;
      }

      /*
       * Any record that remains at this point is
       * still authoritative.
       *
       * Reusing the same key for a different
       * request is always rejected.
       */
      if (existing.requestHash !== requestHash) {
        throw new ConflictException({
          code: 'IDEMPOTENCY_KEY_REUSED',

          message: 'Idempotency-Key has already been used for a different request',

          error: 'Conflict',
        });
      }

      switch (existing.status) {
        case 'processing': {
          /*
           * An expired processing record must NEVER
           * be reclaimed automatically.
           *
           * The business operation may already have
           * committed while the idempotency response
           * finalization failed.
           *
           * Re-executing could duplicate the mutation.
           */
          if (existing.expiresAt.getTime() <= now.getTime()) {
            await this.repository.markUncertain({
              id: existing.id,

              tenantId: boundary.tenantId,

              userId: boundary.userId,

              finalizedAt: now,
            });

            throw new ConflictException({
              code: 'IDEMPOTENCY_STATE_UNCERTAIN',

              message:
                'The previous request outcome is uncertain and cannot be retried with this Idempotency-Key',

              error: 'Conflict',
            });
          }

          throw new ConflictException({
            code: 'IDEMPOTENCY_REQUEST_IN_PROGRESS',

            message: 'A request with this Idempotency-Key is already being processed',

            error: 'Conflict',
          });
        }

        case 'uncertain': {
          /*
           * Uncertain state is deliberately sticky.
           *
           * Expiration must not make this request
           * executable again automatically.
           */
          throw new ConflictException({
            code: 'IDEMPOTENCY_STATE_UNCERTAIN',

            message:
              'The previous request outcome is uncertain and cannot be retried with this Idempotency-Key',

            error: 'Conflict',
          });
        }

        case 'completed': {
          if (existing.responseStatus === null) {
            throw this.persistenceFailure();
          }

          return {
            kind: 'replay',

            responseStatus: existing.responseStatus,

            responseBody: existing.responseBody,
          };
        }
      }
    }

    throw new ServiceUnavailableException({
      code: 'IDEMPOTENCY_STATE_UNAVAILABLE',

      message: 'Idempotency state could not be resolved',

      error: 'Service Unavailable',
    });
  }

  /*
   * Finalizes only the processing record owned by
   * the authenticated tenant/user.
   */
  async complete(input: CompleteIdempotencyInput): Promise<void> {
    if (
      !Number.isInteger(input.responseStatus) ||
      input.responseStatus < 100 ||
      input.responseStatus > 599
    ) {
      throw this.persistenceFailure();
    }

    const completed = await this.repository.markCompleted({
      id: input.recordId,

      tenantId: input.tenantId,

      userId: input.userId,

      responseStatus: input.responseStatus,

      responseBody: input.responseBody ?? null,

      finalizedAt: new Date(),
    });

    if (!completed) {
      throw this.persistenceFailure();
    }
  }

  /*
   * Known 4xx failures are not successful
   * executions.
   *
   * Releasing the processing record allows the
   * client to correct the request and retry.
   *
   * Ownership remains part of the deletion
   * predicate.
   */
  async release(input: IdempotencyLifecycleIdentity): Promise<void> {
    const deleted = await this.repository.deleteProcessing({
      id: input.recordId,

      tenantId: input.tenantId,

      userId: input.userId,
    });

    if (!deleted) {
      throw this.persistenceFailure();
    }
  }

  /*
   * Unknown failures and 5xx outcomes fail closed.
   *
   * The key remains occupied as "uncertain" so
   * the same operation cannot silently execute
   * twice.
   *
   * The transition is constrained to the
   * authenticated tenant/user that owns the
   * processing record.
   */
  async markUncertain(input: IdempotencyLifecycleIdentity): Promise<void> {
    const uncertain = await this.repository.markUncertain({
      id: input.recordId,

      tenantId: input.tenantId,

      userId: input.userId,

      finalizedAt: new Date(),
    });

    if (!uncertain) {
      throw this.persistenceFailure();
    }
  }

  private requireKey(value: unknown): string {
    if (value === undefined || value === null || value === '') {
      throw new BadRequestException({
        code: 'IDEMPOTENCY_KEY_REQUIRED',

        message: 'Idempotency-Key header is required',

        error: 'Bad Request',
      });
    }

    if (typeof value !== 'string' || !IDEMPOTENCY_KEY_PATTERN.test(value)) {
      throw new BadRequestException({
        code: 'INVALID_IDEMPOTENCY_KEY',

        message:
          'Idempotency-Key must contain 1 to 128 letters, numbers, dots, underscores, colons, or hyphens',

        error: 'Bad Request',
      });
    }

    return value;
  }

  private assertOperation(operation: string): void {
    if (!IDEMPOTENCY_OPERATION_PATTERN.test(operation)) {
      /*
       * This is application configuration,
       * not client input.
       */
      throw new Error(`Invalid idempotency operation metadata: ${operation}`);
    }
  }

  private buildRequestIdentity(request: IdempotencyRequestIdentity): IdempotencyRequestIdentity {
    return {
      method: request.method.toUpperCase(),

      params: request.params ?? {},

      query: request.query ?? {},

      body: request.body ?? null,
    };
  }

  private sha256(value: string): string {
    return createHash('sha256').update(value, 'utf8').digest('hex');
  }

  /*
   * Deterministic JSON-compatible serialization.
   *
   * Object key ordering therefore cannot change
   * the request fingerprint.
   */
  private stableSerialize(value: unknown): string {
    if (value === null) {
      return 'null';
    }

    if (typeof value === 'string') {
      return JSON.stringify(value);
    }

    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }

    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        throw this.invalidFingerprintRequest();
      }

      return JSON.stringify(value);
    }

    /*
     * Match JSON semantics.
     *
     * Undefined object properties are filtered
     * below. Undefined array values serialize
     * equivalently to null.
     */
    if (typeof value === 'undefined') {
      return 'null';
    }

    if (typeof value === 'bigint' || typeof value === 'symbol' || typeof value === 'function') {
      throw this.invalidFingerprintRequest();
    }

    if (value instanceof Date) {
      return JSON.stringify(value.toISOString());
    }

    /*
     * These values are not valid request JSON and
     * must never silently enter an idempotency
     * fingerprint.
     */
    if (
      Buffer.isBuffer(value) ||
      value instanceof Map ||
      value instanceof Set ||
      value instanceof RegExp
    ) {
      throw this.invalidFingerprintRequest();
    }

    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableSerialize(item)).join(',')}]`;
    }

    if (typeof value === 'object') {
      /*
       * Do NOT require Object.prototype here.
       *
       * Fastify may provide params/query objects
       * whose prototype differs from an ordinary
       * object. Idempotency cares about their own
       * enumerable JSON data, not their prototype.
       */
      const object = value as Record<string, unknown>;

      const entries = Object.keys(object)
        .filter((key) => object[key] !== undefined)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${this.stableSerialize(object[key])}`);

      return `{${entries.join(',')}}`;
    }

    throw this.invalidFingerprintRequest();
  }

  private invalidFingerprintRequest(): BadRequestException {
    return new BadRequestException({
      code: 'INVALID_IDEMPOTENCY_REQUEST',

      message: 'Request contains a value that cannot be fingerprinted',

      error: 'Bad Request',
    });
  }

  private persistenceFailure(): ServiceUnavailableException {
    return new ServiceUnavailableException({
      code: 'IDEMPOTENCY_PERSISTENCE_FAILED',

      message: 'Idempotency state could not be persisted safely',

      error: 'Service Unavailable',
    });
  }
}
