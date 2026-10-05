'use client';

import { useLiveRefresh } from '@/lib/live/use-live-refresh';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, X } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { LinkButton } from '@/components/ui/link-button';
import { PageHeader } from '@/components/ui/page-header';
import { SearchInput } from '@/components/ui/search-input';
import { TextField } from '@/components/ui/text-field';
import { ApiError } from '@/lib/api/api-error';
import {
  cancelProspectFollowUp,
  completeProspectFollowUp,
  listFollowUpQueue,
  rescheduleProspectFollowUp,
} from '@/lib/api/follow-up-client';
import { requestFollowUpReview } from '@/lib/api/follow-up-review-client';
import type { FollowUpQueueItem } from '@/lib/api/follow-up-types';
import { useAuth } from '@/lib/auth/auth-context';
import { classifyFollowUp, compareByDue, endOfLocalDay, isAppointment } from '@/lib/follow-ups/due';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { cn } from '@/lib/ui/cn';

/*
 * The three groups a prospector actually works from, plus the settled history.
 * They are derived from one classified dataset rather than fetched per tab, so a
 * count and the list beneath it cannot come from different conditions.
 */
type TabId = 'review' | 'overdue' | 'today' | 'upcoming' | 'completed';

export default function ActionsPage() {
  const { activeWorkspace } = useAuth();
  const { t } = useTranslation();
  const teamId = activeWorkspace?.teamId ?? null;

  const [tab, setTab] = useState<TabId>('overdue');

  /* The follow-up being rescheduled, or null when the dialog is closed. */
  const [rescheduling, setRescheduling] = useState<FollowUpQueueItem | null>(null);

  /*
   * Grouping happens over the fetched set, so if it is full the groups describe the
   * first hundred rather than everything. Said rather than left to be discovered.
   */
  const [truncated, setTruncated] = useState(false);
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<FollowUpQueueItem[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  /*
   * Read failures and action failures are tracked separately: reloading the
   * queue after a bulk write must not erase the report of which writes failed.
   */
  const [readError, setReadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /*
   * An idempotency key is minted once per follow-up and reused until that
   * write succeeds. A network failure is ambiguous — the server may already
   * have completed the follow-up — so retrying with a fresh key could apply
   * the same completion twice.
   */
  const idempotencyKeys = useRef(new Map<string, string>());

  const keyFor = useCallback((followUpId: string): string => {
    const existing = idempotencyKeys.current.get(followUpId);

    if (existing) {
      return existing;
    }

    const key = crypto.randomUUID();
    idempotencyKeys.current.set(followUpId, key);

    return key;
  }, []);

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      try {
        /*
         * Everything once, rather than a filtered request per tab. A prospector's
         * own follow-ups are naturally bounded — tens, not thousands — and one
         * dataset is what lets every count and every list come from the same
         * classification. The API's `overdue` filter is not used here for the same
         * reason: it would be a second definition of the word.
         */
        const response = await listFollowUpQueue({ teamId, limit: 100, signal });

        setTruncated(response.items.length >= 100);

        if (signal?.aborted) {
          return;
        }

        setItems(response.items);
        setReadError(null);
      } catch (caught) {
        if (signal?.aborted) {
          return;
        }

        setReadError(
          caught instanceof ApiError && caught.statusCode === 401
            ? t('today.sessionExpired')
            : t('actions.loadError'),
        );
      }
    },
    [teamId],
  );

  useLiveRefresh(load);

  useEffect(() => {
    const controller = new AbortController();

    setSelected(new Set());
    void load(controller.signal);

    return () => controller.abort();
  }, [load]);

  const classified = useMemo(() => {
    const now = new Date();
    const dayEnd = endOfLocalDay(now);

    /*
     * Classified once, shared with Ma journée. The counts and the rendered rows are
     * both read off this, so "count says 4, list shows 3" cannot happen — there is
     * only one condition.
     */
    return (items ?? []).map((item) => ({ item, state: classifyFollowUp(item, now, dayEnd) }));
  }, [items]);

  const counts = useMemo(
    () => ({
      review: classified.filter((row) => row.state === 'review').length,
      overdue: classified.filter((row) => row.state === 'overdue').length,
      today: classified.filter((row) => row.state === 'today').length,
      upcoming: classified.filter((row) => row.state === 'upcoming').length,
      /* Settled records are kept out of every active count. */
      completed: classified.filter((row) => row.state === 'completed').length,
    }),
    [classified],
  );

  /*
   * The rows for the chosen group, from the same classification the counts use, in
   * ascending due order — oldest first when late, soonest first otherwise.
   */
  const visible = useMemo(() => {
    const inGroup = classified
      .filter((row) => row.state === tab)
      .sort((left, right) => compareByDue(left.item, right.item))
      .map((row) => row.item);

    const query = search.trim().toLowerCase();

    if (!query) {
      return inGroup;
    }

    return inGroup.filter(
      (item) =>
        item.establishmentName.toLowerCase().includes(query) ||
        item.campaignName.toLowerCase().includes(query),
    );
  }, [classified, search, tab]);

  function toggle(id: string): void {
    setSelected((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  async function runBulk(action: 'complete' | 'cancel'): Promise<void> {
    if (selected.size === 0) {
      return;
    }

    setBusy(true);
    setActionError(null);
    setNotice(null);

    const targets = visible.filter((item) => selected.has(item.id));

    let succeeded = 0;

    /*
     * There is no bulk endpoint yet, so each follow-up is completed
     * individually with its own idempotency key. Failures are counted rather
     * than aborting the batch, so one rejected row cannot strand the rest.
     */
    for (const item of targets) {
      try {
        const request = {
          campaignId: item.campaignId,
          prospectId: item.prospectId,
          followUpId: item.id,
          teamId,
          idempotencyKey: keyFor(item.id),
        };

        if (action === 'complete') {
          await completeProspectFollowUp(request);
        } else {
          await cancelProspectFollowUp(request);
        }

        /* Only a confirmed success may retire the key. */
        idempotencyKeys.current.delete(item.id);
        succeeded += 1;
      } catch {
        /* Keep the key so a retry is the same logical write. */
      }
    }

    setBusy(false);
    setSelected(new Set());

    const verb = action === 'complete' ? 'completed' : 'cancelled';

    if (succeeded === targets.length) {
      setNotice(`${succeeded} action${succeeded === 1 ? '' : 's'} ${verb}.`);
    } else {
      setActionError(`${succeeded} of ${targets.length} actions ${verb}. Please retry the rest.`);
    }

    await load();
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <PageHeader
        title={t('actions.title')}
        subtitle={t('actions.subtitle')}
        action={
          /* The history of completed work and the round planner are no longer
             in the prospector sidebar, so this is where they are reached. */
          <div className="flex w-fit max-w-full flex-wrap gap-0.5 rounded-[11px] bg-surface-muted p-[3px]">
            <LinkButton href="/actions">{t('nav.loggedActions')}</LinkButton>

            <LinkButton href="/routes">{t('nav.routes')}</LinkButton>
          </div>
        }
      />

      {!teamId ? (
        <Alert tone="info">Showing follow-ups across the workspace as an administrator.</Alert>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <SearchInput
          label={t('actions.search')}
          placeholder={`${t('actions.search')}…`}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="min-w-[240px] flex-1"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: 'review', label: 'actions.tab.review' },
            { id: 'overdue', label: 'actions.tab.overdue' },
            { id: 'today', label: 'actions.tab.today' },
            { id: 'upcoming', label: 'actions.tab.upcoming' },
            { id: 'completed', label: 'actions.tab.completed' },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            aria-pressed={tab === item.id}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[14px] font-semibold transition-colors',
              tab === item.id
                ? 'bg-surface text-navy shadow-sm'
                : 'bg-surface-muted text-ink-soft hover:text-ink',
            )}
          >
            {t(item.label)}

            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-[12px] font-bold',
                item.id === 'review' && counts.review > 0
                  ? 'bg-warning text-white'
                  : item.id === 'overdue' && counts.overdue > 0
                    ? 'bg-danger text-white'
                    : tab === item.id
                      ? 'bg-brand text-white'
                      : 'bg-line-soft text-ink-soft',
              )}
            >
              {counts[item.id]}
            </span>
          </button>
        ))}
      </div>

      {readError ? <Alert tone="danger">{readError}</Alert> : null}
      {actionError ? <Alert tone="danger">{actionError}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      {items === null ? (
        <QueueSkeleton />
      ) : visible.length === 0 ? (
        <Card>
          <div className="py-6 text-center">
            <CheckCircle2 aria-hidden="true" className="mx-auto size-9 text-success" />

            <p className="mt-3 text-[17px] font-bold text-navy">
              {t(search ? 'actions.noSearchMatch' : 'actions.emptyList')}
            </p>

            <p className="mt-1 text-[14px] text-ink-muted">
              {/* Each group says what is empty; one generic line would not. */}
              {t(
                tab === 'review'
                  ? 'actions.empty.review'
                  : tab === 'overdue'
                    ? 'actions.empty.overdue'
                    : tab === 'today'
                      ? 'actions.empty.today'
                      : tab === 'upcoming'
                        ? 'actions.empty.upcoming'
                        : 'actions.emptyBody',
              )}
            </p>
          </div>
        </Card>
      ) : (
        <div>
          <ul className="space-y-2">
            {visible.map((item) => (
              <ActionRow
                key={item.id}
                item={item}
                selected={selected.has(item.id)}
                onToggle={() => toggle(item.id)}
                onReschedule={() => setRescheduling(item)}
              />
            ))}
          </ul>
        </div>
      )}

      {selected.size > 0 ? (
        <div
          role="region"
          aria-label={t('actions.bulk')}
          className="sticky bottom-20 z-20 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-raised lg:bottom-6"
        >
          <span className="text-[15px] font-semibold text-navy">
            {t(selected.size === 1 ? 'actions.selected.one' : 'actions.selected', {
              count: selected.size,
            })}
          </span>

          <Button
            variant="secondary"
            size="md"
            loading={busy}
            leadingIcon={<CheckCircle2 aria-hidden="true" className="size-[18px]" />}
            onClick={() => void runBulk('complete')}
          >
            {t('actions.markCompleted')}
          </Button>

          <Button
            variant="secondary"
            size="md"
            loading={busy}
            onClick={() => void runBulk('cancel')}
          >
            {t('actions.cancelActions')}
          </Button>

          <button
            type="button"
            onClick={() => setSelected(new Set())}
            aria-label={t('actions.clearSelection')}
            className="ml-auto text-ink-muted hover:text-ink"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
      ) : null}
      {truncated ? <p className="text-[13px] text-ink-muted">{t('actions.truncated')}</p> : null}

      {/*
       * Reschedule uses the shared Dialog, which already traps focus, restores it to
       * the trigger on close and answers Escape.
       */}
      <RescheduleDialog
        followUp={rescheduling}
        teamId={teamId ?? ''}
        onClose={() => setRescheduling(null)}
        onRescheduled={() => {
          setRescheduling(null);
          /* Server truth, so the card moves group because the server says so. */
          void load();
        }}
        onReviewRequested={() => {
          setRescheduling(null);
          setNotice(t('actions.reschedule.reviewRequested'));
          void load();
        }}
      />
    </div>
  );
}

