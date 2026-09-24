'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, CircleAlert, CircleDot, MapPinned, Navigation, X } from 'lucide-react';

import { ActionChannelIcon, getChannelLabel } from '@/components/prospector/action-channel-icon';
import {
  type DueState,
  DueStateBadge,
  countsAsDueToday,
  resolveDueState,
} from '@/components/prospector/due-state-badge';
import { PriorityRowMenu } from '@/components/prospector/priority-row-menu';
import { TodayControls } from '@/components/prospector/today-controls';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LinkButton } from '@/components/ui/link-button';
import { PageHeader } from '@/components/ui/page-header';
import { ProspectMap } from '@/components/prospector/prospect-map';
import { ApiError } from '@/lib/api/api-error';
import { listCollisionEvents } from '@/lib/api/collision-client';
import { reasonLabel, type CollisionEvent } from '@/lib/api/collision-types';
import { getProspectorToday } from '@/lib/api/prospector-today-client';
import {
  buildVisits,
  totalVisitKm,
  type ProspectorTodayPriority,
  type ProspectorTodayResponse,
} from '@/lib/api/prospector-today-types';
import { useAuth } from '@/lib/auth/auth-context';
import { getNavigationForWorkspace } from '@/lib/auth/navigation';
import { cn } from '@/lib/ui/cn';

type FilterId = 'all' | 'overdue' | 'due_today';

const CATEGORY_LABELS = {
  todo: 'To do',
  follow_up: 'Follow-up',
  meeting: 'Meeting',
} as const;

