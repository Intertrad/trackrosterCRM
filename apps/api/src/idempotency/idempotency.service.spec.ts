import { HttpException } from '@nestjs/common';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { IdempotencyRecordRepository } from './idempotency-record.repository.js';

import { IdempotencyService } from './idempotency.service.js';

import type { BeginIdempotencyInput, IdempotencyRequestIdentity } from './idempotency.types.js';

describe('IdempotencyService', () => {
  const NOW = new Date('2026-09-11T20:00:00.000Z');

  const tenantId = '11111111-1111-4111-8111-111111111111';

  const userId = '22222222-2222-4222-8222-222222222222';

  const recordId = '33333333-3333-4333-8333-333333333333';

  const replacementRecordId = '44444444-4444-4444-8444-444444444444';

  const operation = 'activity.record';

  const idempotencyKey = 'test-idempotency-key-001';

  let repository: {
    tryClaim: ReturnType<typeof vi.fn>;

    findByBoundary: ReturnType<typeof vi.fn>;

    markCompleted: ReturnType<typeof vi.fn>;

    markUncertain: ReturnType<typeof vi.fn>;

    deleteExpiredBoundary: ReturnType<typeof vi.fn>;

    deleteExpired: ReturnType<typeof vi.fn>;

    deleteProcessing: ReturnType<typeof vi.fn>;
  };

  let service: IdempotencyService;

  beforeEach(() => {
    vi.useFakeTimers();

    vi.setSystemTime(NOW);

    repository = {
      tryClaim: vi.fn(),

      findByBoundary: vi.fn(),

      markCompleted: vi.fn(),

      markUncertain: vi.fn(),

      deleteExpiredBoundary: vi.fn(),

      deleteExpired: vi.fn(),

      deleteProcessing: vi.fn(),
    };

    service = new IdempotencyService(repository as unknown as IdempotencyRecordRepository);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function createRequest(
    body: unknown = {
      type: 'call',
    },
  ): IdempotencyRequestIdentity {
    return {
      method: 'POST',

      params: {
        campaignId: '55555555-5555-4555-8555-555555555555',

        prospectId: '66666666-6666-4666-8666-666666666666',
      },

      query: {},

      body,
    };
  }

  function createInput(overrides: Partial<BeginIdempotencyInput> = {}): BeginIdempotencyInput {
    return {
      tenantId,

      userId,

      operation,

      idempotencyKey,

      request: createRequest(),

      ...overrides,
    };
  }

  function futureExpiry(): Date {
    return new Date(NOW.getTime() + 60_000);
  }

  function expiredAt(): Date {
    return new Date(NOW.getTime() - 60_000);
  }

  function createRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      id: recordId,

      tenantId,

      userId,

      operation,

      idempotencyKeyHash: 'stored-key-hash',

      requestHash: currentRequestHash(),

      status: 'processing',

      responseStatus: null,

      responseBody: null,

      expiresAt: futureExpiry(),

      finalizedAt: null,

      createdAt: NOW,

      updatedAt: NOW,

      ...overrides,
    };
  }

  function currentRequestHash(): string {
    const calls = repository.tryClaim.mock.calls;

    const latest = calls[calls.length - 1]?.[0] as
      | {
          requestHash?: unknown;
        }
      | undefined;

    if (typeof latest?.requestHash !== 'string') {
      throw new Error('Expected tryClaim requestHash');
    }

    return latest.requestHash;
  }

  async function captureHttpException(promise: Promise<unknown>): Promise<HttpException> {
    try {
      await promise;
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(HttpException);

      return error as HttpException;
    }

    throw new Error('Expected request to throw HttpException');
  }

  function expectErrorCode(
    exception: HttpException,
    expectedStatus: number,
    expectedCode: string,
  ): void {
    expect(exception.getStatus()).toBe(expectedStatus);

    expect(exception.getResponse()).toMatchObject({
      code: expectedCode,
    });
  }

  it('returns execute when the caller successfully claims a new key', async () => {
    repository.tryClaim.mockResolvedValue({
      id: recordId,
    });

    const result = await service.begin(createInput());

    expect(result).toEqual({
      kind: 'execute',

      recordId,
    });

    expect(repository.tryClaim).toHaveBeenCalledTimes(1);

    expect(repository.findByBoundary).not.toHaveBeenCalled();
  });

  it('includes tenant user operation and hashed key in the claim boundary', async () => {
    repository.tryClaim.mockResolvedValue({
      id: recordId,
    });

    await service.begin(createInput());

    expect(repository.tryClaim).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,

        userId,

        operation,

        idempotencyKeyHash: expect.stringMatching(/^[a-f0-9]{64}$/),

        requestHash: expect.stringMatching(/^[a-f0-9]{64}$/),

        expiresAt: expect.any(Date),
      }),
    );

    const claimInput = repository.tryClaim.mock.calls[0]?.[0] as {
      idempotencyKeyHash: string;
    };

    expect(claimInput.idempotencyKeyHash).not.toBe(idempotencyKey);
  });

  it('generates the same request hash when object key order differs', async () => {
    repository.tryClaim.mockResolvedValue({
      id: recordId,
    });

    await service.begin(
      createInput({
        request: createRequest({
          alpha: 'one',

          beta: 2,

          nested: {
            first: true,

            second: false,
          },
        }),
      }),
    );

    await service.begin(
      createInput({
        request: createRequest({
          nested: {
            second: false,

            first: true,
          },

          beta: 2,

          alpha: 'one',
        }),
      }),
    );

    const first = repository.tryClaim.mock.calls[0]?.[0] as {
      requestHash: string;
    };

    const second = repository.tryClaim.mock.calls[1]?.[0] as {
      requestHash: string;
    };

    expect(first.requestHash).toBe(second.requestHash);
  });

  it('normalizes the HTTP method before fingerprinting', async () => {
    repository.tryClaim.mockResolvedValue({
      id: recordId,
    });

    await service.begin(
      createInput({
        request: {
          ...createRequest(),

          method: 'post',
        },
      }),
    );

    await service.begin(
      createInput({
        request: {
          ...createRequest(),

          method: 'POST',
        },
      }),
    );

    const first = repository.tryClaim.mock.calls[0]?.[0] as {
      requestHash: string;
    };

    const second = repository.tryClaim.mock.calls[1]?.[0] as {
      requestHash: string;
    };

    expect(first.requestHash).toBe(second.requestHash);
  });

  it('rejects a missing Idempotency-Key', async () => {
    const error = await captureHttpException(
      service.begin(
        createInput({
          idempotencyKey: undefined,
        }),
      ),
    );

    expectErrorCode(error, 400, 'IDEMPOTENCY_KEY_REQUIRED');

    expect(repository.tryClaim).not.toHaveBeenCalled();
  });

  it('rejects an invalid Idempotency-Key', async () => {
    const error = await captureHttpException(
      service.begin(
        createInput({
          idempotencyKey: 'invalid key with spaces',
        }),
      ),
    );

    expectErrorCode(error, 400, 'INVALID_IDEMPOTENCY_KEY');

    expect(repository.tryClaim).not.toHaveBeenCalled();
  });

  it('rejects duplicate header values represented as an array', async () => {
    const error = await captureHttpException(
      service.begin(
        createInput({
          idempotencyKey: ['key-one', 'key-two'],
        }),
      ),
    );

    expectErrorCode(error, 400, 'INVALID_IDEMPOTENCY_KEY');
  });

  it('rejects request values that cannot be fingerprinted safely', async () => {
    const error = await captureHttpException(
      service.begin(
        createInput({
          request: createRequest({
            invalid: new Map([['secret', 'value']]),
          }),
        }),
      ),
    );

    expectErrorCode(error, 400, 'INVALID_IDEMPOTENCY_REQUEST');

    expect(repository.tryClaim).not.toHaveBeenCalled();
  });

  it('replays a completed request with the original status and body', async () => {
    repository.tryClaim.mockResolvedValue(null);

    repository.findByBoundary.mockImplementation(async () =>
      createRecord({
        status: 'completed',

        responseStatus: 201,

        responseBody: {
          id: 'activity-123',
        },
      }),
    );

    const result = await service.begin(createInput());

    expect(result).toEqual({
      kind: 'replay',

      responseStatus: 201,

      responseBody: {
        id: 'activity-123',
      },
    });
  });

  it('rejects reuse of the same key for a different request', async () => {
    repository.tryClaim.mockResolvedValue(null);

    repository.findByBoundary.mockImplementation(async () =>
      createRecord({
        requestHash: 'different-request-hash',
      }),
    );

    const error = await captureHttpException(service.begin(createInput()));

    expectErrorCode(error, 409, 'IDEMPOTENCY_KEY_REUSED');
  });

  it('rejects a live processing request as already in progress', async () => {
    repository.tryClaim.mockResolvedValue(null);

    repository.findByBoundary.mockImplementation(async () =>
      createRecord({
        status: 'processing',

        expiresAt: futureExpiry(),
      }),
    );

    const error = await captureHttpException(service.begin(createInput()));

    expectErrorCode(error, 409, 'IDEMPOTENCY_REQUEST_IN_PROGRESS');

    expect(repository.markUncertain).not.toHaveBeenCalled();

    expect(repository.deleteExpiredBoundary).not.toHaveBeenCalled();
  });

  it('marks an expired processing request uncertain and never reclaims it', async () => {
    repository.tryClaim.mockResolvedValue(null);

    repository.findByBoundary.mockImplementation(async () =>
      createRecord({
        status: 'processing',

        expiresAt: expiredAt(),
      }),
    );

    repository.markUncertain.mockResolvedValue({
      id: recordId,

      status: 'uncertain',
    });

    const error = await captureHttpException(service.begin(createInput()));

    expectErrorCode(error, 409, 'IDEMPOTENCY_STATE_UNCERTAIN');

    expect(repository.markUncertain).toHaveBeenCalledWith({
      id: recordId,

      finalizedAt: NOW,
    });

    expect(repository.deleteExpiredBoundary).not.toHaveBeenCalled();

    expect(repository.tryClaim).toHaveBeenCalledTimes(1);
  });

  it('keeps a live uncertain request fail-closed', async () => {
    repository.tryClaim.mockResolvedValue(null);

    repository.findByBoundary.mockImplementation(async () =>
      createRecord({
        status: 'uncertain',

        expiresAt: futureExpiry(),
      }),
    );

    const error = await captureHttpException(service.begin(createInput()));

    expectErrorCode(error, 409, 'IDEMPOTENCY_STATE_UNCERTAIN');

    expect(repository.deleteExpiredBoundary).not.toHaveBeenCalled();
  });

  it('keeps an expired uncertain request fail-closed', async () => {
    repository.tryClaim.mockResolvedValue(null);

    repository.findByBoundary.mockImplementation(async () =>
      createRecord({
        status: 'uncertain',

        expiresAt: expiredAt(),
      }),
    );

    const error = await captureHttpException(service.begin(createInput()));

    expectErrorCode(error, 409, 'IDEMPOTENCY_STATE_UNCERTAIN');

    expect(repository.deleteExpiredBoundary).not.toHaveBeenCalled();

    expect(repository.markUncertain).not.toHaveBeenCalled();

    expect(repository.tryClaim).toHaveBeenCalledTimes(1);
  });

  it('reclaims an expired completed request and allows a new execution', async () => {
    repository.tryClaim.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: replacementRecordId,
    });

    repository.findByBoundary.mockImplementation(async () =>
      createRecord({
        status: 'completed',

        responseStatus: 201,

        responseBody: {
          old: true,
        },

        expiresAt: expiredAt(),
      }),
    );

    repository.deleteExpiredBoundary.mockResolvedValue(true);

    const result = await service.begin(createInput());

    expect(repository.deleteExpiredBoundary).toHaveBeenCalledTimes(1);

    expect(repository.deleteExpiredBoundary).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,

        userId,

        operation,

        idempotencyKeyHash: expect.any(String),
      }),

      NOW,
    );

    expect(repository.tryClaim).toHaveBeenCalledTimes(2);

    expect(result).toEqual({
      kind: 'execute',

      recordId: replacementRecordId,
    });
  });

  it('fails safely when a completed record has no stored response status', async () => {
    repository.tryClaim.mockResolvedValue(null);

    repository.findByBoundary.mockImplementation(async () =>
      createRecord({
        status: 'completed',

        responseStatus: null,

        responseBody: {
          id: 'unexpected',
        },
      }),
    );

    const error = await captureHttpException(service.begin(createInput()));

    expectErrorCode(error, 503, 'IDEMPOTENCY_PERSISTENCE_FAILED');
  });

  it('fails with state unavailable when the claim race cannot be resolved', async () => {
    repository.tryClaim.mockResolvedValue(null);

    repository.findByBoundary.mockResolvedValue(null);

    const error = await captureHttpException(service.begin(createInput()));

    expectErrorCode(error, 503, 'IDEMPOTENCY_STATE_UNAVAILABLE');

    expect(repository.tryClaim).toHaveBeenCalledTimes(3);

    expect(repository.findByBoundary).toHaveBeenCalledTimes(3);
  });

  it('persists the exact successful response status and body', async () => {
    repository.markCompleted.mockResolvedValue({
      id: recordId,

      status: 'completed',
    });

    const body = {
      id: 'activity-123',

      type: 'call',
    };

    await service.complete(recordId, 201, body);

    expect(repository.markCompleted).toHaveBeenCalledWith({
      id: recordId,

      responseStatus: 201,

      responseBody: body,

      finalizedAt: NOW,
    });
  });

  it('normalizes an undefined successful response body to null', async () => {
    repository.markCompleted.mockResolvedValue({
      id: recordId,

      status: 'completed',
    });

    await service.complete(recordId, 200, undefined);

    expect(repository.markCompleted).toHaveBeenCalledWith({
      id: recordId,

      responseStatus: 200,

      responseBody: null,

      finalizedAt: NOW,
    });
  });

  it.each([99, 600, 200.5])('rejects invalid stored response status %s', async (responseStatus) => {
    const error = await captureHttpException(service.complete(recordId, responseStatus, {}));

    expectErrorCode(error, 503, 'IDEMPOTENCY_PERSISTENCE_FAILED');

    expect(repository.markCompleted).not.toHaveBeenCalled();
  });

  it('fails safely when completing the processing record does not persist', async () => {
    repository.markCompleted.mockResolvedValue(null);

    const error = await captureHttpException(
      service.complete(recordId, 201, {
        id: 'activity-123',
      }),
    );

    expectErrorCode(error, 503, 'IDEMPOTENCY_PERSISTENCE_FAILED');
  });

  it('releases a processing record after a deterministic rejected request', async () => {
    repository.deleteProcessing.mockResolvedValue(true);

    await expect(service.release(recordId)).resolves.toBeUndefined();

    expect(repository.deleteProcessing).toHaveBeenCalledWith(recordId);
  });

  it('fails safely when a processing record cannot be released', async () => {
    repository.deleteProcessing.mockResolvedValue(false);

    const error = await captureHttpException(service.release(recordId));

    expectErrorCode(error, 503, 'IDEMPOTENCY_PERSISTENCE_FAILED');
  });

  it('marks an execution uncertain after an unknown outcome', async () => {
    repository.markUncertain.mockResolvedValue({
      id: recordId,

      status: 'uncertain',
    });

    await expect(service.markUncertain(recordId)).resolves.toBeUndefined();

    expect(repository.markUncertain).toHaveBeenCalledWith({
      id: recordId,

      finalizedAt: NOW,
    });
  });

  it('fails safely when uncertain state cannot be persisted', async () => {
    repository.markUncertain.mockResolvedValue(null);

    const error = await captureHttpException(service.markUncertain(recordId));

    expectErrorCode(error, 503, 'IDEMPOTENCY_PERSISTENCE_FAILED');
  });

  it('rejects invalid server-owned operation metadata', async () => {
    await expect(
      service.begin(
        createInput({
          operation: 'INVALID OPERATION',
        }),
      ),
    ).rejects.toThrow('Invalid idempotency operation metadata');

    expect(repository.tryClaim).not.toHaveBeenCalled();
  });
});
