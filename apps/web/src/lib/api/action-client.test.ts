/* @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { completeAction, createAction, startAction } from './action-client';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('action client', () => {
  it('sends the whole completion as one request', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse({ id: 'a1' }));

    vi.stubGlobal('fetch', fetchMock);

    await completeAction(
      'a1',
      {
        outcomeCode: 'contacted',
        notes: 'Discussed the new range.',
        lifecycleStage: 'follow_up',
        nextFollowUp: { dueAt: '2026-09-25T08:00:00.000Z', channel: 'call' },
        reservationDisposition: 'release',
      },
      'key-1',
    );

    /*
     * The outcome, status change, follow-up and reservation must travel
     * together — three separate writes could leave a partial state.
     */
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;

    expect(JSON.parse(init.body as string)).toEqual({
      outcomeCode: 'contacted',
      notes: 'Discussed the new range.',
      lifecycleStage: 'follow_up',
      nextFollowUp: { dueAt: '2026-09-25T08:00:00.000Z', channel: 'call' },
      reservationDisposition: 'release',
    });
  });

  it('carries an idempotency key on every write', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse({ id: 'a1' }));

    vi.stubGlobal('fetch', fetchMock);

    await createAction(
      { campaignId: 'c1', campaignProspectId: 'p1', type: 'call', subject: 'Call' },
      'create-key',
    );

    await startAction('a1', 'start-key');

    for (const call of fetchMock.mock.calls) {
      const headers = (call[1] as RequestInit).headers as Record<string, string>;

      expect(headers['idempotency-key']).toBeTruthy();
    }
  });

  it('escapes the action id into the path', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse({ id: 'a/b' }));

    vi.stubGlobal('fetch', fetchMock);

    await startAction('a/b', 'k');

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('/api/actions/a%2Fb/start');
  });

  it('propagates a refusal from the collision engine', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () =>
        jsonResponse(
          { statusCode: 409, code: 'CONFLICT', message: 'blocked', error: 'Conflict' },
          409,
        ),
      ),
    );

    await expect(
      completeAction('a1', { outcomeCode: 'contacted', reservationDisposition: 'release' }, 'k'),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