export default function TodayPage() {
  const { activeWorkspace } = useAuth();

  /*
   * "/" is Today for a prospector and an overview for every other role, so
   * the daily queue is only fetched for a prospector workspace.
   *
   * GET /prospector/today also requires a teamId: a tenant- or
   * organization-scoped grant has no team, so the screen says so rather than
   * firing a request the API will reject.
   */
  const isProspector = activeWorkspace?.mode === 'prospector';
  const teamId = isProspector ? (activeWorkspace?.teamId ?? null) : null;

  const [today, setToday] = useState<ProspectorTodayResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterId>('all');

  /*
   * Collisions are read once for the whole day rather than per prospect: a
   * per-row check would be one request per priority for information that is
   * only surfaced as a single banner.
   */
  const [collisions, setCollisions] = useState<CollisionEvent[]>([]);

  /* Dismissed for this visit only; the collision itself is not resolved by
   * closing the notice, so it is not persisted. */
  const [noticeDismissed, setNoticeDismissed] = useState(false);

  /*
   * "Due soon" is relative to the clock, so it has to be re-evaluated as the
   * day moves rather than frozen at the moment the page loaded.
   */
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);

    return () => clearInterval(timer);
  }, []);

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      if (!teamId) {
        return;
      }

      try {
        const response = await getProspectorToday({
          teamId,
          timeZone: getBrowserTimeZone(),
          signal,
        });

        if (signal?.aborted) {
          return;
        }

        setToday(response);
        setError(null);
      } catch (caught) {
        if (signal?.aborted) {
          return;
        }

        setError(
          caught instanceof ApiError && caught.statusCode === 401
            ? 'Your session has expired. Please sign in again.'
            : 'We could not load your day. Please try again.',
        );
      }
    },
    [teamId],
  );

  useEffect(() => {
    const controller = new AbortController();

    void load(controller.signal);

    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    if (!isProspector) {
      return;
    }

    const controller = new AbortController();

    /* A denial here is not an error for the page: a prospector without
     * collision-read access simply sees no banner. */
    listCollisionEvents({ limit: 50 }, controller.signal)
      .then((page) => setCollisions(page.items))
      .catch(() => setCollisions([]));

    return () => controller.abort();
  }, [isProspector]);

  /*
   * Built from the whole day, not the filtered list: narrowing Next actions
   * to "overdue" is a reading aid, and it should not silently drop stops from
   * the round the prospector is about to drive.
   */
  const visits = useMemo(() => buildVisits(today?.priorities ?? []), [today]);

  async function refresh(): Promise<void> {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const states = useMemo(() => {
    if (!today) {
      return new Map<string, DueState>();
    }

    return new Map(
      today.priorities.map((priority) => [
        priority.id,
        resolveDueState(priority.dueAt, priority.isOverdue, today.day.endsAt, now),
      ]),
    );
  }, [now, today]);

  const counts = useMemo(() => {
    let overdue = 0;
    let dueToday = 0;

    for (const state of states.values()) {
      if (state === 'overdue') overdue += 1;
      if (countsAsDueToday(state)) dueToday += 1;
    }

    return { all: states.size, overdue, due_today: dueToday };
  }, [states]);

  const visible = useMemo(() => {
    if (!today) {
      return [];
    }

    if (filter === 'all') {
      return today.priorities;
    }

    return today.priorities.filter((priority) => {
      const state = states.get(priority.id);

      return filter === 'overdue' ? state === 'overdue' : countsAsDueToday(state ?? 'upcoming');
    });
  }, [filter, states, today]);

  if (!isProspector) {
    return <WorkspaceOverview />;
  }

  if (!teamId) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Today" subtitle="Your priorities for today" />

        <Alert tone="info" title="Today is a team view.">
          Your current workspace is not scoped to a team, so there is no personal daily queue to
          show. Switch to a team workspace to see your priorities.
        </Alert>
      </div>
    );
  }

  if (error && !today) {
    return (
      <div className="mx-auto max-w-2xl">
        <Alert tone="danger" title="We could not load your day.">
          {error}
        </Alert>

        <Button className="mt-5" loading={refreshing} onClick={() => void refresh()}>
          Try again
        </Button>
      </div>
    );
  }

  if (!today) {
    return <TodaySkeleton />;
  }

  const timeZone = today.day.timeZone;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Today"
        subtitle={`${formatDay(today.day.date, timeZone)} · Your priorities for today`}
        action={
          <TodayControls
            dayLabel={formatDayShort(today.day.date, timeZone)}
            refreshing={refreshing}
            onRefresh={() => void refresh()}
          />
        }
      />

      {error ? <Alert tone="warning">{error}</Alert> : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] xl:items-start">
        <Card className="p-0 sm:p-0">
          <div className="border-b border-line-soft px-5 pt-5 pb-4 sm:px-6">
            <h2 className="text-[22px] font-bold tracking-[-0.02em] text-navy">Next actions</h2>

            <div className="mt-4 flex flex-wrap gap-2">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'overdue', label: 'Overdue' },
                  { id: 'due_today', label: 'Due today' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  aria-pressed={filter === tab.id}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[14px] font-semibold',
                    'transition-colors duration-150',
                    filter === tab.id
                      ? 'bg-brand-tint text-brand'
                      : 'bg-surface-muted text-ink-soft hover:text-ink',
                  )}
                >
                  {tab.label}

                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-[12px] font-bold',
                      tab.id === 'overdue' && counts.overdue > 0
                        ? 'bg-danger text-white'
                        : filter === tab.id
                          ? 'bg-brand text-white'
                          : 'bg-line-soft text-ink-soft',
                    )}
                  >
                    {counts[tab.id]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {visible.length === 0 ? (
            <EmptyState filter={filter} totalToday={counts.all} />
          ) : (
            <ul aria-label="Next actions" className="divide-y divide-line-soft">
              {visible.map((priority) => (
                <PriorityRow
                  key={priority.id}
                  priority={priority}
                  state={states.get(priority.id) ?? 'upcoming'}
                  timeZone={timeZone}
                />
              ))}
            </ul>
          )}
        </Card>

        <TodaysVisits visits={visits} timeZone={timeZone} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] xl:items-start">
        <Card>
          <h2 className="text-[22px] font-bold tracking-[-0.02em] text-navy">Progress today</h2>

          <div className="mt-5 grid gap-5 sm:grid-cols-3">
            <ProgressTile
              icon={<CheckCircle2 aria-hidden="true" className="size-5 text-success" />}
              tone="bg-success-bg"
              value={today.summary.completedToday}
              label="Actions completed"
            />

            <ProgressTile
              icon={<CircleDot aria-hidden="true" className="size-5 text-brand" />}
              tone="bg-brand-tint"
              value={today.summary.actionsLeft}
              label="Remaining today"
            />

            <ProgressTile
              icon={<CircleAlert aria-hidden="true" className="size-5 text-danger" />}
              tone="bg-danger-bg"
              value={today.summary.overdue}
              label="Follow-ups overdue"
            />
          </div>
        </Card>

        <CollisionNotice
          collisions={collisions}
          priorities={today.priorities}
          timeZone={timeZone}
          dismissed={noticeDismissed}
          onDismiss={() => setNoticeDismissed(true)}
        />
      </div>
    </div>
  );
}

