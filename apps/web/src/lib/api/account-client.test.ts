/* @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getAccountProfile,
  revokeSession,
  updateAccountPreferences,
  updateAccountProfile,
} from './account-client';

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('account client', () => {
  it('surfaces the ETag the BFF forwarded from the API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(
          { email: 'nabil@intertrad.fr' },
          { headers: { 'content-type': 'application/json', etag: '"abc123"' } },
        ),
      ),
    );

    const result = await getAccountProfile();

    expect(result.etag).toBe('"abc123"');
    expect(result.resource).toMatchObject({ email: 'nabil@intertrad.fr' });
  });

  it('echoes that ETag back as If-Match on a profile update', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse({}));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('crypto', { randomUUID: () => 'fixed-key' });

    await updateAccountProfile({ displayName: 'Nabil' }, '"abc123"');

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Record<string, string>;

    expect(init.method).toBe('PATCH');
    expect(headers['if-match']).toBe('"abc123"');
    expect(headers['idempotency-key']).toBe('fixed-key');
  });

  it('omits If-Match when no validator was read, rather than sending an empty one', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse({}));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('crypto', { randomUUID: () => 'fixed-key' });

    await updateAccountPreferences({ theme: 'dark' }, null);

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Record<string, string>;

    expect('if-match' in headers).toBe(false);
  });

  it('sends only the changed preference keys', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse({}));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('crypto', { randomUUID: () => 'fixed-key' });

    await updateAccountPreferences({ theme: 'dark' }, '"v1"');

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;

    expect(JSON.parse(init.body as string)).toEqual({ theme: 'dark' });
  });

  it('escapes a session id into the revoke path', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse({ revoked: 1 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('crypto', { randomUUID: () => 'fixed-key' });

    await revokeSession('a/b');

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/me/sessions/a%2Fb');
  });

  it('raises a typed ApiError on a precondition failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(
          { statusCode: 412, code: 'RESOURCE_VERSION_CONFLICT', message: 'changed' },
          { status: 412 },
        ),
      ),
    );
    vi.stubGlobal('crypto', { randomUUID: () => 'fixed-key' });

    await expect(updateAccountProfile({ displayName: 'x' }, '"stale"')).rejects.toMatchObject({
      statusCode: 412,
      code: 'RESOURCE_VERSION_CONFLICT',
    });
  });
});
