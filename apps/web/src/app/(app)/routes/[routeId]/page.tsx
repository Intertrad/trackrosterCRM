'use client';

import { useLiveRefresh } from '@/lib/live/use-live-refresh';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDot,
  Navigation,
  SkipForward,
  Trash2,
} from 'lucide-react';

import { RouteStatusBadge, describeRouteError, formatScheduled } from '../page';
import { ProspectMap, toMapPoint, type MapPoint } from '@/components/prospector/prospect-map';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { StatTile } from '@/components/ui/stat-tile';
import {
  cancelRoute,
  completeRoute,
  getRoute,
  optimizeRoute,
  removeRouteStop,
  reorderRouteStops,
  startRoute,
  updateRouteStop,
} from '@/lib/api/route-client';
import {
  formatDistance,
  formatDuration,
  type FieldRoute,
  type RouteStop,
  type RouteStopStatus,
} from '@/lib/api/route-types';
import { listWorkQueue } from '@/lib/api/work-queue-client';
import type { WorkQueueItem } from '@/lib/api/work-queue-types';
import { useAuth } from '@/lib/auth/auth-context';

export default function RouteDetailPage({ params }: { params: Promise<{ routeId: string }> }) {
  const { routeId } = use(params);

  return <RouteDetail routeId={routeId} />;
}

