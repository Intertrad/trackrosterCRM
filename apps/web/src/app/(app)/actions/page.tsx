'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, CircleDot, CircleSlash, History } from 'lucide-react';

import { ActionChannelIcon } from '@/components/prospector/action-channel-icon';
import { ActionHistoryDrawer } from '@/components/prospector/action-history-drawer';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { FilterSelect } from '@/components/ui/filter-select';
import { PageHeader } from '@/components/ui/page-header';
import { SearchInput } from '@/components/ui/search-input';
import { StatTile } from '@/components/ui/stat-tile';
import { listActions } from '@/lib/api/action-client';
import {
  actionTypeLabel,
  canCancelAction,
  canCorrectAction,
  toActionChannel,
  type ActionLifecycleStatus,
  type ActionRecord,
  type ActionStatus,
} from '@/lib/api/action-types';
import { ApiError } from '@/lib/api/api-error';
import { listWorkQueue } from '@/lib/api/work-queue-client';
import type { WorkQueueItem } from '@/lib/api/work-queue-types';
import { useAuth } from '@/lib/auth/auth-context';

export default function ActionsPage() {
  const { activeWorkspace } = useAuth();
  const teamId = activeWorkspace?.teamId ?? null;

  const [actions, setActions] = useState<ActionRecord[] | null>(null);
  const [status, setStatus] = useState<ActionLifecycleStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [prospects, setProspects] = useState<Map<string, WorkQueueItem>>(new Map());
  const [selected, setSelected] = useState<ActionRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    (signal?: AbortSignal): Promise<void> =>
      listActions({ limit: 100, ...(status === 'all' ? {} : { status }) }, signal)
        .then((page) => {
          if (!signal?.aborted) {
            setActions(page.items);
            setError(null);
          }
        })
        .catch((caught: unknown) => {
          if (!signal?.aborted) {
            setActions([]);
            setError(describeError(caught));
          }
        }),
    [status],
  );

  useEffect(() => {
    const controller = new AbortController();

    void load(controller.signal);

    return () => controller.abort();
  }, [load]);

  /* An action names its prospect by id only. */
  useEffect(() => {
    if (!teamId) {
      return;
    }

    const controller = new AbortController();

    listWorkQueue({ teamId, limit: 100, signal: controller.signal })
      .then((page) =>
        setProspects(new Map(page.items.map((item) => [item.campaignProspectId, item]))),
      )
      .catch(() => setProspects(new Map()));

    return () => controller.abort();
  }, [teamId]);

  const visible = useMemo(() => {
    if (!actions) {
      return [];
    }

    const query = search.trim().toLowerCase();

    if (query === '') {
      return actions;
    }

    return actions.filter((action) => {
      const prospect = prospects.get(action.campaignProspectId);

      return `${action.subject} ${prospect?.establishment.name ?? ''}`
        .toLowerCase()
        .includes(query);
    });
  }, [actions, prospects, search]);

  const counts = useMemo(() => {
    const all = actions ?? [];

    return {
      open: all.filter((action) => canCancelAction(action.status)).length,
      completed: all.filter((action) => action.status === 'completed').length,
      cancelled: all.filter((action) => action.status === 'cancelled').length,
      correctable: all.filter((action) => canCorrectAction(action.status)).length,
    };
  }, [actions]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Logged actions"
        subtitle="Everything you have logged, and how to put it right"
      />

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={<CircleDot aria-hidden="true" className="size-5" />}
          tone="brand"
          value={actions === null ? null : counts.open}
          label="Open"
        />

        <StatTile
          icon={<CheckCircle2 aria-hidden="true" className="size-5" />}
          tone="success"
          value={actions === null ? null : counts.completed}
          label="Completed"
        />

        <StatTile
          icon={<History aria-hidden="true" className="size-5" />}
          tone="neutral"
          value={actions === null ? null : counts.correctable}
          label="Correctable"
          delta="Completed actions can be amended"
        />

        <StatTile
          icon={<CircleSlash aria-hidden="true" className="size-5" />}
          tone="neutral"
          value={actions === null ? null : counts.cancelled}
          label="Cancelled"
        />
      </div>

      <Card>
        <CardHeader
          title="Actions"
          action={
            <FilterSelect
              label="Status"
              value={status}
              options={[
                { value: 'all', label: 'All' },
                { value: 'planned', label: 'Planned' },
                { value: 'started', label: 'In progress' },
                { value: 'completed', label: 'Completed' },
                { value: 'cancelled', label: 'Cancelled' },
              ]}
              onChange={(value) => setStatus(value as ActionLifecycleStatus | 'all')}
            />
          }
        />

        <SearchInput
          label="Search actions"
          placeholder="Search by subject or establishment…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        {actions === null ? (
          <div className="mt-5 flex flex-col gap-2" aria-busy="true">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="h-16 animate-pulse rounded-lg bg-line-soft" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <p className="py-10 text-center text-[15px] text-ink-muted">
            {actions.length === 0
              ? 'You have not logged any actions yet.'
              : 'No actions match this search.'}
          </p>
        ) : (
          <ul className="mt-5 flex flex-col divide-y divide-line-soft">
            {visible.map((action) => {
              const prospect = prospects.get(action.campaignProspectId);

              return (
                <li
                  key={action.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2.5 py-3.5"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-ink-muted"
                  >
                    <ActionChannelIcon channel={toActionChannel(action.type)} />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-navy">
                      {action.subject}
                    </span>

                    <span className="block truncate text-[13px] text-ink-muted">
                      {actionTypeLabel(action.type)}
                      {prospect ? (
                        <>
                          {' · '}
                          <Link
                            href={`/work-queue/${action.campaignId}/${action.campaignProspectId}`}
                            className="text-brand hover:underline"
                          >
                            {prospect.establishment.name}
                          </Link>
                        </>
                      ) : null}
                      {action.completedAt ? ` · ${formatDate(action.completedAt)}` : ''}
                    </span>
                  </span>

                  {action.outcomeCode ? (
                    <Badge tone="neutral">{action.outcomeCode.replace(/_/g, ' ')}</Badge>
                  ) : null}

                  <StatusBadge status={action.status} />

                  <Button variant="secondary" onClick={() => setSelected(action)}>
                    <History aria-hidden="true" className="mr-1.5 size-4" />
                    History
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        <Alert tone="info" className="mt-5" title="Corrections are additive.">
          Amending a completed action appends the correction; the original entry stays in the
          history so the record shows both.
        </Alert>
      </Card>

      <ActionHistoryDrawer
        actionId={selected?.id ?? null}
        status={selected?.status ?? null}
        onClose={() => setSelected(null)}
        onChanged={() => void load()}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: ActionStatus }) {
  switch (status) {
    case 'completed':
      return <Badge tone="success">Completed</Badge>;
    case 'cancelled':
      return <Badge tone="neutral">Cancelled</Badge>;
    case 'in_progress':
      return (
        <Badge tone="brand" dot>
          In progress
        </Badge>
      );
    case 'overdue':
      return (
        <Badge tone="danger" dot>
          Overdue
        </Badge>
      );
    default:
      return <Badge tone="warning">Planned</Badge>;
  }
}

function formatDate(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function describeError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return 'Something went wrong. Please try again.';
  }

  if (error.statusCode === 403) {
    return 'You are not authorized to see these actions.';
  }

  return 'We could not load your actions. Please try again.';
}