/**
 * The day's visits, plotted in due order.
 *
 * Only prospects the API returned coordinates for can appear. A stop without
 * them is left off the map and counted in the footnote rather than dropped
 * silently or placed at a default position.
 */
function TodaysVisits({
  visits,
  timeZone,
}: {
  visits: ReturnType<typeof buildVisits>;
  timeZone: string;
}) {
  const points = visits.map((visit) => ({
    id: visit.priority.id,
    name: visit.priority.establishment.name,
    latitude: visit.latitude,
    longitude: visit.longitude,
    stage: 'to_contact' as const,
    href: `/work-queue/${visit.priority.campaignId}/${visit.priority.campaignProspectId}`,
  }));

  const total = totalVisitKm(visits);

  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-bold tracking-[-0.02em] text-navy">
            Today&apos;s visits
          </h2>

          <p className="mt-1 text-[14px] text-ink-muted">
            {visits.length} stop{visits.length === 1 ? '' : 's'}
            {total > 0 ? ` \u00b7 ${total.toFixed(1)} km total` : ''}
          </p>
        </div>

        <MapPinned aria-hidden="true" className="size-5 shrink-0 text-ink-muted" />
      </div>

      {visits.length === 0 ? (
        <p className="py-12 text-center text-[15px] text-ink-muted">
          No stop today has coordinates to plot.
        </p>
      ) : (
        <>
          <ProspectMap points={points} ordered className="mt-4 h-64 sm:h-72 xl:h-64" />

          <ol
            aria-label="Today's visit order"
            className="mt-4 flex flex-col divide-y divide-line-soft"
          >
            {visits.map((visit, index) => (
              <li key={visit.priority.id} className="flex items-center gap-3 py-2.5">
                <span
                  aria-hidden="true"
                  className="flex size-7 shrink-0 items-center justify-center rounded-full bg-success text-[12px] font-bold text-white"
                >
                  {index + 1}
                </span>

                <Link
                  href={`/work-queue/${visit.priority.campaignId}/${visit.priority.campaignProspectId}`}
                  className="min-w-0 flex-1 truncate text-[14px] font-semibold text-navy hover:text-brand"
                >
                  {visit.priority.establishment.name}
                </Link>

                <span className="shrink-0 text-[13px] tabular-nums text-ink-muted">
                  {formatTime(visit.priority.dueAt, timeZone)}
                </span>

                <span className="w-16 shrink-0 text-right text-[13px] tabular-nums text-ink-muted">
                  {visit.legKm === null ? '\u2014' : `${visit.legKm.toFixed(1)} km`}
                </span>
              </li>
            ))}
          </ol>

          <LinkButton href="/routes/new" variant="primary" className="mt-4 w-full">
            <Navigation aria-hidden="true" className="mr-2 size-[18px]" />
            Open route
          </LinkButton>

          {/* Straight-line, because no routing provider is configured. A road
              distance would be a number we did not compute. */}
          <p className="mt-3 text-[12px] text-ink-muted">
            Distances are direct point-to-point, not driving distance.
          </p>
        </>
      )}
    </Card>
  );
}

/**
 * The most recent collision the engine recorded against a prospect on today's
 * list.
 *
 * Shown only when it matches work the prospector is actually about to do;
 * a collision on someone else's prospect is not theirs to act on.
 */