function RouteDetail({ routeId }: { routeId: string }) {
  const { activeWorkspace } = useAuth();
  const teamId = activeWorkspace?.teamId ?? null;

  const [route, setRoute] = useState<FieldRoute | null>(null);

  /*
   * A stop carries only a campaignProspectId. Names, addresses and
   * coordinates live on the work queue, so it is loaded once and joined by id
   * rather than rendering a list of opaque identifiers.
   */
  const [prospects, setProspects] = useState<Map<string, WorkQueueItem>>(new Map());

  const [readError, setReadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(
    (signal?: AbortSignal): Promise<void> =>
      getRoute(routeId, signal)
        .then((loaded) => {
          if (!signal?.aborted) {
            setRoute(loaded);
            setReadError(null);
          }
        })
        .catch((caught: unknown) => {
          if (!signal?.aborted) {
            setReadError(describeRouteError(caught));
          }
        }),
    [routeId],
  );

  useLiveRefresh(load);

  useEffect(() => {
    const controller = new AbortController();

    void load(controller.signal);

    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    if (!teamId) {
      return;
    }

    const controller = new AbortController();

    listWorkQueue({ teamId, limit: 100, signal: controller.signal })
      .then((page) => {
        setProspects(new Map(page.items.map((item) => [item.campaignProspectId, item])));
      })
      .catch(() => setProspects(new Map()));

    return () => controller.abort();
  }, [teamId]);

  const stops = useMemo(
    () => [...(route?.stops ?? [])].sort((left, right) => left.position - right.position),
    [route],
  );

  const points = useMemo<MapPoint[]>(
    () =>
      stops.flatMap((stop) => {
        const prospect = prospects.get(stop.campaignProspectId);

        if (!prospect) {
          return [];
        }

        return toMapPoint(
          stop.campaignProspectId,
          prospect.establishment.name,
          prospect.establishment.latitude,
          prospect.establishment.longitude,
          prospect.lifecycleStage,
          `/work-queue/${prospect.campaign.id}/${stop.campaignProspectId}`,
        );
      }),
    [prospects, stops],
  );

  const done = stops.filter(
    (stop) => stop.status === 'completed' || stop.status === 'skipped',
  ).length;

  async function run(action: string, operation: () => Promise<unknown>): Promise<void> {
    setBusy(action);
    setActionError(null);

    try {
      await operation();
      /* Every stop mutation returns the whole route, but a re-read keeps the
       * page honest when a concurrent change landed in between. */
      await load();
    } catch (caught) {
      setActionError(describeRouteError(caught));
    } finally {
      setBusy(null);
    }
  }

  function move(index: number, direction: -1 | 1): void {
    const target = index + direction;

    if (target < 0 || target >= stops.length) {
      return;
    }

    const next = stops.map((stop) => stop.id);
    const [moved] = next.splice(index, 1);

    next.splice(target, 0, moved!);

    void run('reorder', () => reorderRouteStops(routeId, next));
  }

  if (readError && !route) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Round" />

        <Alert tone="danger" title="We could not load this round.">
          {readError}
        </Alert>

        <div>
          <Link href="/routes" className="text-[14px] font-semibold text-brand">
            Back to routes
          </Link>
        </div>
      </div>
    );
  }

  if (!route) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <div className="h-16 animate-pulse rounded-xl bg-line-soft" />

        <div className="h-72 animate-pulse rounded-xl bg-line-soft" />
      </div>
    );
  }

  const terminal = route.status === 'completed' || route.status === 'cancelled';

  return (
    <div className="flex flex-col gap-6">
      <div>
        <nav aria-label="Breadcrumb" className="mb-2 text-[13px] text-ink-muted">
          <Link href="/routes" className="font-semibold text-brand hover:underline">
            Routes
          </Link>{' '}
          / {route.name}
        </nav>

        <PageHeader
          title={route.name}
          subtitle={formatScheduled(route.scheduledAt)}
          action={
            <div className="flex flex-wrap items-center gap-3">
              <RouteStatusBadge status={route.status} />

              {route.status === 'draft' ? (
                <Button
                  loading={busy === 'start'}
                  disabled={busy !== null || stops.length === 0}
                  title={stops.length === 0 ? 'Add a stop first' : undefined}
                  onClick={() => void run('start', () => startRoute(routeId))}
                >
                  Start round
                </Button>
              ) : null}

              {route.status === 'active' ? (
                <Button
                  loading={busy === 'complete'}
                  disabled={busy !== null}
                  onClick={() => void run('complete', () => completeRoute(routeId))}
                >
                  Complete round
                </Button>
              ) : null}
            </div>
          }
        />
      </div>

      {actionError ? <Alert tone="danger">{actionError}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={<CircleDot aria-hidden="true" className="size-5" />}
          tone="brand"
          value={`${done} / ${stops.length}`}
          label="Stops done"
        />

        <StatTile
          icon={<Navigation aria-hidden="true" className="size-5" />}
          tone="neutral"
          value={formatDistance(route.totalDistanceMeters)}
          label="Total distance"
        />

        <StatTile
          icon={<CircleDot aria-hidden="true" className="size-5" />}
          tone="neutral"
          value={formatDuration(route.totalDurationSeconds)}
          label="Estimated driving"
        />

        <StatTile
          icon={<CheckCircle2 aria-hidden="true" className="size-5" />}
          tone={route.status === 'completed' ? 'success' : 'neutral'}
          value={points.length}
          label="Stops plotted"
          delta={
            points.length < stops.length
              ? `${stops.length - points.length} without coordinates`
              : undefined
          }
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
        <div className="flex flex-col gap-5">
          <ProspectMap points={points} />
        </div>

        <Card>
          <CardHeader
            title="Stops"
            action={
              !terminal ? (
                <Button
                  variant="secondary"
                  loading={busy === 'optimize'}
                  disabled={busy !== null || stops.length < 2}
                  onClick={() => void run('optimize', () => optimizeRoute(routeId))}
                >
                  Optimise
                </Button>
              ) : undefined
            }
          />

          {stops.length === 0 ? (
            <p className="py-8 text-center text-[15px] text-ink-muted">
              This round has no stops yet.
            </p>
          ) : (
            <ol className="flex flex-col gap-2.5">
              {stops.map((stop, index) => (
                <StopRow
                  key={stop.id}
                  stop={stop}
                  index={index}
                  total={stops.length}
                  prospect={prospects.get(stop.campaignProspectId) ?? null}
                  busy={busy}
                  editable={!terminal}
                  running={route.status === 'active'}
                  onMove={move}
                  onStatus={(status) =>
                    void run(`stop-${stop.id}`, () => updateRouteStop(stop.id, { status }))
                  }
                  onRemove={() => void run(`remove-${stop.id}`, () => removeRouteStop(stop.id))}
                />
              ))}
            </ol>
          )}

          {route.status === 'draft' ? (
            <Button
              variant="secondary"
              fullWidth
              className="mt-5"
              loading={busy === 'cancel'}
              disabled={busy !== null}
              onClick={() => void run('cancel', () => cancelRoute(routeId))}
            >
              Cancel round
            </Button>
          ) : null}

          {terminal ? (
            <Alert tone="info" className="mt-5" title="This round is closed.">
              Completed and cancelled rounds are read-only.
            </Alert>
          ) : null}
        </Card>
      </div>
    </div>
  );
}