/*
 * Moving a follow-up to a new moment.
 *
 * The date and time are read in the reader's own zone and combined into one
 * instant, which is what the API stores and what the shared classifier then reads
 * back — one conversion path, so a follow-up rescheduled to this afternoon
 * classifies as today rather than landing a day out.
 */
function RescheduleDialog({
  followUp,
  teamId,
  onClose,
  onRescheduled,
  onReviewRequested,
}: {
  followUp: FollowUpQueueItem | null;
  teamId: string;
  onClose: () => void;
  onRescheduled: () => void;
  onReviewRequested: () => void;
}) {
  const { t } = useTranslation();

  const [date, setDate] = useState('');
  const [time, setTime] = useState('10:00');
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* One key per dialog opening, reused across retries of the same intent. */
  const idempotencyKey = useMemo(() => (followUp ? crypto.randomUUID() : ''), [followUp]);

  useEffect(() => {
    if (!followUp) {
      return;
    }

    const due = new Date(followUp.dueAt);

    setDate(Number.isNaN(due.getTime()) ? '' : toDateInput(due));
    setTime(Number.isNaN(due.getTime()) ? '10:00' : toTimeInput(due));
    setReason('');
    setError(null);
  }, [followUp]);

  const overdue = followUp ? classifyFollowUp(followUp) === 'overdue' : false;

  async function confirm(): Promise<void> {
    if (!followUp || !date) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      const dueAt = new Date(`${date}T${time}`).toISOString();

      if (overdue) {
        if (reason.trim().length < 10) {
          setError(t('actions.reschedule.reasonRequired'));
          return;
        }

        await requestFollowUpReview({
          campaignId: followUp.campaignId,
          prospectId: followUp.prospectId,
          followUpId: followUp.id,
          dueAt,
          reason,
          idempotencyKey,
        });

        onReviewRequested();
      } else {
        await rescheduleProspectFollowUp({
          campaignId: followUp.campaignId,
          prospectId: followUp.prospectId,
          followUpId: followUp.id,
          teamId,
          /* Local wall time to an instant, once. */
          dueAt,
          idempotencyKey,
        });

        onRescheduled();
      }
    } catch (caught) {
      /*
       * The dialog stays open and the follow-up keeps its current date. Nothing was
       * moved locally, so there is no optimistic state to unwind.
       */
      setError(
        caught instanceof ApiError && caught.messages.length > 0 && caught.messages[0]
          ? caught.messages[0]
          : t('actions.reschedule.failed'),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={followUp !== null}
      title={t('actions.reschedule.title')}
      description={followUp ? followUp.establishmentName : undefined}
      tone={overdue ? 'danger' : 'default'}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            {t('common.cancel')}
          </Button>

          {/* Disabled while in flight, so repeated taps cannot send two PATCHes. */}
          <Button
            loading={pending}
            disabled={pending || !date || (overdue && reason.trim().length < 10)}
            onClick={() => void confirm()}
          >
            {t(overdue ? 'actions.reschedule.requestReview' : 'actions.reschedule.confirm')}
          </Button>
        </>
      }
    >
      {followUp ? (
        <div className="flex flex-col gap-4">
          {overdue ? (
            <Alert tone="danger" title={t('actions.status.overdue')}>
              {t('actions.reschedule.overdueWarning')}
            </Alert>
          ) : null}

          <p className="text-[14px] text-ink-muted">
            {t('actions.reschedule.current')}: {formatDate(followUp.dueAt)}{' '}
            {formatTime(followUp.dueAt)}
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              label={t('actions.reschedule.newDate')}
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />

            <TextField
              label={t('actions.reschedule.newTime')}
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
            />
          </div>

          {overdue ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="follow-up-missed-reason" className="text-[13px] font-bold text-ink">
                {t('actions.reschedule.missedReason')}
              </label>
              <textarea
                id="follow-up-missed-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={t('actions.reschedule.missedReasonHint')}
                rows={4}
                maxLength={2000}
                className="w-full resize-y rounded-[9px] border border-line bg-surface px-3.5 py-3 text-[14.4px] text-ink placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-brand/30"
              />
              <p className="text-[12px] text-ink-muted">{reason.length}/2000</p>
            </div>
          ) : null}

          {error ? <Alert tone="danger">{error}</Alert> : null}
        </div>
      ) : null}
    </Dialog>
  );
}