function CollisionNotice({
  collisions,
  priorities,
  timeZone,
  dismissed,
  onDismiss,
}: {
  collisions: CollisionEvent[];
  priorities: ProspectorTodayPriority[];
  timeZone: string;
  dismissed: boolean;
  onDismiss: () => void;
}) {
  const byProspect = new Map(priorities.map((p) => [p.campaignProspectId, p]));

  const relevant = collisions.find(
    (event) =>
      byProspect.has(event.campaignProspectId) &&
      (event.decision === 'block' || event.decision === 'require_override'),
  );

  if (!relevant || dismissed) {
    return (
      <Card>
        <h2 className="text-[22px] font-bold tracking-[-0.02em] text-navy">Clear to proceed</h2>

        <p className="mt-2 text-[15px] text-ink-muted">
          {relevant
            ? 'The collision notice is hidden for this visit. It reappears on reload until the claim is resolved.'
            : 'The anti-collision engine has not blocked any prospect on today\u2019s list.'}
        </p>
      </Card>
    );
  }

  const priority = byProspect.get(relevant.campaignProspectId)!;

  return (
    <Card className="relative border-danger-border bg-danger-bg/40">
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Hide this collision notice"
        className={cn(
          'absolute top-4 right-4 inline-flex size-8 items-center justify-center rounded-lg',
          'text-ink-muted transition-colors duration-150 hover:bg-surface hover:text-ink',
        )}
      >
        <X aria-hidden="true" className="size-[18px]" />
      </button>

      <div className="flex items-start gap-3.5 pr-10">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-danger text-white"
        >
          <CircleAlert className="size-5" />
        </span>

        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-bold text-navy">
            {relevant.decision === 'block'
              ? 'Contact already reserved by another team'
              : 'This contact needs an override'}
          </h2>

          <p className="mt-0.5 text-[14px] text-ink-muted">
            {priority.establishment.name}
            {priority.establishment.city ? ` \u00b7 ${priority.establishment.city}` : ''}
          </p>

          <p className="mt-2 text-[14px] text-ink-soft">
            {reasonLabel(relevant.reasonCode)}. Detected{' '}
            {formatDayShort(relevant.createdAt, timeZone)} at{' '}
            {formatTime(relevant.createdAt, timeZone)}.
          </p>

          <LinkButton
            href={`/work-queue/${priority.campaignId}/${priority.campaignProspectId}`}
            className="mt-4"
          >
            View details
          </LinkButton>
        </div>
      </div>
    </Card>
  );
}

function WorkspaceOverview() {
  const { activeWorkspace } = useAuth();

  const mode = activeWorkspace?.mode ?? 'prospector';
  const items = getNavigationForWorkspace(mode).filter(
    (item) => item.availability === 'ready' && item.href && item.href !== '/',
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Overview"
        subtitle="Coordinate prospecting across your teams, campaigns and territories."
      />

      <Card>
        <h2 className="text-[19px] font-bold tracking-[-0.015em] text-navy">
          Available in this workspace
        </h2>

        <ul className="mt-4 flex flex-wrap gap-3">
          {items.map((item) => (
            <li key={item.id}>
              <LinkButton href={item.href ?? '/'}>{item.label}</LinkButton>
            </li>
          ))}
        </ul>

        {items.length === 0 ? (
          <p className="mt-4 text-[15px] text-ink-muted">
            No screens are available for this role yet.
          </p>
        ) : null}
      </Card>
    </div>
  );
}

