// @vitest-environment jsdom
import { act, renderHook, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLiveRefresh } from './use-live-refresh';
import { announceMutation } from './live-events';

describe('live refresh', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });
  it('refreshes after writes and on schedule without repeatedly mounting a form', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useLiveRefresh(refresh));
    await act(async () => {
      announceMutation('PATCH');
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(refresh).toHaveBeenCalledTimes(2);
  });
  it('pauses while offline and hidden, then wakes on reconnect', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useLiveRefresh(refresh));
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(refresh).not.toHaveBeenCalled();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });
  it('aborts a previous scope before another conversation or filter can refresh', async () => {
    const signals: AbortSignal[] = [];
    const refresh = vi.fn((signal: AbortSignal) => {
      signals.push(signal);
      return new Promise(() => {});
    });
    const hook = renderHook(({ scope }) => useLiveRefresh(refresh, { scope }), {
      initialProps: { scope: 'conversation-a' },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    hook.rerender({ scope: 'conversation-b' });
    expect(signals[0]?.aborted).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(signals).toHaveLength(2);
    expect(signals[1]?.aborted).toBe(false);
  });
  it('does not overlap requests and aborts on unmount', async () => {
    let signal: AbortSignal | undefined;
    const refresh = vi.fn((s: AbortSignal) => {
      signal = s;
      return new Promise(() => {});
    });
    const hook = renderHook(() => useLiveRefresh(refresh));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
      announceMutation('POST');
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    hook.unmount();
    expect(signal?.aborted).toBe(true);
  });
});
