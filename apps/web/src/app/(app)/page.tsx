'use client';

import { useLiveRefresh } from '@/lib/live/use-live-refresh';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Clock3, MapPinned, Navigation } from 'lucide-react';

import { ActionChannelIcon, getChannelLabelKey } from '@/components/prospector/action-channel-icon';
import {
  type DueState,
  DueStateBadge,
  countsAsDueToday,
  resolveDueState,
} from '@/components/prospector/due-state-badge';
import { ContactActionButton } from '@/components/prospector/contact-action-button';
import { LifecycleBadge } from '@/components/prospector/lifecycle-badge';
import { LogOutcomeDrawer } from '@/components/prospector/log-outcome-drawer';
import { PriorityRowMenu } from '@/components/prospector/priority-row-menu';
import { ProspectDetail } from '@/components/prospector/prospect-detail';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Drawer } from '@/components/ui/drawer';
import { LinkButton } from '@/components/ui/link-button';
import { PageHeader } from '@/components/ui/page-header';
import { ProspectMap } from '@/components/prospector/prospect-map';
import { ApiError } from '@/lib/api/api-error';
import { listCollisionEvents } from '@/lib/api/collision-client';
import type { CollisionEvent } from '@/lib/api/collision-types';
import { getProspectorToday } from '@/lib/api/prospector-today-client';

import { DayStart } from '@/components/prospector/day-start';
import {
  buildVisits,
  totalVisitKm,
  type ProspectorTodayPriority,
  type ProspectorTodayResponse,
} from '@/lib/api/prospector-today-types';
import { useAuth } from '@/lib/auth/auth-context';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { getNavigationForWorkspace } from '@/lib/auth/navigation';
import type { MessageKey } from '@/lib/i18n/dictionary';
import { cn } from '@/lib/ui/cn';
import { text } from '@/lib/workspace/copy';

type FilterId = 'all' | 'overdue' | 'due_today';

const CATEGORY_LABELS = {
  todo: 'category.todo',
  follow_up: 'category.follow_up',
  meeting: 'category.meeting',
} as const satisfies Record<ProspectorTodayPriority['category'], MessageKey>;

