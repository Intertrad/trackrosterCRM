/* @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { applyAssignment, listUnassignedProspects, previewAssignment } from './assignment-client';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('assignment client', () => {
  it('requires a campaign when listing unassigned prospects', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      jsonResponse({ items: [], nextCursor: null }),
    );

    vi.stubGlobal('fetch', fetchMock);

    await listUnassignedProspects({ campaignId: 'c1', teamId: 't1' });

    const url = String(fetchMock.mock.calls[0]?.[0]);

    expect(url).toContain('campaignId=c1');
    expect(url).toContain('teamId=t1');
  });

  it('sends a preview without an idempotency key, because it writes nothing', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse({ mode: 'preview' }));

    vi.stubGlobal('fetch', fetchMock);

    await previewAssignment({ campaignId: 'c1', prospectIds: ['p1'], teamId: 't1' });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Record<string, string>;

    expect(init.method).toBe('POST');
    expect('idempotency-key' in headers).toBe(false);
  });

  it('sends the caller idempotency key when committing a batch', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse({ mode: 'apply' }));

    vi.stubGlobal('fetch', fetchMock);

    await applyAssignment(
      { campaignId: 'c1', prospectIds: ['p1', 'p2'], teamId: 't1' },
      'fixed-key',
    );

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Record<string, string>;

    /* A retry after an ambiguous failure must not assign the lot twice. */
    expect(headers['idempotency-key']).toBe('fixed-key');
    expect(JSON.parse(init.body as string)).toMatchObject({ prospectIds: ['p1', 'p2'] });
  });

  it('raises a typed error when the lot changed concurrently', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () =>
        jsonResponse(
          { statusCode: 409, code: 'CONFLICT', message: 'changed', error: 'Conflict' },
          409,
        ),
      ),
    );

    await expect(
      applyAssignment({ campaignId: 'c1', prospectIds: ['p1'], teamId: 't1' }, 'k'),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
