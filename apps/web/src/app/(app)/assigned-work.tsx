'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Building2, CalendarClock } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ApiError } from '@/lib/api/api-error';
import { listWorkQueue } from '@/lib/api/work-queue-client';
import { classifyFollowUp } from '@/lib/follow-ups/due';
import { cn } from '@/lib/ui/cn';
import type { WorkQueueItem, WorkQueueLifecycleStage } from '@/lib/api/work-queue-types';

/*
 * The prospector's own assigned work.
 *
 * Ma journée used to show only the day's follow-ups, because that is what
 * `prospector/today` returns — its priorities are built from prospect_follow_ups
 * alone. A prospect an administrator assigned this morning has no follow-up yet, so
 * it appeared nowhere and the day read as empty. This is the other half: the
 * prospects that are actually the caller's.
 *
 * It is not a search screen. The list is the caller's own assignments from
 * `/work-queue`, which is scoped to their team and their user id upstream, so
 * nothing here can reach another prospector's portfolio or the wider référentiel.
 */

/* A day's worth. The full portfolio has its own screen. */
const PAGE_SIZE = 25;

const STAGE_LABEL: Record<WorkQueueLifecycleStage, string> = {
  to_contact: 'To contact',
  contact_made: 'Contact made',
  in_progress: 'In progress',
  follow_up: 'Follow-up',
  qualified: 'Qualified',
  converted: 'Converted',
};

/*
 * Only what the API can actually answer. `to_contact` is the stage the endpoint
 * filters on; "overdue" and "priority" belong to follow-ups and are already
 * answered by the day's priorities above, so inventing them here would be two
 * definitions of the same word.
 */
type View = 'all' | 'to_contact';

export function AssignedWork({ teamId }: { teamId: string }) {
  const [items, setItems] = useState<WorkQueueItem[] | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [view, setView] = useState<View>('all');
  const [failed, setFailed] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      setItems(null);
      setFailed(null);

      try {
        const page = await listWorkQueue({
          teamId,
          ...(view === 'to_contact' ? { lifecycleStage: 'to_contact' as const } : {}),
          limit: PAGE_SIZE,
          signal,
        });

        if (signal?.aborted) {
          return;
        }

        setItems(page.items);
        setTruncated(page.page.nextCursor !== null);
      } catch (caught) {
        if (signal?.aborted) {
          return;
        }

        setFailed(
          caught instanceof ApiError && caught.statusCode === 403
            ? 'This team is no longer yours to work.'
            : 'We could not load your prospects.',
        );
      }
    },
    [teamId, view],
  );

  useEffect(() => {
    const controller = new AbortController();

    void load(controller.signal);

    return () => controller.abort();
  }, [load, attempt]);

  return (
    <Card className="p-0 sm:p-0">
      <div className="flex flex-wrap items-center gap-3 px-5 py-4 sm:px-6">
        <h2 className="text-[22px] font-bold tracking-[-0.02em] text-navy">My prospects</h2>

        {items ? <Badge tone="neutral">{items.length}</Badge> : null}

        <div className="ml-auto flex gap-1.5">
          {(['all', 'to_contact'] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={view === option}
              onClick={() => setView(option)}
              className={
                view === option
                  ? 'min-h-11 rounded-full bg-brand px-4 text-[14px] font-semibold text-white'
                  : 'min-h-11 rounded-full border border-line px-4 text-[14px] font-semibold text-ink hover:border-brand-pale'
              }
            >
              {option === 'all' ? 'All' : 'To contact'}
            </button>
          ))}
        </div>
      </div>

      {failed ? (
        <div className="flex flex-col items-start gap-3 px-5 pb-5 sm:px-6">
          <Alert tone="warning">{failed}</Alert>

          <Button variant="secondary" onClick={() => setAttempt((count) => count + 1)}>
            Retry
          </Button>
        </div>
      ) : items === null ? (
        <div
          className="animate-pulse divide-y divide-line-soft border-t border-line-soft"
          aria-busy="true"
          aria-live="polite"
        >
          <span className="sr-only">Loading your prospects</span>

          {[0, 1, 2].map((row) => (
            <div key={row} className="px-5 py-4 sm:px-6">
              <div className="h-4 w-2/3 rounded bg-surface-muted" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="px-6 py-12 text-center text-[15px] text-ink-muted">
          {view === 'to_contact'
            ? 'Nothing left to contact for the first time.'
            : 'No prospect is assigned to you yet. Your manager assigns the day&rsquo;s work.'}
        </p>
      ) : (
        <ul className="divide-y divide-line-soft border-t border-line-soft">
          {items.map((item) => (
            <WorkRow key={item.campaignProspectId} item={item} />
          ))}
        </ul>
      )}

      {truncated ? (
        <p className="px-5 pb-5 text-[13px] text-ink-muted sm:px-6">
          Showing your {PAGE_SIZE} most recent assignments.
        </p>
      ) : null}
    </Card>
  );
}

/*
 * One row, sized for a thumb. The whole row is the link rather than a small
 * chevron, so opening a prospect on a phone does not need precision.
 */
function WorkRow({ item }: { item: WorkQueueItem }) {
  const href = `/work-queue/${item.campaign.id}/${item.campaignProspectId}`;

  return (
    <li>
      <a
        href={href}
        className="flex min-h-16 items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-muted sm:px-6"
      >
        <span className="shrink-0 text-ink-muted">
          <Building2 aria-hidden="true" className="size-5" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-navy">
            {item.establishment.name}
          </span>

          <span className="block truncate text-[13px] text-ink-muted">
            {[
              [item.establishment.postalCode, item.establishment.city].filter(Boolean).join(' '),
              item.campaign.name,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </span>

        {/*
         * A pending follow-up is why this one might be urgent, and whether it is
         * late is decided by the same classifier the follow-up list uses — so a
         * prospect cannot read as overdue on one screen and on time on the other.
         */}
        {item.nextFollowUp ? (
          <span
            className={cn(
              'flex shrink-0 items-center gap-1 text-[13px] font-semibold',
              classifyFollowUp({ dueAt: item.nextFollowUp.dueAt, status: 'pending' }) === 'overdue'
                ? 'text-danger'
                : 'text-warning',
            )}
          >
            <CalendarClock aria-hidden="true" className="size-4" />
            {/* Stated, not carried by colour. */}
            <span className="sr-only">
              {classifyFollowUp({ dueAt: item.nextFollowUp.dueAt, status: 'pending' }) === 'overdue'
                ? 'Follow-up overdue since '
                : 'Follow-up due '}
            </span>
            {formatDay(item.nextFollowUp.dueAt)}
          </span>
        ) : null}

        {/* Stage in words, not by colour. */}
        <Badge tone={item.lifecycleStage === 'to_contact' ? 'brand' : 'neutral'}>
          {STAGE_LABEL[item.lifecycleStage]}
        </Badge>

        <span className="shrink-0 text-ink-muted">
          <ArrowRight aria-hidden="true" className="size-4" />
        </span>
      </a>
    </li>
  );
}

function formatDay(iso: string): string {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
