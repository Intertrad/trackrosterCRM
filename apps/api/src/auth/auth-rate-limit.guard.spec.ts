import { describe, expect, it, vi } from 'vitest';
import { AuthRateLimitGuard } from './auth-rate-limit.guard.js';

describe('Authentication rate limiting', () => {
  function setup(result: number | Error = 0) {
    const evaluate =
      result instanceof Error
        ? vi.fn().mockRejectedValue(result)
        : vi.fn().mockResolvedValue(result);
    const header = vi.fn();
    const guard = new AuthRateLimitGuard(
      { getClient: () => ({ eval: evaluate }) } as never,
      { get: () => undefined } as never,
    );
    const context = {
      getHandler: () => function login() {},
      switchToHttp: () => ({
        getRequest: () => ({ ip: '127.0.0.1', body: { email: ' PERSON@Example.test ' } }),
        getResponse: () => ({ header }),
      }),
    } as never;
    return { guard, context, evaluate, header };
  }
  it('limits both IP and normalized identity without storing raw email addresses', async () => {
    const { guard, context, evaluate } = setup();
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(evaluate.mock.calls[0]?.[1].keys).toHaveLength(2);
    expect(JSON.stringify(evaluate.mock.calls)).not.toContain('Example.test');
    expect(evaluate.mock.calls[0]?.[1].arguments).toEqual(['60', '10', '60000']);
  });
  it('returns a retry hint when the shared limiter blocks an attempt', async () => {
    const { guard, context, header } = setup(45);
    await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 429 });
    expect(header).toHaveBeenCalledWith('Retry-After', '45');
  });
  it('fails closed if the rate-limit store is unavailable', async () => {
    const { guard, context } = setup(new Error('Redis down'));
    await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 503 });
  });
});
