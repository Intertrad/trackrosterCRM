import { createHash, randomUUID } from 'node:crypto';

import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module.js';
import { PasswordService } from '../src/auth/password.service.js';
import { DATABASE } from '../src/database/database.constants.js';
import { idempotencyRecords, tenants, users } from '../src/database/schema/index.js';
import type { Database } from '../src/database/database.types.js';
import {
  IdempotencyRecordRepository,
  type ClaimIdempotencyRecordInput,
  type IdempotencyBoundary,
} from '../src/idempotency/idempotency-record.repository.js';
import { TenantService } from '../src/tenants/tenant.service.js';
import { UserRepository } from '../src/users/user.repository.js';

describe('idempotency record repository integration', () => {
  let app: NestFastifyApplication | undefined;
  let database: Database | undefined;
  let repository: IdempotencyRecordRepository | undefined;

  let tenantAId = '';
  let tenantBId = '';
  let userAId = '';
  let userA2Id = '';
  let userBId = '';

  function getDatabase(): Database {
    if (!database) {
      throw new Error('Database has not been initialized');
    }

    return database;
  }

  function getRepository(): IdempotencyRecordRepository {
    if (!repository) {
      throw new Error('Idempotency repository has not been initialized');
    }

    return repository;
  }

  function sha256(value: string): string {
    return createHash('sha256').update(value, 'utf8').digest('hex');
  }

  function uniqueHash(label: string): string {
    return sha256(`${label}:${randomUUID()}`);
  }

  function futureExpiry(hours = 24): Date {
    return new Date(Date.now() + hours * 60 * 60 * 1000);
  }

  function shortExpiry(): Date {
    return new Date(Date.now() + 60_000);
  }

  function cleanupAfterShortExpiry(): Date {
    return new Date(Date.now() + 120_000);
  }

  function createClaimInput(
    overrides: Partial<ClaimIdempotencyRecordInput> = {},
  ): ClaimIdempotencyRecordInput {
    return {
      tenantId: tenantAId,
      userId: userAId,
      operation: 'activity.record',
      idempotencyKeyHash: uniqueHash('key'),
      requestHash: uniqueHash('request'),
      expiresAt: futureExpiry(),
      ...overrides,
    };
  }

  function boundaryFromClaim(input: ClaimIdempotencyRecordInput): IdempotencyBoundary {
    return {
      tenantId: input.tenantId,
      userId: input.userId,
      operation: input.operation,
      idempotencyKeyHash: input.idempotencyKeyHash,
    };
  }

  beforeAll(async () => {
    const application = await NestFactory.create<NestFastifyApplication>(
      AppModule,
      new FastifyAdapter(),
      {
        logger: false,
        abortOnError: false,
      },
    );

    await application.init();

    app = application;
    database = application.get<Database>(DATABASE);
    repository = application.get(IdempotencyRecordRepository);

    const tenantService = application.get(TenantService);
    const userRepository = application.get(UserRepository);
    const passwordService = application.get(PasswordService);

    const suffix = randomUUID().replaceAll('-', '').slice(0, 10);

    const tenantA = await tenantService.create({
      name: `Idempotency Tenant A ${suffix}`,
      slug: `idempotency-a-${suffix}`,
    });

    const tenantB = await tenantService.create({
      name: `Idempotency Tenant B ${suffix}`,
      slug: `idempotency-b-${suffix}`,
    });

    tenantAId = tenantA.id;
    tenantBId = tenantB.id;

    const passwordHash = await passwordService.hash('IdempotencyRepository123!');

    const userA = await userRepository.create({
      tenantId: tenantAId,
      email: `idempotency-a1-${suffix}@trackroster.test`,
      passwordHash,
      status: 'active',
    });

    const userA2 = await userRepository.create({
      tenantId: tenantAId,
      email: `idempotency-a2-${suffix}@trackroster.test`,
      passwordHash,
      status: 'active',
    });

    const userB = await userRepository.create({
      tenantId: tenantBId,
      email: `idempotency-b1-${suffix}@trackroster.test`,
      passwordHash,
      status: 'active',
    });

    userAId = userA.id;
    userA2Id = userA2.id;
    userBId = userB.id;
  });

  afterAll(async () => {
    try {
      if (database) {
        if (tenantAId) {
          await getDatabase()
            .delete(idempotencyRecords)
            .where(eq(idempotencyRecords.tenantId, tenantAId));

          await getDatabase().delete(users).where(eq(users.tenantId, tenantAId));
          await getDatabase().delete(tenants).where(eq(tenants.id, tenantAId));
        }

        if (tenantBId) {
          await getDatabase()
            .delete(idempotencyRecords)
            .where(eq(idempotencyRecords.tenantId, tenantBId));

          await getDatabase().delete(users).where(eq(users.tenantId, tenantBId));
          await getDatabase().delete(tenants).where(eq(tenants.id, tenantBId));
        }
      }
    } finally {
      if (app) {
        await app.close();
      }
    }
  });

  it('allows exactly one concurrent claim for the same idempotency boundary', async () => {
    const input = createClaimInput();

    const results = await Promise.all(
      Array.from({ length: 12 }, () => getRepository().tryClaim(input)),
    );

    const winners = results.filter((record) => record !== null);

    expect(winners).toHaveLength(1);
    expect(winners[0]).toMatchObject({
      tenantId: tenantAId,
      userId: userAId,
      operation: input.operation,
      idempotencyKeyHash: input.idempotencyKeyHash,
      requestHash: input.requestHash,
      status: 'processing',
    });

    const rows = await getDatabase()
      .select({
        id: idempotencyRecords.id,
      })
      .from(idempotencyRecords)
      .where(
        and(
          eq(idempotencyRecords.tenantId, input.tenantId),
          eq(idempotencyRecords.userId, input.userId),
          eq(idempotencyRecords.operation, input.operation),
          eq(idempotencyRecords.idempotencyKeyHash, input.idempotencyKeyHash),
        ),
      );

    expect(rows).toHaveLength(1);
  });

  it('isolates claims by tenant, user, and server-owned operation', async () => {
    const sharedKeyHash = uniqueHash('shared-key');
    const sharedRequestHash = uniqueHash('shared-request');

    const claims = await Promise.all([
      getRepository().tryClaim(
        createClaimInput({
          tenantId: tenantAId,
          userId: userAId,
          operation: 'activity.record',
          idempotencyKeyHash: sharedKeyHash,
          requestHash: sharedRequestHash,
        }),
      ),
      getRepository().tryClaim(
        createClaimInput({
          tenantId: tenantAId,
          userId: userA2Id,
          operation: 'activity.record',
          idempotencyKeyHash: sharedKeyHash,
          requestHash: sharedRequestHash,
        }),
      ),
      getRepository().tryClaim(
        createClaimInput({
          tenantId: tenantAId,
          userId: userAId,
          operation: 'follow_up.create',
          idempotencyKeyHash: sharedKeyHash,
          requestHash: sharedRequestHash,
        }),
      ),
      getRepository().tryClaim(
        createClaimInput({
          tenantId: tenantBId,
          userId: userBId,
          operation: 'activity.record',
          idempotencyKeyHash: sharedKeyHash,
          requestHash: sharedRequestHash,
        }),
      ),
    ]);

    expect(claims.every((record) => record !== null)).toBe(true);

    expect(
      claims.map((record) => record?.id).filter((id): id is string => Boolean(id)),
    ).toHaveLength(4);
  });

  it('transitions processing to completed exactly once and preserves the stored response', async () => {
    const claimed = await getRepository().tryClaim(createClaimInput());

    expect(claimed).not.toBeNull();

    const finalizedAt = new Date();

    const completed = await getRepository().markCompleted({
      id: claimed!.id,
      responseStatus: 201,
      responseBody: {
        id: 'activity-123',
        type: 'call',
      },
      finalizedAt,
    });

    expect(completed).toMatchObject({
      id: claimed!.id,
      status: 'completed',
      responseStatus: 201,
      responseBody: {
        id: 'activity-123',
        type: 'call',
      },
    });

    expect(completed?.finalizedAt).toEqual(finalizedAt);

    const secondCompletion = await getRepository().markCompleted({
      id: claimed!.id,
      responseStatus: 202,
      responseBody: {
        shouldNot: 'overwrite',
      },
      finalizedAt: new Date(finalizedAt.getTime() + 1_000),
    });

    expect(secondCompletion).toBeNull();

    const uncertainAfterCompletion = await getRepository().markUncertain({
      id: claimed!.id,
      finalizedAt: new Date(finalizedAt.getTime() + 2_000),
    });

    expect(uncertainAfterCompletion).toBeNull();
  });

  it('transitions processing to uncertain exactly once and keeps the record occupied', async () => {
    const input = createClaimInput();

    const claimed = await getRepository().tryClaim(input);

    expect(claimed).not.toBeNull();

    const finalizedAt = new Date();

    const uncertain = await getRepository().markUncertain({
      id: claimed!.id,
      finalizedAt,
    });

    expect(uncertain).toMatchObject({
      id: claimed!.id,
      status: 'uncertain',
      responseStatus: null,
      responseBody: null,
    });

    expect(uncertain?.finalizedAt).toEqual(finalizedAt);

    const secondTransition = await getRepository().markUncertain({
      id: claimed!.id,
      finalizedAt: new Date(finalizedAt.getTime() + 1_000),
    });

    expect(secondTransition).toBeNull();

    const released = await getRepository().deleteProcessing(claimed!.id);

    expect(released).toBe(false);

    const persisted = await getRepository().findByBoundary(boundaryFromClaim(input));

    expect(persisted?.status).toBe('uncertain');
  });

  it('deleteExpiredBoundary reclaims only expired completed records', async () => {
    const completedInput = createClaimInput({
      idempotencyKeyHash: uniqueHash('expired-completed'),
      expiresAt: shortExpiry(),
    });

    const processingInput = createClaimInput({
      idempotencyKeyHash: uniqueHash('expired-processing'),
      expiresAt: shortExpiry(),
    });

    const uncertainInput = createClaimInput({
      idempotencyKeyHash: uniqueHash('expired-uncertain'),
      expiresAt: shortExpiry(),
    });

    const completed = await getRepository().tryClaim(completedInput);
    const processing = await getRepository().tryClaim(processingInput);
    const uncertain = await getRepository().tryClaim(uncertainInput);

    expect(completed).not.toBeNull();
    expect(processing).not.toBeNull();
    expect(uncertain).not.toBeNull();

    await getRepository().markCompleted({
      id: completed!.id,
      responseStatus: 201,
      responseBody: {
        completed: true,
      },
      finalizedAt: new Date(),
    });

    await getRepository().markUncertain({
      id: uncertain!.id,
      finalizedAt: new Date(),
    });

    const cleanupAt = cleanupAfterShortExpiry();

    await expect(
      getRepository().deleteExpiredBoundary(boundaryFromClaim(completedInput), cleanupAt),
    ).resolves.toBe(true);

    await expect(
      getRepository().deleteExpiredBoundary(boundaryFromClaim(processingInput), cleanupAt),
    ).resolves.toBe(false);

    await expect(
      getRepository().deleteExpiredBoundary(boundaryFromClaim(uncertainInput), cleanupAt),
    ).resolves.toBe(false);

    expect(await getRepository().findByBoundary(boundaryFromClaim(completedInput))).toBeNull();

    expect((await getRepository().findByBoundary(boundaryFromClaim(processingInput)))?.status).toBe(
      'processing',
    );

    expect((await getRepository().findByBoundary(boundaryFromClaim(uncertainInput)))?.status).toBe(
      'uncertain',
    );
  });

  it('bulk expiration cleanup deletes completed records but retains processing and uncertain records', async () => {
    const completedInput = createClaimInput({
      idempotencyKeyHash: uniqueHash('bulk-completed'),
      expiresAt: shortExpiry(),
    });

    const processingInput = createClaimInput({
      idempotencyKeyHash: uniqueHash('bulk-processing'),
      expiresAt: shortExpiry(),
    });

    const uncertainInput = createClaimInput({
      idempotencyKeyHash: uniqueHash('bulk-uncertain'),
      expiresAt: shortExpiry(),
    });

    const completed = await getRepository().tryClaim(completedInput);
    const processing = await getRepository().tryClaim(processingInput);
    const uncertain = await getRepository().tryClaim(uncertainInput);

    expect(completed).not.toBeNull();
    expect(processing).not.toBeNull();
    expect(uncertain).not.toBeNull();

    await getRepository().markCompleted({
      id: completed!.id,
      responseStatus: 200,
      responseBody: {
        ok: true,
      },
      finalizedAt: new Date(),
    });

    await getRepository().markUncertain({
      id: uncertain!.id,
      finalizedAt: new Date(),
    });

    const deleted = await getRepository().deleteExpired(cleanupAfterShortExpiry());

    expect(deleted).toBeGreaterThanOrEqual(1);

    expect(await getRepository().findByBoundary(boundaryFromClaim(completedInput))).toBeNull();

    expect((await getRepository().findByBoundary(boundaryFromClaim(processingInput)))?.status).toBe(
      'processing',
    );

    expect((await getRepository().findByBoundary(boundaryFromClaim(uncertainInput)))?.status).toBe(
      'uncertain',
    );
  });

  it('deleteProcessing releases only records that are still processing', async () => {
    const input = createClaimInput();

    const claimed = await getRepository().tryClaim(input);

    expect(claimed).not.toBeNull();

    await expect(getRepository().deleteProcessing(claimed!.id)).resolves.toBe(true);

    await expect(getRepository().deleteProcessing(claimed!.id)).resolves.toBe(false);

    expect(await getRepository().findByBoundary(boundaryFromClaim(input))).toBeNull();
  });
});
