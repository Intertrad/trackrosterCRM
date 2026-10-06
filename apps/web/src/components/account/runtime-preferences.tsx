'use client';

import { useCallback, useEffect, useState } from 'react';
import { getAccountPreferences } from '@/lib/api/account-client';
import type { AccountPreferences } from '@/lib/api/account-types';
import { useAuth } from '@/lib/auth/auth-context';
import { useLiveRefresh } from '@/lib/live/use-live-refresh';

/** One runtime adapter for the preferences persisted by the account API. */
export function RuntimePreferences() {
  const { user, status } = useAuth();
  const [preferences, setPreferences] = useState<AccountPreferences | null>(null);
  const enabled = status === 'authenticated';
  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!enabled) return;
      try {
        const response = await getAccountPreferences(signal);
        if (!signal?.aborted) setPreferences(response.resource);
      } catch {
        /* The settings screen owns actionable errors; preserve the last usable theme. */
      }
    },
    [enabled],
  );
  useEffect(() => {
    const controller = new AbortController();
    setPreferences(null);
    void load(controller.signal);
    return () => controller.abort();
  }, [load, user?.tenantId, user?.userId]);
  useLiveRefresh(load, { enabled, interval: 60_000 });
  useEffect(() => {
    const refresh = () => void load();
    window.addEventListener('trackroster:preferences-changed', refresh);
    return () => window.removeEventListener('trackroster:preferences-changed', refresh);
  }, [load]);
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const theme = preferences?.theme ?? 'light';
      const systemDark =
        theme === 'system' &&
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.dataset.theme = theme === 'dark' || systemDark ? 'dark' : 'light';
      root.dataset.density = preferences?.density ?? 'comfortable';
      root.dataset.reducedMotion = String(preferences?.reducedMotion ?? false);
      root.dataset.highContrast = String(preferences?.highContrast ?? false);
    };
    apply();
    if (preferences?.theme !== 'system') return undefined;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [preferences]);
  return null;
}
