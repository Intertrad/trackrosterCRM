'use client';

import { useLiveRefresh } from '@/lib/live/use-live-refresh';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, CircleAlert, MapPinned, Navigation, X } from 'lucide-react';

import { ActionChannelIcon, getChannelLabelKey } from '@/components/prospector/action-channel-icon';
import {
  type DueState,
  DueStateBadge,
  countsAsDueToday,
  resolveDueState,
} from '@/components/prospector/due-state-badge';
import { ContactActionButton } from '@/components/prospector/contact-action-button';
import { LogOutcomeDrawer } from '@/components/prospector/log-outcome-drawer';
import { PriorityRowMenu } from '@/components/prospector/priority-row-menu';
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

import { AssignedWork } from './assigned-work';
import { DayStart } from '@/components/prospector/day-start';
import {
  buildVisits,
  totalVisitKm,
  type ProspectorTodayCompleted,
  type ProspectorTodayPriority,
  type ProspectorTodayResponse,
} from '@/lib/api/prospector-today-types';
import { useAuth } from '@/lib/auth/auth-context';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { getNavigationForWorkspace } from '@/lib/auth/navigation';
import type { MessageKey } from '@/lib/i18n/dictionary';
import { cn } from '@/lib/ui/cn';

type FilterId = 'all' | 'overdue' | 'due_today' | 'completed';

const CATEGORY_LABELS = {
  todo: 'category.todo',
  follow_up: 'category.follow_up',
  meeting: 'category.meeting',
} as const satisfies Record<ProspectorTodayPriority['category'], MessageKey>;

