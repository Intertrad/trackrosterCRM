'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, GripVertical, Trash2 } from 'lucide-react';

import { LifecycleBadge } from '@/components/prospector/lifecycle-badge';
import { ProspectMap, toMapPoint, type MapPoint } from '@/components/prospector/prospect-map';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { SearchInput } from '@/components/ui/search-input';
import { addRouteStop, createRoute, optimizeRoute } from '@/lib/api/route-client';
import {
  MAX_ROUTE_STOPS,
  formatDistance,
  formatDuration,
  type FieldRoute,
} from '@/lib/api/route-types';
import { ApiError } from '@/lib/api/api-error';
import { listWorkQueue } from '@/lib/api/work-queue-client';
import type { WorkQueueItem } from '@/lib/api/work-queue-types';
import { useAuth } from '@/lib/auth/auth-context';

export default function PlanRoundPage() {
  const router = useRouter();
  const { activeWorkspace } = useAuth();
  const teamId = activeWorkspace?.teamId ?? null;

  const [available, setAvailable] = useState<WorkQueueItem[] | null>(null);
  const [stops, setStops] = useState<WorkQueueItem[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  /* The saved route; null until the round is first persisted. */
  const [route, setRoute] = useState<FieldRoute | null>(null);
  const [saving, setSaving] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!teamId) {
      return;
    }

    const controller = new AbortController();

    listWorkQueue({ teamId, limit: 50, signal: controller.signal })
      .then((response) => {
        if (!controller.signal.aborted) {
          setAvailable(response.items);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError('We could not load prospects to plan a round.');
        }
      });

    return () => controller.abort();
  }, [teamId]);

  const selectable = useMemo(() => {
    const chosen = new Set(stops.map((stop) => stop.campaignProspectId));

    const query = search.trim().toLowerCase();

    return (available ?? []).filter(
      (item) =>
        !chosen.has(item.campaignProspectId) &&
        (query === '' || item.establishment.name.toLowerCase().includes(query)),
    );
  }, [available, search, stops]);

  /* The route preview plots the chosen stops in their current order. */
  const stopPoints = useMemo<MapPoint[]>(
    () =>
      stops.flatMap((stop) =>
        toMapPoint(
          stop.campaignProspectId,
          stop.establishment.name,
          stop.establishment.latitude,
          stop.establishment.longitude,
          stop.lifecycleStage,
          `/work-queue/${stop.campaign.id}/${stop.campaignProspectId}`,
        ),
      ),
    [stops],
  );

  const move = useCallback((index: number, direction: -1 | 1) => {
    setStops((current) => {
      const target = index + direction;

      if (target < 0 || target >= current.length) {
        return current;
      }

      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved!);

      return next;
    });
  }, []);

  async function save(): Promise<void> {
    if (!teamId || stops.length === 0) {
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      let current = route;

      if (!current) {
        /*
         * A route needs a start point. The first stop with coordinates is
         * used until a device location or depot is available.
         */
        const origin = stops.find(
          (stop) => stop.establishment.latitude !== null && stop.establishment.longitude !== null,
        );

        if (!origin) {
          setError('At least one stop needs coordinates before a round can be saved.');

          return;
        }

        current = await createRoute({
          teamId,
          name: `Round ${new Date().toLocaleDateString()}`,
          scheduledAt: new Date().toISOString(),
          startPoint: {
            latitude: origin.establishment.latitude!,
            longitude: origin.establishment.longitude!,
          },
        });
      }

      /* Stops are added in the order the planner shows them. */
      for (const stop of stops) {
        current = await addRouteStop(current.id, stop.campaignProspectId);
      }

      setRoute(current);

      /*
       * Planning and running are separate screens. Once the round exists it
       * belongs on its detail page, which is the only place it can be
       * started, progressed and completed.
       */
      router.push(`/routes/${current.id}`);
    } catch (caught) {
      setError(describeRouteError(caught));
    } finally {
      setSaving(false);
    }
  }

  async function optimise(): Promise<void> {
    if (!route) {
      setError('Save the round before optimising it.');

      return;
    }

    setOptimizing(true);
    setError(null);

    try {
      /* The server owns the ordering; its result replaces the local one. */
      const optimised = await optimizeRoute(route.id);

      setRoute(optimised);
      setNotice('Order optimised.');
    } catch (caught) {
      setError(describeRouteError(caught));
    } finally {
      setOptimizing(false);
    }
  }

  if (!teamId) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Plan a round" />

        <Alert tone="info" title="This view is scoped to a team.">
          Switch to a team workspace to plan a field round.
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Plan a round"
        subtitle="Build an efficient field visit route from your assigned prospects"
        action={
          <Button
            loading={saving}
            disabled={stops.length === 0 || !teamId}
            onClick={() => void save()}
          >
            {route ? 'Update route' : 'Save route'}
          </Button>
        }
      />

      {notice ? <Alert tone="success">{notice}</Alert> : null}

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
        <div className="flex flex-col gap-5">
          <ProspectMap points={stopPoints} />

          <Card>
            <CardHeader title="Add prospects" />

            <SearchInput
              label="Search your portfolio"
              placeholder="Search your portfolio..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            {available === null ? (
              <div className="mt-4 flex flex-col gap-2" aria-busy="true">
                {[0, 1, 2].map((row) => (
                  <div key={row} className="h-12 animate-pulse rounded-lg bg-line-soft" />
                ))}
              </div>
            ) : selectable.length === 0 ? (
              <p className="mt-6 text-center text-[15px] text-ink-muted">
                {search ? 'No prospects match your search.' : 'Every prospect is already a stop.'}
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-2">
                {selectable.slice(0, 12).map((item) => (
                  <li
                    key={item.campaignProspectId}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-line-soft px-3 py-2.5"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold text-navy">
                        {item.establishment.name}
                      </span>

                      <span className="block truncate text-[13px] text-ink-muted">
                        {item.establishment.city ?? '—'}
                      </span>
                    </span>

                    <LifecycleBadge stage={item.lifecycleStage} />

                    <Button
                      variant="secondary"
                      size="md"
                      disabled={stops.length >= MAX_ROUTE_STOPS}
                      onClick={() => setStops((current) => [...current, item])}
                    >
                      Add stop
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card>
          <CardHeader title="Route stops" />

          <p className="-mt-3 mb-4 text-[14px] text-ink-muted">
            {stops.length} stop{stops.length === 1 ? '' : 's'} · {stopPoints.length} plotted ·{' '}
            {formatDistance(route?.totalDistanceMeters)} ·{' '}
            {formatDuration(route?.totalDurationSeconds)}
          </p>

          {stops.length === 0 ? (
            <p className="py-8 text-center text-[15px] text-ink-muted">
              Add prospects to build the order of your round.
            </p>
          ) : (
            <ol className="flex flex-col gap-2.5">
              {stops.map((stop, index) => (
                <li
                  key={stop.campaignProspectId}
                  className="flex items-center gap-3 rounded-lg border border-line-soft px-3 py-3"
                >
                  <GripVertical aria-hidden="true" className="size-4 shrink-0 text-line" />

                  <span
                    aria-hidden="true"
                    className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand text-[13px] font-bold text-white"
                  >
                    {index + 1}
                  </span>

                  <span className="min-w-0 flex-1">
                    <Link
                      href={`/work-queue/${stop.campaign.id}/${stop.campaignProspectId}`}
                      className="block truncate text-[15px] font-semibold text-navy hover:text-brand"
                    >
                      {stop.establishment.name}
                    </Link>

                    <span className="block truncate text-[13px] text-ink-muted">
                      {stop.establishment.city ?? '—'}
                    </span>
                  </span>

                  <span className="flex shrink-0 flex-col">
                    <button
                      type="button"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      aria-label={`Move ${stop.establishment.name} earlier`}
                      className="text-ink-muted hover:text-ink disabled:opacity-40"
                    >
                      <ChevronUp aria-hidden="true" className="size-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      disabled={index === stops.length - 1}
                      aria-label={`Move ${stop.establishment.name} later`}
                      className="text-ink-muted hover:text-ink disabled:opacity-40"
                    >
                      <ChevronDown aria-hidden="true" className="size-4" />
                    </button>
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setStops((current) =>
                        current.filter(
                          (entry) => entry.campaignProspectId !== stop.campaignProspectId,
                        ),
                      )
                    }
                    aria-label={`Remove ${stop.establishment.name}`}
                    className="shrink-0 text-ink-muted hover:text-danger"
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                  </button>
                </li>
              ))}
            </ol>
          )}

          <Button
            variant="secondary"
            fullWidth
            className="mt-5"
            loading={optimizing}
            disabled={!route}
            title={route ? undefined : 'Save the round first'}
            onClick={() => void optimise()}
          >
            Optimise order
          </Button>
        </Card>
      </div>
    </div>
  );
}

function describeRouteError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return 'Something went wrong. Please try again.';
  }

  if (error.statusCode === 409) {
    return 'This round changed elsewhere. Reload before saving again.';
  }

  if (error.statusCode === 403) {
    return 'You are not authorized to plan rounds for this team.';
  }

  if (error.statusCode === 400) {
    return 'A stop could not be added. Check that every prospect is still assigned to you.';
  }

  return 'We could not save this round. Please try again.';
}
