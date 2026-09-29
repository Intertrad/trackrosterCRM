import { afterEach, describe, expect, it, vi } from 'vitest';
import { browserResource } from './browser-resource';
vi.mock('@/lib/live/live-events', () => ({ announceMutation: vi.fn() }));
afterEach(() => vi.unstubAllGlobals());
describe('resource version preservation', () => {
  it('keeps the server body validator when no HTTP ETag is supplied', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ id: 'objective', etag: '"row-version"' })),
    );
    expect((await browserResource('/api/workspace/objectives/one')).etag).toBe('"row-version"');
  });
  it('prefers the HTTP validator and never invents one from an id', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ etag: '"body"' }, { headers: { etag: '"header"' } }))
        .mockResolvedValueOnce(Response.json({ id: 'record' })),
    );
    expect((await browserResource('/one')).etag).toBe('"header"');
    expect((await browserResource('/two')).etag).toBeNull();
  });
});