export default function TodayPage() {
  const { activeWorkspace } = useAuth();
  const { t } = useTranslation();

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
            ? t('today.sessionExpired')
            : t('today.loadError'),
        );
      }
    },
    [teamId],
  );

  useLiveRefresh(load);

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

    return {
      all: states.size,
      overdue,
      due_today: dueToday,
      completed: today?.summary.completedToday ?? 0,
    };
  }, [states, today]);

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
      <div className="flex flex-col gap-[18px]">
        <PageHeader title={t('today.title')} subtitle={t('today.subtitle')} />

        <Alert tone="info" title={t('today.teamScoped')}>
          {t('today.teamScopedBody')}
        </Alert>
      </div>
    );
  }

  if (error && !today) {
    return (
      <div className="mx-auto max-w-2xl">
        <Alert tone="danger" title={t('today.loadErrorTitle')}>
          {error}
        </Alert>

        <Button className="mt-5" loading={refreshing} onClick={() => void refresh()}>
          {t('common.retry')}
        </Button>
      </div>
    );
  }

  if (!today) {
    return <TodaySkeleton />;
  }

  const timeZone = today.day.timeZone;

  return (
    <div className="flex flex-col gap-[18px]">
      <h1 className="sr-only">{t('today.title')}</h1>
      {error ? <Alert tone="warning">{error}</Alert> : null}

      <DayStart today={today} />
      <div className="order-2 sm:order-none">
        <AssignedWork
          today={today}
          teamId={teamId}
          onRefresh={() => void refresh()}
          refreshing={refreshing}
        />
      </div>

      <div
        className={cn(
          'contents sm:grid sm:gap-5 xl:items-start',
          visits.length > 0 && 'xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]',
        )}
      >
        <Card className="order-3 min-w-0 p-0! sm:order-none sm:p-0!">
          <div className="flex min-w-0 flex-wrap items-center gap-3 border-b border-line-soft py-3">
            <h2 className="shrink-0 px-[18px] text-xl font-bold text-navy">
              {t('today.nextActions')}
            </h2>

            <div className="flex w-full min-w-0 flex-wrap gap-2 px-2 sm:mx-2 sm:w-auto sm:max-w-[calc(100%-1rem)] sm:flex-nowrap sm:gap-0.5 sm:overflow-x-auto sm:rounded-[11px] sm:bg-surface-muted sm:p-[3px]">
              {(
                [
                  { id: 'all', label: t('today.filter.all') },
                  { id: 'overdue', label: t('today.filter.overdue') },
                  { id: 'due_today', label: t('today.filter.dueToday') },
                  { id: 'completed', label: t('today.filter.completed') },
                ] as const
              ).map((tab) => (
                <Button
                  key={tab.id}
                  size="md"
                  variant="ghost"
                  onClick={() => setFilter(tab.id)}
                  aria-pressed={filter === tab.id}
                  className={cn(
                    'shrink-0 whitespace-nowrap',
                    tab.id === 'completed' && 'mr-auto sm:mr-0',
                    filter === tab.id
                      ? 'bg-white! text-navy shadow-sm hover:bg-white!'
                      : 'bg-surface-muted! text-ink-muted hover:bg-line-soft!',
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
                </Button>
              ))}
            </div>
          </div>

          {filter === 'completed' ? (
            <CompletedTasks
              items={today.completed ?? []}
              total={today.summary.completedToday}
              timeZone={timeZone}
            />
          ) : visible.length === 0 ? (
            <EmptyState filter={filter} totalToday={counts.all} />
          ) : (
            <ul aria-label={t('today.nextActions')} className="space-y-2.5 p-2">
              {visible.map((priority) => (
                <PriorityRow
                  key={priority.id}
                  priority={priority}
                  state={states.get(priority.id) ?? 'upcoming'}
                  timeZone={timeZone}
                  onLogged={() => void refresh()}
                />
              ))}
            </ul>
          )}
        </Card>

        {visits.length > 0 && <TodaysVisits visits={visits} timeZone={timeZone} />}
      </div>

      <CollisionNotice
        collisions={collisions}
        priorities={today.priorities}
        timeZone={timeZone}
        dismissed={noticeDismissed}
        onDismiss={() => setNoticeDismissed(true)}
      />
    </div>
  );
}

function CompletedTasks({
  items,
  total,
  timeZone,
}: {
  items: ProspectorTodayCompleted[];
  total: number;
  timeZone: string;
}) {
  const { t, locale } = useTranslation();
  if (items.length === 0) {
    return (
      <p className="px-6 py-6 text-center text-[15px] text-ink-muted">
        {t('today.completedEmpty')}
      </p>
    );
  }
  return (
    <>
      <ul aria-label={t('today.filter.completed')} className="divide-y divide-line-soft">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-3 px-[18px] py-4">
            <CheckCircle2 aria-hidden="true" className="mt-1 size-5 shrink-0 text-success" />
            <div className="min-w-0 flex-1">
              <Link
                href={`/work-queue/${item.campaignId}/${item.campaignProspectId}`}
                className="break-words text-[15px] font-bold text-navy hover:text-brand"
              >
                {item.establishmentName}
              </Link>
              <p className="mt-1 text-sm text-ink-muted">
                {t('today.completedAt', {
                  time: new Intl.DateTimeFormat(locale, { timeZone, timeStyle: 'short' }).format(
                    new Date(item.completedAt),
                  ),
                })}
                {item.channel ? ` · ${t(getChannelLabelKey(item.channel))}` : ''}
              </p>
            </div>
          </li>
        ))}
      </ul>
      {total > items.length ? (
        <p className="px-[18px] pb-4 text-sm text-ink-muted">
          {t('today.completedRange', { count: items.length, total })}
        </p>
      ) : null}
    </>
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
  const { t } = useTranslation();

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
    <Card className="order-1 flex flex-col sm:order-none">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold tracking-[-0.02em] text-navy">
            {t('today.visits')}
          </h2>

          <p className="mt-1 text-[14px] text-ink-muted">
            {t(visits.length === 1 ? 'today.stops.one' : 'today.stops', {
              count: visits.length,
            })}
            {total > 0 ? ` \u00b7 ${total.toFixed(1)} km total` : ''}
          </p>
        </div>

        <MapPinned aria-hidden="true" className="size-5 shrink-0 text-ink-muted" />
      </div>

      {visits.length === 0 ? (
        <p className="py-6 text-center text-[15px] text-ink-muted">{t('today.noPlottableStop')}</p>
      ) : (
        <>
          <ProspectMap points={points} ordered className="mt-4 h-64 sm:h-72 xl:h-64" />

          <ol
            aria-label={t('today.visitOrder')}
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
            {t('today.openRoute')}
          </LinkButton>

          {/* Straight-line, because no routing provider is configured. A road
              distance would be a number we did not compute. */}
          <p className="mt-3 text-[12px] text-ink-muted">{t('today.directDistance')}</p>
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
  const { t, locale } = useTranslation();

  const byProspect = new Map(priorities.map((p) => [p.campaignProspectId, p]));

  const relevant = collisions.find(
    (event) =>
      byProspect.has(event.campaignProspectId) &&
      (event.decision === 'block' || event.decision === 'require_override'),
  );

  if (!relevant || dismissed) return null;

  const priority = byProspect.get(relevant.campaignProspectId)!;

  return (
    <Card className="relative border-danger-border bg-danger-bg/40">
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t('today.hideCollision')}
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
            {t(
              relevant.decision === 'block' ? 'today.collisionBlocked' : 'today.collisionOverride',
            )}
          </h2>

          <p className="mt-0.5 text-[14px] text-ink-muted">
            {priority.establishment.name}
            {priority.establishment.city ? ` \u00b7 ${priority.establishment.city}` : ''}
          </p>

          <p className="mt-2 text-[14px] text-ink-soft">
            {reasonLabel(relevant.reasonCode)}. Detected{' '}
            {formatDayShort(relevant.createdAt, timeZone, locale)} at{' '}
            {formatTime(relevant.createdAt, timeZone)}.
          </p>

          <LinkButton
            href={`/work-queue/${priority.campaignId}/${priority.campaignProspectId}`}
            className="mt-4"
          >
            {t('today.viewDetails')}
          </LinkButton>
        </div>
      </div>
    </Card>
  );
}

