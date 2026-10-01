'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, CalendarClock, CheckCircle2, RefreshCw, Timer } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { StatTile } from '@/components/ui/stat-tile';
import { ApiError } from '@/lib/api/api-error';
import { listFollowUpQueue } from '@/lib/api/follow-up-client';
import type { FollowUpQueueItem } from '@/lib/api/follow-up-types';
import { getProspectorToday } from '@/lib/api/prospector-today-client';
import type { ProspectorTodayResponse } from '@/lib/api/prospector-today-types';
import { useAuth } from '@/lib/auth/auth-context';
import { useLiveRefresh } from '@/lib/live/use-live-refresh';

/**
 * A prospector's performance view is intentionally operational: it uses the
 * same scoped today and follow-up endpoints as My Day, so the numbers cannot
 * drift from the work the operator is actually allowed to see.
 */
export default function PerformancePage() {
  const { activeWorkspace } = useAuth();
  const teamId = activeWorkspace?.teamId ?? null;
  const [today, setToday] = useState<ProspectorTodayResponse | null>(null);
  const [followUps, setFollowUps] = useState<FollowUpQueueItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshVersion, setRefreshVersion] = useState(0);

  useLiveRefresh(() => setRefreshVersion((version) => version + 1));

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      if (!teamId) {
        setToday(null);
        setFollowUps([]);
        setError('No team workspace is selected for this account.');
        return;
      }

      try {
        const [todayResponse, followUpResponse] = await Promise.all([
          getProspectorToday({
            teamId,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            signal,
          }),
          listFollowUpQueue({ teamId, limit: 100, signal }),
        ]);

        if (signal?.aborted) return;

        setToday(todayResponse);
        setFollowUps(followUpResponse.items);
        setError(null);
      } catch (caught) {
        if (signal?.aborted) return;

        setError(
          caught instanceof ApiError && caught.statusCode === 401
            ? 'Your session has expired. Please sign in again.'
            : 'We could not load your performance yet. Please try again.',
        );
      }
    },
    [teamId],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, refreshVersion]);

  async function refresh(): Promise<void> {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  const overdue = followUps?.filter((item) => new Date(item.dueAt).getTime() < Date.now()).length;
  const due = followUps?.length ?? null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="My performance"
        subtitle="A live view of your assigned work and follow-ups."
        action={
          <Button variant="secondary" onClick={() => void refresh()} disabled={refreshing}>
            <RefreshCw
              aria-hidden="true"
              className={refreshing ? 'size-4 animate-spin' : 'size-4'}
            />
            Refresh
          </Button>
        }
      />

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={<CheckCircle2 className="size-5" />}
          tone="success"
          value={today?.summary.completedToday ?? null}
          label="Completed today"
        />
        <StatTile
          icon={<Activity className="size-5" />}
          value={today?.summary.actionsLeft ?? null}
          label="Actions remaining"
        />
        <StatTile
          icon={<CalendarClock className="size-5" />}
          tone="warning"
          value={due}
          label="Follow-ups in queue"
        />
        <StatTile
          icon={<Timer className="size-5" />}
          tone="danger"
          value={overdue ?? null}
          label="Overdue follow-ups"
        />
      </div>

      <Card>
        <CardHeader title="Today at a glance" />
        {today ? (
          <dl className="grid gap-3 sm:grid-cols-3">
            <Metric label="To do" value={today.summary.toDo} />
            <Metric label="Follow-ups" value={today.summary.followUps} />
            <Metric label="Meetings" value={today.summary.meetings} />
          </dl>
        ) : (
          <div className="h-20 animate-pulse rounded-lg bg-line-soft" aria-busy="true" />
        )}
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-surface-muted px-4 py-3">
      <dt className="text-[13px] text-ink-muted">{label}</dt>
      <dd className="mt-1 text-2xl font-bold tabular-nums text-navy">{value}</dd>
    </div>
  );
}
