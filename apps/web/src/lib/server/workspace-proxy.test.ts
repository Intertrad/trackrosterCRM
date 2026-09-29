import { beforeEach, describe, expect, it, vi } from 'vitest';
const upstream = vi.hoisted(() => vi.fn());
vi.mock('./authenticated-backend-resource', () => ({ authenticatedBackendResource: upstream }));
import { matchWorkspaceOperation, proxyWorkspaceRequest } from './workspace-proxy';
import { ApiError } from '@/lib/api/api-error';

describe('workspace browser boundary', () => {
  beforeEach(() => {
    upstream.mockReset();
  });
  it('rejects arbitrary upstream paths, traversal and methods', () => {
    for (const parts of [
      ['auth', 'login'],
      ['auth', 'refresh'],
      ['..', 'tenant'],
      ['%2e%2e', 'tenant'],
      ['http:', 'evil.test'],
      ['organizations', 'a/b'],
    ])
      expect(matchWorkspaceOperation('POST', parts)).toBeUndefined();
    expect(matchWorkspaceOperation('PUT', ['organizations'])).toBeUndefined();
  });
  it('keeps the cookie session, conditional version and retry identity on a write', async () => {
    upstream.mockResolvedValue({ resource: { name: 'Updated' }, etag: '"v2"' });
    const response = await proxyWorkspaceRequest(
      new Request('http://localhost/api/workspace/organizations/abc', {
        method: 'PATCH',
        headers: {
          origin: 'http://localhost',
          'idempotency-key': 'stable-retry',
          'if-match': '"v1"',
          authorization: 'Bearer untrusted',
          'x-tenant-id': 'other',
        },
        body: JSON.stringify({ name: 'Updated' }),
      }),
      ['organizations', 'abc'],
    );
    expect(upstream).toHaveBeenCalledWith('/organizations/abc', {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': 'stable-retry',
        'if-match': '"v1"',
      },
      body: '{"name":"Updated"}',
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('etag')).toBe('"v2"');
  });
  it('refuses cross-origin writes before calling the backend', async () => {
    const response = await proxyWorkspaceRequest(
      new Request('http://localhost/api/workspace/tenant', {
        method: 'PATCH',
        headers: { origin: 'https://elsewhere.example' },
        body: '{}',
      }),
      ['tenant'],
    );
    expect(response.status).toBe(403);
    expect(upstream).not.toHaveBeenCalled();
  });
  it('passes only documented query keys and preserves 204', async () => {
    upstream.mockResolvedValue({ resource: { items: [] }, etag: null });
    await proxyWorkspaceRequest(
      new Request(
        'http://localhost/api/workspace/organizations?search=Paris&tenantId=other&cursor=next',
      ),
      ['organizations'],
    );
    expect(upstream.mock.calls[0]?.[0]).toBe('/organizations?cursor=next&search=Paris');
    upstream.mockResolvedValue({ resource: undefined, etag: null });
    const result = await proxyWorkspaceRequest(
      new Request('http://localhost/api/workspace/tags/id', { method: 'DELETE' }),
      ['tags', 'id'],
    );
    expect(result.status).toBe(204);
    expect(await result.text()).toBe('');
  });
  it('returns authentication and conflict errors without flattening them', async () => {
    upstream.mockResolvedValue(null);
    expect(
      (
        await proxyWorkspaceRequest(new Request('http://localhost/api/workspace/tenant'), [
          'tenant',
        ])
      ).status,
    ).toBe(401);
    upstream.mockRejectedValue(
      new ApiError({
        statusCode: 412,
        code: 'STALE',
        message: 'Changed',
        error: 'Precondition Failed',
        requestId: 'trace',
      }),
    );
    const response = await proxyWorkspaceRequest(
      new Request('http://localhost/api/workspace/tenant'),
      ['tenant'],
    );
    expect(response.status).toBe(412);
    expect((await response.json()).requestId).toBe('trace');
  });
});