function StopRow({
  stop,
  index,
  total,
  prospect,
  busy,
  editable,
  running,
  onMove,
  onStatus,
  onRemove,
}: {
  stop: RouteStop;
  index: number;
  total: number;
  prospect: WorkQueueItem | null;
  busy: string | null;
  editable: boolean;
  running: boolean;
  onMove: (index: number, direction: -1 | 1) => void;
  onStatus: (status: RouteStopStatus) => void;
  onRemove: () => void;
}) {
  const settled = stop.status === 'completed' || stop.status === 'skipped';

  return (
    <li
      className={
        settled
          ? 'rounded-lg border border-line-soft bg-surface-muted px-3 py-3'
          : 'rounded-lg border border-line-soft px-3 py-3'
      }
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={
            stop.status === 'completed'
              ? 'flex size-7 shrink-0 items-center justify-center rounded-full bg-success text-[13px] font-bold text-white'
              : stop.status === 'skipped'
                ? 'flex size-7 shrink-0 items-center justify-center rounded-full bg-line text-[13px] font-bold text-white'
                : 'flex size-7 shrink-0 items-center justify-center rounded-full bg-brand text-[13px] font-bold text-white'
          }
        >
          {index + 1}
        </span>

        <span className="min-w-0 flex-1">
          {prospect ? (
            <Link
              href={`/work-queue/${prospect.campaign.id}/${stop.campaignProspectId}`}
              className="block truncate text-[15px] font-semibold text-navy hover:text-brand"
            >
              {prospect.establishment.name}
            </Link>
          ) : (
            <span className="block truncate text-[15px] font-semibold text-ink-muted">
              Prospect outside your current queue
            </span>
          )}

          <span className="block truncate text-[13px] text-ink-muted">
            {prospect?.establishment.city ?? '—'}
            {stop.eta ? ` · ETA ${formatTime(stop.eta)}` : ''}
          </span>
        </span>

        {stop.status ? <StopStatusBadge status={stop.status} /> : null}

        {editable && !running ? (
          <span className="flex shrink-0 flex-col">
            <button
              type="button"
              onClick={() => onMove(index, -1)}
              disabled={index === 0 || busy !== null}
              aria-label="Move stop earlier"
              className="text-ink-muted hover:text-ink disabled:opacity-40"
            >
              <ChevronUp aria-hidden="true" className="size-4" />
            </button>

            <button
              type="button"
              onClick={() => onMove(index, 1)}
              disabled={index === total - 1 || busy !== null}
              aria-label="Move stop later"
              className="text-ink-muted hover:text-ink disabled:opacity-40"
            >
              <ChevronDown aria-hidden="true" className="size-4" />
            </button>
          </span>
        ) : null}

        {editable && !running ? (
          <button
            type="button"
            onClick={onRemove}
            disabled={busy !== null}
            aria-label="Remove stop"
            className="shrink-0 text-ink-muted hover:text-danger disabled:opacity-40"
          >
            <Trash2 aria-hidden="true" className="size-4" />
          </button>
        ) : null}
      </div>

      {/* Progress is only recordable while the round is actually running. */}
      {running && !settled ? (
        <div className="mt-2.5 flex flex-wrap gap-2 pl-10">
          <Button
            variant="secondary"
            loading={busy === `stop-${stop.id}`}
            disabled={busy !== null}
            onClick={() => onStatus('arrived')}
          >
            Arrived
          </Button>

          <Button
            variant="secondary"
            loading={busy === `stop-${stop.id}`}
            disabled={busy !== null}
            onClick={() => onStatus('completed')}
          >
            <CheckCircle2 aria-hidden="true" className="mr-1.5 size-4" />
            Done
          </Button>

          <Button
            variant="secondary"
            loading={busy === `stop-${stop.id}`}
            disabled={busy !== null}
            onClick={() => onStatus('skipped')}
          >
            <SkipForward aria-hidden="true" className="mr-1.5 size-4" />
            Skip
          </Button>
        </div>
      ) : null}
    </li>
  );
}

function StopStatusBadge({ status }: { status: RouteStopStatus }) {
  if (status === 'completed') {
    return <Badge tone="success">Done</Badge>;
  }

  if (status === 'skipped') {
    return <Badge tone="neutral">Skipped</Badge>;
  }

  return <Badge tone="brand">Arrived</Badge>;
}

function formatTime(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
