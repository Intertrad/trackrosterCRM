import {
  BadRequestException,
  InternalServerErrorException,
  UnauthorizedException,
  type CallHandler,
  type ExecutionContext,
} from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { firstValueFrom, of, throwError, type Observable } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  IDEMPOTENCY_OPERATION_METADATA,
  IDEMPOTENCY_OPTIONAL_METADATA,
  IDEMPOTENCY_REPLAY_HEADER,
} from './idempotency.constants.js';
import { IdempotencyInterceptor } from './idempotency.interceptor.js';
import { IdempotencyService } from './idempotency.service.js';

describe('IdempotencyInterceptor', () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';
  const userId = '22222222-2222-4222-8222-222222222222';
  const recordId = '33333333-3333-4333-8333-333333333333';
  const operation = 'activity.record';
  const idempotencyKey = 'interceptor-test-key-001';

  let reflector: {
    getAllAndOverride: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
  };

  let idempotencyService: {
    begin: ReturnType<typeof vi.fn>;
    complete: ReturnType<typeof vi.fn>;
    release: ReturnType<typeof vi.fn>;
    markUncertain: ReturnType<typeof vi.fn>;
  };

  let interceptor: IdempotencyInterceptor;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: vi.fn(),
      get: vi.fn(),
    };

    idempotencyService = {
      begin: vi.fn(),
      complete: vi.fn(),
      release: vi.fn(),
      markUncertain: vi.fn(),
    };

    interceptor = new IdempotencyInterceptor(
      reflector as unknown as Reflector,
      idempotencyService as unknown as IdempotencyService,
    );
  });

  it('accepts an omitted key only for explicitly optional legacy routes', async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) =>
      key === IDEMPOTENCY_OPERATION_METADATA
        ? operation
        : key === IDEMPOTENCY_OPTIONAL_METADATA
          ? true
          : undefined,
    );
    const next = { handle: vi.fn(() => of({ ok: true })) };
    expect(
      await firstValueFrom(await interceptor.intercept(createContext({ headers: {} }), next)),
    ).toEqual({ ok: true });
    expect(idempotencyService.begin).not.toHaveBeenCalled();
  });

  function createReply() {
    const reply = {
      status: vi.fn(),
      header: vi.fn(),
    };

    reply.status.mockReturnValue(reply);
    reply.header.mockReturnValue(reply);

    return reply;
  }

  function createContext(
    options: {
      method?: string;
      authenticated?: boolean;
      headers?: Record<string, string | string[] | undefined>;
      params?: unknown;
      query?: unknown;
      body?: unknown;
      reply?: ReturnType<typeof createReply>;
    } = {},
  ): ExecutionContext {
    const handler = vi.fn();
    const controller = class TestController {};
    const reply = options.reply ?? createReply();

    const request = {
      method: options.method ?? 'POST',
      headers: options.headers ?? {
        'idempotency-key': idempotencyKey,
      },
      params: options.params ?? {
        campaignId: '44444444-4444-4444-8444-444444444444',
      },
      query: options.query ?? {},
      body: options.body ?? {
        type: 'call',
      },
      ...(options.authenticated === false
        ? {}
        : {
            auth: {
              tenantId,
              userId,
            },
          }),
    };

    return {
      switchToHttp: vi.fn(() => ({
        getRequest: vi.fn(() => request),
        getResponse: vi.fn(() => reply),
        getNext: vi.fn(),
      })),
      getHandler: vi.fn(() => handler),
      getClass: vi.fn(() => controller),
      getArgs: vi.fn(),
      getArgByIndex: vi.fn(),
      switchToRpc: vi.fn(),
      switchToWs: vi.fn(),
      getType: vi.fn(() => 'http'),
    } as unknown as ExecutionContext;
  }

  function createNext(observable: Observable<unknown> = of({ id: 'result-1' })): CallHandler {
    return {
      handle: vi.fn(() => observable),
    };
  }

  it('passes through routes without idempotency metadata', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    const context = createContext();
    const next = createNext(of({ ok: true }));

    const observable = await interceptor.intercept(context, next);

    await expect(firstValueFrom(observable)).resolves.toEqual({ ok: true });

    expect(next.handle).toHaveBeenCalledTimes(1);
    expect(idempotencyService.begin).not.toHaveBeenCalled();
  });

  it('rejects a protected route without authentication', async () => {
    reflector.getAllAndOverride.mockReturnValue(operation);

    const context = createContext({ authenticated: false });
    const next = createNext();

    await expect(interceptor.intercept(context, next)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(idempotencyService.begin).not.toHaveBeenCalled();
    expect(next.handle).not.toHaveBeenCalled();
  });

  it('passes the authenticated request boundary to the idempotency service', async () => {
    reflector.getAllAndOverride.mockReturnValue(operation);
    reflector.get.mockReturnValue(undefined);

    idempotencyService.begin.mockResolvedValue({
      kind: 'execute',
      recordId,
    });
    idempotencyService.complete.mockResolvedValue(undefined);

    const context = createContext({
      method: 'PATCH',
      params: {
        followUpId: '55555555-5555-4555-8555-555555555555',
      },
      query: {
        source: 'queue',
      },
      body: {
        dueAt: '2026-09-12T10:00:00.000Z',
      },
    });

    const observable = await interceptor.intercept(context, createNext());
    await firstValueFrom(observable);

    expect(idempotencyService.begin).toHaveBeenCalledWith({
      tenantId,
      userId,
      operation,
      idempotencyKey,
      request: {
        method: 'PATCH',
        params: {
          followUpId: '55555555-5555-4555-8555-555555555555',
        },
        query: {
          source: 'queue',
        },
        body: {
          dueAt: '2026-09-12T10:00:00.000Z',
        },
      },
    });
  });

  it('stores POST success using the Nest default 201 status', async () => {
    reflector.getAllAndOverride.mockReturnValue(operation);
    reflector.get.mockReturnValue(undefined);

    idempotencyService.begin.mockResolvedValue({
      kind: 'execute',
      recordId,
    });
    idempotencyService.complete.mockResolvedValue(undefined);

    const reply = createReply();
    const responseBody = {
      id: 'activity-123',
      type: 'call',
    };

    const context = createContext({ method: 'POST', reply });
    const next = createNext(of(responseBody));

    const observable = await interceptor.intercept(context, next);

    await expect(firstValueFrom(observable)).resolves.toEqual(responseBody);

    expect(idempotencyService.complete).toHaveBeenCalledWith({
      recordId,
      tenantId,
      userId,
      responseStatus: 201,
      responseBody,
    });
    expect(reply.header).toHaveBeenCalledWith(IDEMPOTENCY_REPLAY_HEADER, 'false');
  });

  it('stores non-POST success using the Nest default 200 status', async () => {
    reflector.getAllAndOverride.mockReturnValue(operation);
    reflector.get.mockReturnValue(undefined);

    idempotencyService.begin.mockResolvedValue({
      kind: 'execute',
      recordId,
    });
    idempotencyService.complete.mockResolvedValue(undefined);

    const context = createContext({ method: 'PATCH' });
    const next = createNext(of({ status: 'pending' }));

    const observable = await interceptor.intercept(context, next);
    await firstValueFrom(observable);
    expect(idempotencyService.complete).toHaveBeenCalledWith({
      recordId,
      tenantId,
      userId,
      responseStatus: 200,
      responseBody: {
        status: 'pending',
      },
    });
  });

  it('preserves an explicit HttpCode status', async () => {
    reflector.getAllAndOverride.mockReturnValue(operation);
    reflector.get.mockImplementation((metadataKey: unknown) => {
      return metadataKey === HTTP_CODE_METADATA ? 202 : undefined;
    });

    idempotencyService.begin.mockResolvedValue({
      kind: 'execute',
      recordId,
    });
    idempotencyService.complete.mockResolvedValue(undefined);

    const context = createContext({ method: 'POST' });
    const next = createNext(of({ accepted: true }));

    const observable = await interceptor.intercept(context, next);
    await firstValueFrom(observable);

    expect(idempotencyService.complete).toHaveBeenCalledWith({
      recordId,
      tenantId,
      userId,
      responseStatus: 202,
      responseBody: {
        accepted: true,
      },
    });
  });

  it('replays the original response without executing the handler', async () => {
    reflector.getAllAndOverride.mockReturnValue(operation);
    reflector.get.mockReturnValue(undefined);

    const replayBody = {
      id: 'activity-123',
      type: 'call',
    };

    idempotencyService.begin.mockResolvedValue({
      kind: 'replay',
      responseStatus: 201,
      responseBody: replayBody,
    });

    const reply = createReply();
    const context = createContext({ reply });
    const next = createNext();

    const observable = await interceptor.intercept(context, next);

    await expect(firstValueFrom(observable)).resolves.toEqual(replayBody);

    expect(reply.status).toHaveBeenCalledWith(201);
    expect(reply.header).toHaveBeenCalledWith(IDEMPOTENCY_REPLAY_HEADER, 'true');
    expect(next.handle).not.toHaveBeenCalled();
    expect(idempotencyService.complete).not.toHaveBeenCalled();
  });

  it('releases the claim when the handler throws a deterministic 4xx error', async () => {
    reflector.getAllAndOverride.mockReturnValue(operation);
    reflector.get.mockReturnValue(undefined);

    idempotencyService.begin.mockResolvedValue({
      kind: 'execute',
      recordId,
    });
    idempotencyService.release.mockResolvedValue(undefined);

    const originalError = new BadRequestException('Invalid request');
    const context = createContext();
    const next = createNext(throwError(() => originalError));

    const observable = await interceptor.intercept(context, next);

    await expect(firstValueFrom(observable)).rejects.toBe(originalError);

    expect(idempotencyService.release).toHaveBeenCalledWith({
      recordId,
      tenantId,
      userId,
    });
    expect(idempotencyService.markUncertain).not.toHaveBeenCalled();
    expect(idempotencyService.complete).not.toHaveBeenCalled();
  });

  it('marks the claim uncertain when the handler throws a 5xx error', async () => {
    reflector.getAllAndOverride.mockReturnValue(operation);
    reflector.get.mockReturnValue(undefined);

    idempotencyService.begin.mockResolvedValue({
      kind: 'execute',
      recordId,
    });
    idempotencyService.markUncertain.mockResolvedValue(undefined);

    const originalError = new InternalServerErrorException('Failure');
    const context = createContext();
    const next = createNext(throwError(() => originalError));

    const observable = await interceptor.intercept(context, next);

    await expect(firstValueFrom(observable)).rejects.toBe(originalError);

    expect(idempotencyService.markUncertain).toHaveBeenCalledWith({
      recordId,
      tenantId,
      userId,
    });
    expect(idempotencyService.release).not.toHaveBeenCalled();
  });

  it('marks the claim uncertain when the handler throws an unknown error', async () => {
    reflector.getAllAndOverride.mockReturnValue(operation);
    reflector.get.mockReturnValue(undefined);

    idempotencyService.begin.mockResolvedValue({
      kind: 'execute',
      recordId,
    });
    idempotencyService.markUncertain.mockResolvedValue(undefined);

    const originalError = new Error('Unknown failure');
    const context = createContext();
    const next = createNext(throwError(() => originalError));

    const observable = await interceptor.intercept(context, next);

    await expect(firstValueFrom(observable)).rejects.toBe(originalError);

    expect(idempotencyService.markUncertain).toHaveBeenCalledWith({
      recordId,
      tenantId,
      userId,
    });
    expect(idempotencyService.release).not.toHaveBeenCalled();
  });

  it('preserves the original 4xx error even if releasing the claim fails', async () => {
    reflector.getAllAndOverride.mockReturnValue(operation);
    reflector.get.mockReturnValue(undefined);

    idempotencyService.begin.mockResolvedValue({
      kind: 'execute',
      recordId,
    });
    idempotencyService.release.mockRejectedValue(new Error('Repository unavailable'));

    const originalError = new BadRequestException('Invalid request');
    const context = createContext();
    const next = createNext(throwError(() => originalError));

    const observable = await interceptor.intercept(context, next);

    await expect(firstValueFrom(observable)).rejects.toBe(originalError);
    expect(idempotencyService.release).toHaveBeenCalledWith({
      recordId,
      tenantId,
      userId,
    });
  });

  it('preserves the original server error even if uncertain persistence fails', async () => {
    reflector.getAllAndOverride.mockReturnValue(operation);
    reflector.get.mockReturnValue(undefined);

    idempotencyService.begin.mockResolvedValue({
      kind: 'execute',
      recordId,
    });
    idempotencyService.markUncertain.mockRejectedValue(new Error('Repository unavailable'));

    const originalError = new Error('Business execution failed');
    const context = createContext();
    const next = createNext(throwError(() => originalError));

    const observable = await interceptor.intercept(context, next);

    await expect(firstValueFrom(observable)).rejects.toBe(originalError);
    expect(idempotencyService.markUncertain).toHaveBeenCalledWith({
      recordId,
      tenantId,
      userId,
    });
  });

  it('passes duplicate Idempotency-Key header values to the service for validation', async () => {
    reflector.getAllAndOverride.mockReturnValue(operation);
    reflector.get.mockReturnValue(undefined);

    idempotencyService.begin.mockRejectedValue(
      new BadRequestException({
        code: 'INVALID_IDEMPOTENCY_KEY',
        message: 'Invalid key',
        error: 'Bad Request',
      }),
    );

    const context = createContext({
      headers: {
        'idempotency-key': ['one', 'two'],
      },
    });

    const next = createNext();

    await expect(interceptor.intercept(context, next)).rejects.toBeInstanceOf(BadRequestException);

    expect(idempotencyService.begin).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: ['one', 'two'],
      }),
    );
    expect(next.handle).not.toHaveBeenCalled();
  });

  it('reads idempotency operation metadata from the handler or controller', async () => {
    reflector.getAllAndOverride.mockReturnValue(operation);
    reflector.get.mockReturnValue(undefined);

    idempotencyService.begin.mockResolvedValue({
      kind: 'replay',
      responseStatus: 201,
      responseBody: {
        id: 'activity-123',
      },
    });

    const context = createContext();

    await interceptor.intercept(context, createNext());

    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IDEMPOTENCY_OPERATION_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);
  });
});
