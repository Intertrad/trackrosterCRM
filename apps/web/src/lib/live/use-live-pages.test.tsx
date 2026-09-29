// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/api-error';
import { useLivePages } from './use-live-pages';

afterEach(cleanup);
describe('live cursor lists', () => {
  it('retains all loaded pages when a refresh changes the first page', async () => {
    let changed = false;
    const read = vi.fn(async (cursor?: string) =>
      cursor
        ? { items: [{ id: 'b' }], nextCursor: null }
        : { items: [{ id: changed ? 'new' : 'a' }], nextCursor: 'page-2' },
    );
    const hook = renderHook(() => useLivePages(read));
    await waitFor(() => expect(hook.result.current.rows).toEqual([{ id: 'a' }]));
    act(() => hook.result.current.loadMore());
    await waitFor(() => expect(hook.result.current.rows).toEqual([{ id: 'a' }, { id: 'b' }]));
    changed = true;
    await act(() => hook.result.current.load());
    expect(hook.result.current.rows).toEqual([{ id: 'new' }, { id: 'b' }]);
  });
  it('ignores a slow response after the filter changes and clears denied data', async () => {
    let resolveOld!: (page: { items: { id: string }[]; nextCursor: null }) => void;
    const old = vi.fn(
      () =>
        new Promise<{ items: { id: string }[]; nextCursor: null }>((resolve) => {
          resolveOld = resolve;
        }),
    );
    const current = vi.fn().mockResolvedValue({ items: [{ id: 'current' }], nextCursor: null });
    const hook = renderHook(({ read }) => useLivePages<{ id: string }>(read), {
      initialProps: { read: old },
    });
    hook.rerender({ read: current });
    await waitFor(() => expect(hook.result.current.rows).toEqual([{ id: 'current' }]));
    await act(async () => resolveOld({ items: [{ id: 'stale' }], nextCursor: null }));
    expect(hook.result.current.rows).toEqual([{ id: 'current' }]);
    current.mockRejectedValue(
      new ApiError({ statusCode: 403, code: 'FORBIDDEN', message: 'denied', error: 'Forbidden' }),
    );
    await act(() => hook.result.current.load());
    expect(hook.result.current.rows).toBeNull();
    expect(hook.result.current.error).toBe(true);
  });
});
