'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/lib/api/api-error';
import { useLiveRefresh } from './use-live-refresh';

type Page<T> = { items: T[]; nextCursor: string | null };

/** Re-read the visible cursor chain so polling never discards loaded pages. */
export function useLivePages<T extends { id?: unknown }>(
  read: (cursor: string | undefined, signal: AbortSignal) => Promise<Page<T>>,
) {
  const [rows, setRows] = useState<T[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const pages = useRef(1);
  const running = useRef<AbortController | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      running.current?.abort();
      const controller = new AbortController();
      running.current = controller;
      const abort = () => controller.abort();
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) controller.abort();
      setBusy(true);
      try {
        const collected = new Map<unknown, T>();
        let next: string | undefined;
        for (let index = 0; index < pages.current; index++) {
          const page = await read(next, controller.signal);
          if (controller.signal.aborted) return;
          for (const row of page.items) collected.set(row.id, row);
          next = page.nextCursor ?? undefined;
          if (!next) break;
        }
        setRows([...collected.values()]);
        setCursor(next ?? null);
        setError(false);
      } catch (caught) {
        if (!controller.signal.aborted) {
          setError(true);
          if (caught instanceof ApiError && [401, 403].includes(caught.statusCode)) {
            setRows(null);
            setCursor(null);
          }
        }
      } finally {
        signal?.removeEventListener('abort', abort);
        if (running.current === controller && !controller.signal.aborted) setBusy(false);
      }
    },
    [read],
  );

  useEffect(() => {
    pages.current = 1;
    setRows(null);
    setCursor(null);
    void load();
    return () => running.current?.abort();
  }, [load]);
  useLiveRefresh(load);

  const loadMore = () => {
    if (busy || !cursor) return;
    pages.current += 1;
    void load();
  };
  return { rows, cursor, error, busy, load, loadMore };
}