/* Local calendar date for a date input, not the UTC one. */
function toDateInput(value: Date): string {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, '0'),
    String(value.getDate()).padStart(2, '0'),
  ].join('-');
}

function toTimeInput(value: Date): string {
  return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
}

function ActionRow({
  item,
  selected,
  onToggle,
  onReschedule,
}: {
  item: FollowUpQueueItem;
  selected: boolean;
  onToggle: () => void;
  onReschedule: () => void;
}) {
  const { t } = useTranslation();

  /* The shared classifier, so this row and the counts above cannot disagree. */
  const state = classifyFollowUp(item);
  const overdue = state === 'overdue';
  const underReview = state === 'review';

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-surface px-4 py-3">
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        aria-label={t('actions.select', { name: item.establishmentName })}
        className="size-[18px] shrink-0 cursor-pointer appearance-none rounded-[5px] border border-line bg-surface checked:border-brand checked:bg-brand"
      />

      <span
        className={cn('w-24 shrink-0 text-[14px] font-bold', overdue ? 'text-danger' : 'text-ink')}
      >
        {formatDate(item.dueAt)}

        <span className="block text-[13px] font-medium text-ink-muted">
          {underReview
            ? t('actions.status.review')
            : overdue
              ? t('actions.status.overdue')
              : formatTime(item.dueAt)}
        </span>
      </span>

      <span className="min-w-0 flex-1 basis-48">
        <Link
          href={`/work-queue/${item.campaignId}/${item.prospectId}`}
          className="block truncate text-[15px] font-bold text-navy hover:text-brand"
        >
          {item.establishmentName}
        </Link>

        <span className="block truncate text-[14px] text-ink-muted">{item.campaignName}</span>
      </span>

      <Badge tone={item.ownership === 'team' ? 'brand' : 'neutral'} className="shrink-0">
        {t(item.ownership === 'team' ? 'actions.owner.team' : 'actions.owner.you')}
      </Badge>

      {/*
       * An appointment keeps its time group and is marked here instead. Moving every
       * meeting into a bucket of its own would hide an overdue one from Overdue,
       * which is the list it most needs to be in.
       */}
      {isAppointment(item) ? (
        <Badge tone="brand" className="shrink-0">
          {t('actions.appointment')}
        </Badge>
      ) : null}

      {/* The channel the next action is meant to use, when one was recorded. */}
      {item.channel ? (
        <span className="shrink-0 text-[13px] text-ink-muted capitalize">{item.channel}</span>
      ) : null}

      <Badge
        tone={
          underReview
            ? 'warning'
            : overdue
              ? 'danger'
              : item.status === 'completed'
                ? 'success'
                : 'neutral'
        }
      >
        {t(
          underReview
            ? 'actions.status.review'
            : item.status === 'completed'
              ? 'actions.status.completed'
              : overdue
                ? 'actions.status.overdue'
                : 'actions.status.open',
        )}
      </Badge>

      {/*
       * Only a pending follow-up can be moved. A completed or cancelled one is
       * settled, and the API offers no reopening.
       */}
      {item.status === 'pending' && !underReview ? (
        <Button variant="secondary" className="shrink-0" onClick={onReschedule}>
          {t('actions.reschedule')}
        </Button>
      ) : null}
    </li>
  );
}

function QueueSkeleton() {
  const { t } = useTranslation();

  return (
    <Card className="p-0 sm:p-0" aria-busy="true">
      <span className="sr-only">{t('actions.loading')}</span>

      <ul className="divide-y divide-line-soft">
        {[0, 1, 2, 3, 4].map((row) => (
          <li key={row} className="flex animate-pulse items-center gap-4 px-6 py-5">
            <span className="size-[18px] rounded bg-line-soft" />
            <span className="h-5 w-20 rounded bg-line-soft" />
            <span className="h-5 flex-1 rounded bg-line-soft" />
            <span className="h-6 w-20 rounded-md bg-line-soft" />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short' }).format(date);
}

function formatTime(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(date);
}