function PriorityRow({
  priority,
  state,
  timeZone,
}: {
  priority: ProspectorTodayPriority;
  state: DueState;
  timeZone: string;
}) {
  const href = `/work-queue/${priority.campaignId}/${priority.campaignProspectId}`;

  const actionLabel = priority.category === 'meeting' ? 'View prospect' : 'Log action';

  return (
    <li className="px-4 py-3.5 sm:px-6 sm:py-4">
      {/*
        One row on a desktop, two stacked bands on a phone. The identity of
        the action (time, channel, who) always leads; the controls move below
        it rather than being squeezed or wrapped mid-line.
      */}
      <div className="flex items-start gap-3 sm:items-center">
        <span
          className={cn(
            'w-[46px] shrink-0 pt-0.5 text-[15px] font-bold tabular-nums sm:w-[52px] sm:pt-0',
            state === 'overdue' ? 'text-danger' : 'text-ink',
          )}
        >
          {formatTime(priority.dueAt, timeZone)}
        </span>

        <ActionChannelIcon channel={priority.channel} className="size-9 sm:size-10" />

        <span className="min-w-0 flex-1 pr-2">
          <Link
            href={href}
            className="block truncate text-[15px] font-bold text-navy hover:text-brand"
          >
            {priority.establishment.name}
          </Link>

          {priority.establishment.city ? (
            <span className="block truncate text-[14px] text-ink-muted">
              {priority.establishment.city}
            </span>
          ) : null}
        </span>

        <span className="hidden w-24 shrink-0 xl:block">
          <span className="block text-[15px] font-semibold text-ink">
            {getChannelLabel(priority.channel)}
          </span>

          <span className="block text-[14px] text-ink-muted">
            {CATEGORY_LABELS[priority.category]}
          </span>
        </span>

        <span className="hidden w-[92px] shrink-0 md:block">
          <DueStateBadge state={state} />
        </span>

        <span className="hidden shrink-0 items-center gap-1 sm:flex">
          <LinkButton href={href}>{actionLabel}</LinkButton>

          <PriorityRowMenu prospectHref={href} label={priority.establishment.name} />
        </span>
      </div>

      {/* Below md the row has no status column, so the state moves under the
          name rather than disappearing between breakpoints. */}
      <div className="mt-3 flex items-center gap-3 pl-[58px] md:hidden">
        <span className="min-w-0 flex-1 truncate text-[13px] text-ink-muted">
          {getChannelLabel(priority.channel)} · {CATEGORY_LABELS[priority.category]}
        </span>

        <DueStateBadge state={state} />
      </div>

      <div className="mt-3 flex items-center gap-2 pl-[58px] sm:hidden">
        <LinkButton href={href} className="flex-1">
          {actionLabel}
        </LinkButton>

        <PriorityRowMenu prospectHref={href} label={priority.establishment.name} />
      </div>
    </li>
  );
}

function ProgressTile({
  icon,
  tone,
  value,
  label,
}: {
  icon: React.ReactNode;
  tone: string;
  value: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <span
        aria-hidden="true"
        className={cn('flex size-11 shrink-0 items-center justify-center rounded-full', tone)}
      >
        {icon}
      </span>

      <span>
        <span className="block text-[30px] leading-none font-bold text-navy tabular-nums">
          {value}
        </span>

        <span className="mt-1 block text-[14px] text-ink-muted">{label}</span>
      </span>
    </div>
  );
}

function EmptyState({ filter, totalToday }: { filter: FilterId; totalToday: number }) {
  if (filter !== 'all' && totalToday > 0) {
    return (
      <p className="px-6 py-12 text-center text-[15px] text-ink-muted">
        Nothing matches this filter right now.
      </p>
    );
  }

  return (
    <div className="px-6 py-14 text-center">
      <CheckCircle2 aria-hidden="true" className="mx-auto size-10 text-success" />

      <p className="mt-3 text-[18px] font-bold text-navy">Your day is clear</p>

      <p className="mt-1 text-[15px] text-ink-muted">
        No actions are due. New work appears here as it is assigned.
      </p>
    </div>
  );
}

function TodaySkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading your day…</span>

      <div>
        <div className="h-9 w-40 rounded bg-line-soft" />
        <div className="mt-3 h-5 w-72 rounded bg-line-soft" />
      </div>

      <div className="rounded-xl border border-line-soft bg-surface p-6">
        <div className="h-7 w-44 rounded bg-line-soft" />

        <div className="mt-6 flex flex-col gap-4">
          {[0, 1, 2, 3, 4].map((row) => (
            <div key={row} className="h-14 rounded-lg bg-line-soft" />
          ))}
        </div>
      </div>
    </div>
  );
}

function getBrowserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function formatDay(value: string, timeZone: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone,
  }).format(date);
}

/** "Mon, 21 Sep" — the compact form used in the header pill. */
function formatDayShort(value: string, timeZone: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone,
  }).format(date);
}

function formatTime(value: string, timeZone: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '--:--';
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  }).format(date);
}