function WorkspaceOverview() {
  const { activeWorkspace } = useAuth();

  const { t } = useTranslation();

  const mode = activeWorkspace?.mode ?? 'prospector';
  const items = getNavigationForWorkspace(mode).filter(
    (item) => item.availability === 'ready' && item.href && item.href !== '/',
  );

  return (
    <div className="flex flex-col gap-[18px]">
      <PageHeader title={t('nav.overview')} subtitle={t('overview.subtitle')} />

      <Card>
        <h2 className="text-[19px] font-bold tracking-[-0.015em] text-navy">
          {t('overview.available')}
        </h2>

        <ul className="mt-4 flex flex-wrap gap-3">
          {items.map((item) => (
            <li key={item.id}>
              <LinkButton href={item.href ?? '/'}>{t(item.label)}</LinkButton>
            </li>
          ))}
        </ul>

        {items.length === 0 ? (
          <p className="mt-4 text-[15px] text-ink-muted">{t('overview.none')}</p>
        ) : null}
      </Card>
    </div>
  );
}

function PriorityRow({
  priority,
  state,
  timeZone,
  onLogged,
}: {
  priority: ProspectorTodayPriority;
  state: DueState;
  timeZone: string;
  onLogged: () => void;
}) {
  const { t } = useTranslation();

  const href = `/work-queue/${priority.campaignId}/${priority.campaignProspectId}`;

  /*
   * A call or an email is handed to the device and the outcome captured here,
   * so the prospector never leaves the day's list to do the day's work.
   * Anything else opens the prospect, where the full record is.
   */
  const [logging, setLogging] = useState(false);

  const action = (className?: string) => (
    <ContactActionButton
      channel={priority.channel}
      phone={priority.establishment.phone}
      prospectHref={href}
      prospectName={priority.establishment.name}
      onLogOutcome={() => setLogging(true)}
      className={className}
    />
  );

  return (
    <li className="rounded-xl border border-line-soft bg-surface px-3 py-3.5 sm:px-4">
      <div className="min-w-0 sm:grid sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:gap-x-3 sm:gap-y-1">
        <div className="flex items-start justify-between gap-2 sm:contents">
          <Link
            href={href}
            className="min-w-0 break-words text-[15.2px] font-bold text-navy hover:text-brand sm:col-start-2 sm:row-start-1"
          >
            {priority.establishment.name}
          </Link>
          <div className="sm:col-start-3 sm:row-start-1 sm:justify-self-end">
            <PriorityRowMenu prospectHref={href} label={priority.establishment.name} />
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 sm:contents">
          <div className="flex min-w-0 items-center gap-2.5 sm:contents">
            <ActionChannelIcon
              channel={priority.channel}
              className="size-8! shrink-0 rounded-lg! sm:col-start-1 sm:row-span-2 sm:row-start-1 sm:my-1.5 sm:h-auto! sm:w-14! sm:self-stretch sm:[&_svg]:size-7"
            />
            <div className="min-w-0 text-[13px] text-ink-muted sm:col-start-2 sm:row-start-2">
              {priority.establishment.city && (
                <p className="break-words">{priority.establishment.city}</p>
              )}
              <time
                dateTime={priority.dueAt}
                className={state === 'overdue' ? 'font-semibold text-danger' : 'font-semibold'}
              >
                {formatTime(priority.dueAt, timeZone)}
              </time>
            </div>
          </div>
          {action(
            'shrink-0 whitespace-nowrap px-2! text-[12px]! sm:col-start-3 sm:row-start-2 sm:px-3! sm:text-[13px]!',
          )}
        </div>
        <div className="mt-2 flex items-end justify-between gap-2 sm:col-span-3 sm:row-start-3">
          <span className="min-w-0 text-[12px] text-ink-muted">
            {t(getChannelLabelKey(priority.channel))} · {t(CATEGORY_LABELS[priority.category])}
          </span>
          <span className="shrink-0">
            <DueStateBadge state={state} />
          </span>
        </div>
      </div>

      <LogOutcomeDrawer
        open={logging}
        onClose={() => setLogging(false)}
        campaignId={priority.campaignId}
        prospectId={priority.campaignProspectId}
        establishmentName={priority.establishment.name}
        reservation={null}
        defaultChannel={priority.channel === 'email' ? 'email' : 'call'}
        onCompleted={() => {
          setLogging(false);
          onLogged();
        }}
      />
    </li>
  );
}

function EmptyState({ filter, totalToday }: { filter: FilterId; totalToday: number }) {
  const { t } = useTranslation();

  if (filter !== 'all' && totalToday > 0) {
    return <p className="px-6 py-6 text-center text-[15px] text-ink-muted">{t('today.noMatch')}</p>;
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-line-soft bg-surface px-[18px] py-4">
      <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-success" />
      <div>
        <p className="text-sm font-bold text-navy">{t('today.empty')}</p>
        <p className="mt-1 text-sm text-ink-muted">{t('today.emptyBody')}</p>
      </div>
    </div>
  );
}

function TodaySkeleton() {
  const { t } = useTranslation();

  return (
    <div className="flex animate-pulse flex-col gap-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">{t('today.loading')}</span>

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

/** "Mon, 21 Sep" — the compact form used in the header pill. */
function formatDayShort(value: string, timeZone: string, locale?: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, {
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
