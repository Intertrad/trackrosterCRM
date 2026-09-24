'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { MapPin, Route as RouteIcon } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { FilterSelect } from '@/components/ui/filter-select';
import { LinkButton } from '@/components/ui/link-button';
import { PageHeader } from '@/components/ui/page-header';
import { ApiError } from '@/lib/api/api-error';
import { listRoutes } from '@/lib/api/route-client';
import {
  formatDistance,
  formatDuration,
  type FieldRoute,
  type RouteStatus,
} from '@/lib/api/route-types';
import { useAuth } from '@/lib/auth/auth-context';

export default function RoutesPage() {
  const { activeWorkspace } = useAuth();
  const teamId = activeWorkspace?.teamId ?? null;

  const [routes, setRoutes] = useState<FieldRoute[] | null>(null);
  const [status, setStatus] = useState<'all' | RouteStatus>('all');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    (signal?: AbortSignal): Promise<void> => {
      if (!teamId) {
        return Promise.resolve();
      }

      return listRoutes({ teamId, limit: 50, ...(status === 'all' ? {} : { status }) }, signal)
        .then((page) => {
          if (!signal?.aborted) {
            setRoutes(page.items);
            setError(null);
          }
        })
        .catch((caught: unknown) => {
          if (!signal?.aborted) {
            setRoutes([]);
            setError(describeRouteError(caught));
          }
        });
    },
    [status, teamId],
  );

  useEffect(() => {
    const controller = new AbortController();

    void load(controller.signal);

    return () => controller.abort();
  }, [load]);

  if (!teamId) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Routes" />

        <Alert tone="info" title="Routes are a team view.">
          Switch to a team workspace to see your field rounds.
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Routes"
        subtitle="Plan, run and review your field rounds"
        action={<LinkButton href="/routes/new">Plan a round</LinkButton>}
      />

      <Card>
        <FilterSelect
          label="Status"
          value={status}
          options={[
            { value: 'all', label: 'All' },
            { value: 'draft', label: 'Planned' },
            { value: 'active', label: 'In progress' },
            { value: 'completed', label: 'Completed' },
            { value: 'cancelled', label: 'Cancelled' },
          ]}
          onChange={(value) => setStatus(value as 'all' | RouteStatus)}
        />

        {error ? (
          <Alert tone="danger" className="mt-5">
            {error}
          </Alert>
        ) : null}

        {routes === null ? (
          <div className="mt-5 flex flex-col gap-2" aria-busy="true">
            {[0, 1, 2].map((row) => (
              <div key={row} className="h-16 animate-pulse rounded-lg bg-line-soft" />
            ))}
          </div>
        ) : routes.length === 0 ? (
          <div className="py-12 text-center">
            <RouteIcon aria-hidden="true" className="mx-auto size-8 text-line" />

            <p className="mt-3 text-[16px] font-semibold text-navy">
              {status === 'all' ? 'No rounds yet' : 'No rounds with this status'}
            </p>

            <p className="mx-auto mt-2 max-w-md text-[15px] text-ink-muted">
              Plan a round to group nearby prospects into an efficient field visit.
            </p>

            <LinkButton href="/routes/new" className="mt-5">
              Plan a round
            </LinkButton>
          </div>
        ) : (
          <ul className="mt-5 flex flex-col divide-y divide-line-soft">
            {routes.map((route) => (
              <li key={route.id}>
                <Link
                  href={`/routes/${route.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5 hover:opacity-80"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-navy">
                      {route.name}
                    </span>

                    <span className="flex flex-wrap items-center gap-x-2 text-[13px] text-ink-muted">
                      <MapPin aria-hidden="true" className="size-3.5" />
                      {route.stops?.length ?? 0} stop
                      {(route.stops?.length ?? 0) === 1 ? '' : 's'} ·{' '}
                      {formatDistance(route.totalDistanceMeters)} ·{' '}
                      {formatDuration(route.totalDurationSeconds)} ·{' '}
                      {formatScheduled(route.scheduledAt)}
                    </span>
                  </span>

                  <RouteStatusBadge status={route.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export function RouteStatusBadge({ status }: { status: RouteStatus }) {
  switch (status) {
    case 'active':
      return (
        <Badge tone="brand" dot>
          In progress
        </Badge>
      );
    case 'completed':
      return <Badge tone="success">Completed</Badge>;
    case 'cancelled':
      return <Badge tone="neutral">Cancelled</Badge>;
    default:
      return <Badge tone="warning">Planned</Badge>;
  }
}

export function formatScheduled(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString(undefined, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
}

export function describeRouteError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return 'Something went wrong. Please try again.';
  }

  if (error.statusCode === 409 || error.statusCode === 412) {
    return 'This round changed elsewhere. Reload before trying again.';
  }

  if (error.statusCode === 403) {
    return 'You are not authorized to manage rounds for this team.';
  }

  if (error.statusCode === 400) {
    return error.messages.join(' ');
  }

  return 'We could not load your rounds. Please try again.';
}
