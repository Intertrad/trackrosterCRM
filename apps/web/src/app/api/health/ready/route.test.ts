import { beforeEach, describe, expect, it, vi } from 'vitest';

const { backendFetchMock } = vi.hoisted(() => ({ backendFetchMock: vi.fn() }));

vi.mock('@/lib/server/backend-fetch', () => ({ backendFetch: backendFetchMock }));

import { GET } from './route';

describe('GET /api/health/ready', () => {
  beforeEach(() => vi.clearAllMocks());

  it('proxies readiness status and prevents caching', async () => {
    backendFetchMock.mockResolvedValue(
      new Response(JSON.stringify({ status: 'ready' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ status: 'ready' });
    expect(backendFetchMock).toHaveBeenCalledWith('/health/ready');
  });

  it('preserves a dependency failure status from the API', async () => {
    backendFetchMock.mockResolvedValue(
      new Response(JSON.stringify({ status: 'not_ready' }), {
        status: 503,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const response = await GET();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: 'not_ready' });
  });

  it('returns a sanitized 503 when the API cannot be reached', async () => {
    backendFetchMock.mockRejectedValue(new Error('private upstream details'));

    const response = await GET();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: 'unavailable',
      message: 'Backend readiness is unavailable',
    });
  });
});