export default function TodayPage() {
  const { activeWorkspace, user } = useAuth();
  const { t, language } = useTranslation();

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
  const [search, setSearch] = useState('');

  /*
   * Collisions are read once for the whole day rather than per prospect: a
   * per-row check would be one request per priority for information that is
   * only surfaced as a single banner.
   */
  const [collisions, setCollisions] = useState<CollisionEvent[]>([]);

  /* Dismissed for this visit only; the collision itself is not resolved by
   * closing the notice, so it is not persisted. */
  const [selected, setSelected] = useState<ProspectorTodayPriority | null>(null);
  const [detailDirty, setDetailDirty] = useState(false);
  const [discard, setDiscard] = useState(false);

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

    return { all: states.size, overdue, due_today: dueToday };
  }, [states]);

  const visible = useMemo(() => {
    if (!today) {
      return [];
    }

    const normalizedSearch = search.trim().toLocaleLowerCase();
    const filtered = today.priorities.filter((priority) => {
      const state = states.get(priority.id);
      const matchesFilter =
        filter === 'all'
          ? true
          : filter === 'overdue'
            ? state === 'overdue'
            : countsAsDueToday(state ?? 'upcoming');
      const matchesSearch =
        !normalizedSearch ||
        `${priority.establishment.name} ${priority.establishment.city ?? ''}`
          .toLocaleLowerCase()
          .includes(normalizedSearch);
      return matchesFilter && matchesSearch;
    });
    return filter === 'due_today'
      ? [...filtered].sort((left, right) => priorityScore(right) - priorityScore(left))
      : filtered;
  }, [filter, search, states, today]);

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
          Try again
        </Button>
      </div>
    );
  }

  if (!today) {
    return <TodaySkeleton />;
  }

  const timeZone = today.day.timeZone;

  function selectProspect(priority: ProspectorTodayPriority): void {
    setDetailDirty(false);
    setSelected(priority);
  }

  function closeProspect(): void {
    if (detailDirty) {
      setDiscard(true);
      return;
    }

    setSelected(null);
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <h1 className="sr-only">{t('today.title')}</h1>
      {error ? <Alert tone="warning">{error}</Alert> : null}

      <DayStart
        today={today}
        displayName={user?.displayName}
        search={search}
        onSearchChange={setSearch}
        filter={filter}
        counts={counts}
        onFilterChange={setFilter}
        onRefresh={() => void refresh()}
        refreshing={refreshing}
      />

      {counts.all === 0 ? (
        <EmptyState filter={filter} totalToday={0} />
      ) : (
        <>
          <Card className="overflow-hidden p-0 sm:p-0">
            <div className="flex flex-col gap-3 border-b border-line-soft px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-5">
              <div>
                <h2 className="text-[15px] font-extrabold tracking-[-0.015em] text-navy">
                  {text('Priority work list', 'Liste des priorités', language)}
                  <span className="sr-only">{t('today.nextActions')}</span>
                </h2>
                <p className="mt-1 text-[12px] text-ink-muted">
                  {text(
                    'Your next best actions — collision-checked before you start',
                    'Vos prochaines actions — vérifiées avant de commencer',
                    language,
                  )}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="inline-flex rounded-lg bg-surface-muted p-0.5">
                  {(
                    [
                      { id: 'all', label: 'Today', count: counts.all },
                      { id: 'overdue', label: 'Overdue', count: counts.overdue },
                      { id: 'due_today', label: 'Priority', count: counts.due_today },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setFilter(tab.id)}
                      aria-pressed={filter === tab.id}
                      className={cn(
                        'rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors',
                        filter === tab.id
                          ? 'bg-surface text-navy shadow-sm'
                          : 'text-ink-muted hover:text-ink',
                      )}
                    >
                      {tab.label} <span className="ml-1 tabular-nums">{tab.count}</span>
                    </button>
                  ))}
                </div>
                <span className="hidden text-[11px] font-semibold text-ink-muted sm:inline">
                  Sorted by priority &amp; time
                </span>
              </div>
            </div>

            {visible.length === 0 ? (
              <EmptyState filter={filter} totalToday={counts.all} />
            ) : (
              <>
                <div className="hidden grid-cols-[minmax(230px,2fr)_minmax(100px,0.8fr)_minmax(120px,1fr)_minmax(90px,0.8fr)_minmax(120px,1fr)_minmax(120px,1fr)_auto] gap-4 border-b border-line-soft bg-surface-muted/55 px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-ink-muted lg:grid">
                  <span>Establishment</span>
                  <span>Action</span>
                  <span>Time / deadline</span>
                  <span>Priority</span>
                  <span>Contact check</span>
                  <span>Status</span>
                  <span />
                </div>
                <ul aria-label={t('today.nextActions')} className="divide-y divide-line-soft">
                  {visible.map((priority) => (
                    <PriorityRow
                      key={priority.id}
                      priority={priority}
                      state={states.get(priority.id) ?? 'upcoming'}
                      timeZone={timeZone}
                      collision={getContactCheck(priority, collisions)}
                      onLogged={() => void refresh()}
                      onSelect={selectProspect}
                    />
                  ))}
                </ul>
              </>
            )}
          </Card>

          {visits.length > 0 && <TodaysVisits visits={visits} timeZone={timeZone} />}
        </>
      )}

      {selected ? (
        <Drawer open title={selected.establishment.name} width="prospect" onClose={closeProspect}>
          <Suspense>
            <ProspectDetail
              campaignId={selected.campaignId}
              prospectId={selected.campaignProspectId}
              embedded
              onDirtyChange={setDetailDirty}
            />
          </Suspense>
        </Drawer>
      ) : null}

      <ConfirmDialog
        open={discard}
        title={text('Discard this draft?', 'Abandonner ce brouillon ?', language)}
        description={text(
          'Your unsaved contact-permission changes will be lost.',
          'Les modifications d’autorisation de contact non enregistrées seront perdues.',
          language,
        )}
        confirmLabel={text('Discard draft', 'Abandonner le brouillon', language)}
        onClose={() => setDiscard(false)}
        onConfirm={() => {
          setDiscard(false);
          setSelected(null);
          setDetailDirty(false);
        }}
      />
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
    <Card className="flex flex-col">
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
  collision,
  onLogged,
  onSelect,
}: {
  priority: ProspectorTodayPriority;
  state: DueState;
  timeZone: string;
  collision: ContactCheck;
  onLogged: () => void;
  onSelect: (priority: ProspectorTodayPriority) => void;
}) {
  const { t } = useTranslation();

  const href = `/work-queue/${priority.campaignId}/${priority.campaignProspectId}`;

  /*
   * A call or an email is handed to the device and the outcome captured here,
   * so the prospector never leaves the day's list to do the day's work.
   * Anything else opens the prospect, where the full record is.
   */
  const [logging, setLogging] = useState(false);

  const actionLabel =
    priority.channel === 'visit'
      ? 'Start visit'
      : priority.channel === 'call'
        ? 'Start call'
        : 'Start email';
  const action = (className?: string) => {
    if (collision === 'blocked') {
      return (
        <LinkButton
          href={href}
          className={cn('h-8 min-h-8 rounded-md px-3 py-1 text-[12px]', className)}
        >
          View activity
        </LinkButton>
      );
    }
    if (collision === 'approval') {
      return (
        <LinkButton
          href={href}
          className={cn('h-8 min-h-8 rounded-md px-3 py-1 text-[12px]', className)}
        >
          Request approval
        </LinkButton>
      );
    }
    return (
      <ContactActionButton
        channel={priority.channel}
        phone={priority.establishment.phone}
        prospectHref={href}
        prospectName={priority.establishment.name}
        onLogOutcome={() => setLogging(true)}
        actionLabel={actionLabel}
        fallbackLabel={priority.channel === 'visit' ? 'Start visit' : 'View prospect'}
        fallbackVariant="primary"
        className={cn(
          'h-8 min-h-8 rounded-md bg-brand px-3 py-1 text-[12px] font-bold text-white hover:bg-brand-hover',
          className,
        )}
      />
    );
  };

  const priorityLevel = getPriorityLevel(priority, state);
  const deadline =
    state === 'overdue'
      ? `Overdue · ${overdueDays(priority.dueAt)} d`
      : formatTime(priority.dueAt, timeZone);

  return (
    <li className="px-4 py-3 sm:px-5 sm:py-3.5">
      <div className="grid gap-3 lg:grid-cols-[minmax(230px,2fr)_minmax(100px,0.8fr)_minmax(120px,1fr)_minmax(90px,0.8fr)_minmax(120px,1fr)_minmax(120px,1fr)_auto] lg:items-center lg:gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <ActionChannelIcon channel={priority.channel} className="size-8 rounded-lg" />
          <span className="min-w-0">
            <Link
              href={href}
              aria-haspopup="dialog"
              onClick={(event) => {
                if (
                  !event.defaultPrevented &&
                  !event.altKey &&
                  !event.ctrlKey &&
                  !event.metaKey &&
                  !event.shiftKey &&
                  event.button === 0
                ) {
                  event.preventDefault();
                  onSelect(priority);
                }
              }}
              className="block truncate text-[13px] font-bold text-navy hover:text-brand"
            >
              {priority.establishment.name}
            </Link>
            <span className="block truncate text-[11px] text-ink-muted">
              {priority.establishment.city ?? t(CATEGORY_LABELS[priority.category])}
            </span>
          </span>
        </div>

        <span className="hidden text-[12px] font-semibold text-ink-soft lg:block">
          {t(getChannelLabelKey(priority.channel))}
        </span>

        <span
          className={cn(
            'flex items-center gap-1 text-[12px] font-semibold tabular-nums',
            state === 'overdue' && 'text-danger',
          )}
        >
          <Clock3 aria-hidden="true" className="size-3.5" />
          {deadline}
        </span>

        <span className="flex items-center gap-1.5 text-[11px] font-bold">
          <span className={cn('size-1.5 rounded-full', priorityLevel.dot)} />
          <span className={priorityLevel.text}>{priorityLevel.label}</span>
        </span>

        <span
          className={cn(
            'inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-bold',
            contactTone(collision),
          )}
          title={contactTooltip(collision)}
          aria-label={`${contactLabel(collision)}: ${contactTooltip(collision)}`}
        >
          <span className="size-1.5 rounded-full bg-current" />
          {contactLabel(collision)}
        </span>

        <span className="hidden lg:block">
          <LifecycleBadge stage={priority.lifecycleStage ?? 'to_contact'} className="text-[10px]" />
        </span>

        <span className="flex items-center gap-1.5 lg:justify-end">
          {action()}
          <PriorityRowMenu prospectHref={href} label={priority.establishment.name} />
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 lg:hidden">
        <span className="text-[11px] text-ink-muted">
          {t(getChannelLabelKey(priority.channel))} · {contactLabel(collision)}
        </span>
        <DueStateBadge state={state} />
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

type ContactCheck = 'allowed' | 'approval' | 'blocked';

function getContactCheck(
  priority: ProspectorTodayPriority,
  collisions: CollisionEvent[],
): ContactCheck {
  const events = collisions.filter(
    (item) => item.campaignProspectId === priority.campaignProspectId,
  );
  const event =
    events.find((item) => item.decision === 'block') ??
    events.find((item) => item.decision === 'require_override') ??
    events[0];
  if (event?.decision === 'block') return 'blocked';
  if (event?.decision === 'require_override') return 'approval';
  return 'allowed';
}

function contactLabel(check: ContactCheck): string {
  return check === 'blocked' ? 'Blocked' : check === 'approval' ? 'Approval' : 'Allowed';
}

function contactTooltip(check: ContactCheck): string {
  if (check === 'blocked') return 'Contact blocked by the collision policy.';
  if (check === 'approval') return 'Manager approval is required before contact.';
  return 'Contact is allowed by the current collision policy.';
}

function contactTone(check: ContactCheck): string {
  return check === 'blocked'
    ? 'bg-danger-bg text-danger'
    : check === 'approval'
      ? 'bg-warning-bg text-warning'
      : 'bg-success-bg text-success';
}

function getPriorityLevel(
  priority: ProspectorTodayPriority,
  state: DueState,
): { label: string; dot: string; text: string } {
  if (state === 'overdue' || priority.category === 'meeting')
    return { label: 'High', dot: 'bg-danger', text: 'text-danger' };
  if (priority.category === 'follow_up')
    return { label: 'Medium', dot: 'bg-warning', text: 'text-warning' };
  return { label: 'Low', dot: 'bg-brand-mid', text: 'text-brand-mid' };
}

function priorityScore(priority: ProspectorTodayPriority): number {
  return priority.category === 'meeting' ? 3 : priority.category === 'follow_up' ? 2 : 1;
}

function overdueDays(value: string): number {
  const days = Math.ceil((Date.now() - new Date(value).getTime()) / 86_400_000);
  return Math.max(1, Number.isFinite(days) ? days : 1);
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
