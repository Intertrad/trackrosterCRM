import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReadinessController } from './readiness.controller.js';

describe('Dependency readiness', () => {
  afterEach(() => vi.useRealTimers());
  function controller(
    query = vi.fn().mockResolvedValue({ rows: [{ value: 1 }] }),
    ping = vi.fn().mockResolvedValue('PONG'),
  ) {
    return new ReadinessController(
      { query, totalCount: 1, idleCount: 1, waitingCount: 0 } as never,
      { ping } as never,
      { get: vi.fn().mockReturnValue(undefined) } as never,
      { configured: vi.fn().mockReturnValue(false) } as never,
    );
  }
  it('reports readiness only when both dependencies respond', async () => {
    await expect(controller().ready()).resolves.toEqual({
      status: 'ready',
      dependencies: {
        postgres: 'up',
        postgresPool: {
          total: 1,
          idle: 1,
          waiting: 0,
          max: 8,
          aggregateBudget: 12,
          estimatedAggregate: 12,
        },
        redis: 'up',
        optional: {
          objectStorage: 'unconfigured',
          email: 'unconfigured',
          emailDelivery: { status: 'unconfigured', terminalFailures: 0 },
          maps: 'unconfigured',
          sso: 'unconfigured',
        },
      },
    });
  });
  it('reports terminal mail failures without exposing mail contents', async () => {
    const config = {
      get: vi.fn((key: string) => {
        if (key === 'BREVO_API_KEY') return 'configured';
        if (key === 'BREVO_SENDER_EMAIL') return 'accounts@example.test';
        return undefined;
      }),
    };
    const check = new ReadinessController(
      {
        query: vi.fn().mockResolvedValue({ rows: [{ terminalFailures: 3 }] }),
        totalCount: 1,
        idleCount: 1,
        waitingCount: 0,
      } as never,
      { ping: vi.fn().mockResolvedValue('PONG') } as never,
      config as never,
      { configured: vi.fn().mockReturnValue(false) } as never,
    );

    await expect(check.ready()).resolves.toMatchObject({
      status: 'ready',
      dependencies: {
        optional: {
          email: 'configured',
          emailDelivery: { status: 'degraded', terminalFailures: 3 },
        },
      },
    });
  });
  it('returns service unavailable without leaking database errors', async () => {
    const check = controller(
      vi.fn().mockRejectedValue(new Error('sensitive internal connection details')),
    );
    await expect(check.ready()).rejects.toMatchObject({
      status: 503,
      response: { dependencies: { postgres: 'down', redis: 'up' } },
    });
    expect(check.live()).toEqual({ status: 'ok' });
  });
  it('does not hang indefinitely on an unavailable dependency', async () => {
    vi.useFakeTimers();
    const promise = controller(vi.fn().mockReturnValue(new Promise(() => {}))).ready();
    const assertion = expect(promise).rejects.toMatchObject({ status: 503 });
    await vi.advanceTimersByTimeAsync(2001);
    await assertion;
  });
});
