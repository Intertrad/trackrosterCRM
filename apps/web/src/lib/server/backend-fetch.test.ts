import { afterEach, describe, expect, it, vi } from 'vitest';
import { backendFetch } from './backend-fetch';
vi.mock('./backend-config', () => ({ getBackendBaseUrl: () => 'http://localhost:3001' }));
afterEach(() => {
  vi.unstubAllGlobals();
});
describe('backend request framing', () => {
  it('does not label empty DELETE bodies as JSON', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetch);
    await backendFetch('/tags/id', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json', 'if-match': '"version"' },
      accessToken: 'test-token',
    });
    const headers = fetch.mock.calls[0]?.[1].headers as Headers;
    expect(headers.has('content-type')).toBe(false);
    expect(headers.get('if-match')).toBe('"version"');
    expect(headers.get('authorization')).toBe('Bearer test-token');
  });
  it('keeps the media type on a real JSON body', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({}));
    vi.stubGlobal('fetch', fetch);
    await backendFetch('/tenant', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    expect((fetch.mock.calls[0]?.[1].headers as Headers).get('content-type')).toBe(
      'application/json',
    );
  });
});
