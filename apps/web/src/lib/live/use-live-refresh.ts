'use client';

import { useEffect, useEffectEvent } from 'react';
import { listenForChanges } from './live-events';

/** Background reads only. The caller owns initial load, drafts and errors. */
export function useLiveRefresh(
  refresh: (signal: AbortSignal) => Promise<unknown> | void,
  {
    enabled = true,
    interval = 10_000,
    scope,
  }: { enabled?: boolean; interval?: number; scope?: string } = {},
): void {
  const onRefresh = useEffectEvent(refresh);
  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let running: AbortController | null = null;
    let queued = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const visible = () => document.visibilityState !== 'hidden' && navigator.onLine !== false;
    const schedule = () => {
      clearTimeout(timer);
      if (!disposed) timer = setTimeout(() => void run(), interval);
    };
    async function run() {
      if (disposed || !visible()) {
        schedule();
        return;
      }
      if (running) {
        queued = true;
        return;
      }
      const controller = new AbortController();
      running = controller;
      try {
        await onRefresh(controller.signal);
      } catch {
        /* A page owns its recovery UI. */
      } finally {
        running = null;
        if (!disposed && queued) {
          queued = false;
          timer = setTimeout(() => void run(), 350);
        } else schedule();
      }
    }
    const wake = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void run(), 350);
    };
    const visibility = () => {
      if (visible()) wake();
      else running?.abort();
    };
    const stopListening = listenForChanges(wake);
    window.addEventListener('focus', wake);
    window.addEventListener('online', wake);
    document.addEventListener('visibilitychange', visibility);
    schedule();
    return () => {
      disposed = true;
      clearTimeout(timer);
      running?.abort();
      stopListening();
      window.removeEventListener('focus', wake);
      window.removeEventListener('online', wake);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [enabled, interval, scope]);
}
