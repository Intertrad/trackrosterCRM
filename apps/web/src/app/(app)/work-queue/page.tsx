'use client';

import { useLiveRefresh } from '@/lib/live/use-live-refresh';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Ban,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Info,
  List,
  Map as MapIcon,
  Phone,
  Star,
  TriangleAlert,
} from 'lucide-react';

import {
  LIFECYCLE_ORDER,
  LifecycleBadge,
  getLifecycleLabelKey,
} from '@/components/prospector/lifecycle-badge';
import { ProspectDetail } from '@/components/prospector/prospect-detail';
import { PortfolioMap } from '@/components/prospector/portfolio-map';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Drawer } from '@/components/ui/drawer';
import { FilterSelect } from '@/components/ui/filter-select';
import { PageHeader } from '@/components/ui/page-header';
import { SearchInput } from '@/components/ui/search-input';
import { ApiError } from '@/lib/api/api-error';
import { listCollisionEvents } from '@/lib/api/collision-client';
import {
  QUICK_FILTERS,
  SORT_LABELS,
  deriveNextStep,
  lastActionLabel,
  loadPortfolio,
  localityLabel,
  matchesQuickFilter,
  regionSummary,
  sortPortfolio,
  summarize,
  type NextStep,
  type PortfolioSort,
  type QuickFilterId,
} from '@/lib/api/portfolio';
import { getWorkQueueOptions } from '@/lib/api/work-queue-client';
import type {
  WorkQueueCampaignOption,
  WorkQueueItem,
  WorkQueueLifecycleStage,
} from '@/lib/api/work-queue-types';
import { useAuth } from '@/lib/auth/auth-context';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { cn } from '@/lib/ui/cn';
import { text } from '@/lib/workspace/copy';

type ViewMode = 'list' | 'map';

export default function MyProspectsPage() {
  return (
    <Suspense fallback={null}>
      <MyProspectsView />
    </Suspense>
  );
}

function MyProspectsView() {
  const { activeWorkspace } = useAuth();
  const { language, t } = useTranslation();
  const l = (en: string, fr: string) => text(en, fr, language);

  const teamId = activeWorkspace?.teamId ?? null;

  /* Scoped search links here with the matched name, so the queue opens
   * already filtered rather than dropping the term the user searched for. */
  const initialSearch = useSearchParams().get('search') ?? '';

  const [view, setView] = useState<ViewMode>('list');
  const [search, setSearch] = useState(initialSearch);
  const [stage, setStage] = useState<WorkQueueLifecycleStage | 'all'>('all');
  const [campaignId, setCampaignId] = useState('all');
  const [sort, setSort] = useState<PortfolioSort>('priority');
  const [quick, setQuick] = useState<QuickFilterId>('all');

  const [campaigns, setCampaigns] = useState<WorkQueueCampaignOption[]>([]);
  const [items, setItems] = useState<WorkQueueItem[] | null>(null);
  const [complete, setComplete] = useState(true);
  const [blockedIds, setBlockedIds] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [reloading, setReloading] = useState(false);
  const [selected, setSelected] = useState<WorkQueueItem | null>(null);
  const [detailDirty, setDetailDirty] = useState(false);
  const [discard, setDiscard] = useState(false);

  /*
   * The whole portfolio is read once and every figure on this screen is
   * derived from it. `GET /work-queue` has no totals, no ordering and no
   * follow-up predicate, so counting a page would mean quoting numbers that
   * describe the request rather than the prospector's actual book of work.
   */
  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      if (!teamId) {
        return;
      }

      try {
        const portfolio = await loadPortfolio(teamId, signal);

        if (signal?.aborted) {
          return;
        }

        setItems(portfolio.items);
        setComplete(portfolio.complete);
        setError(null);
      } catch (caught) {
        if (signal?.aborted) {
          return;
        }

        setError(
          caught instanceof ApiError && caught.statusCode === 401
            ? t('today.sessionExpired')
            : t('portfolio.loadError'),
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
    if (!teamId) {
      return;
    }

    const controller = new AbortController();

    getWorkQueueOptions({ teamId, signal: controller.signal })
      .then((response) => setCampaigns(response.campaigns))
      .catch(() => setCampaigns([]));

    /* A prospector without collision-read access simply sees no blocked
     * markers; it is not an error for the page. */
    listCollisionEvents({ limit: 100 }, controller.signal)
      .then((page) =>
        setBlockedIds(
          new Set(
            page.items
              .filter(
                (event) => event.decision === 'block' || event.decision === 'require_override',
              )
              .map((event) => event.campaignProspectId),
          ),
        ),
      )
      .catch(() => setBlockedIds(new Set()));

    return () => controller.abort();
  }, [teamId]);

  async function reload(): Promise<void> {
    setReloading(true);
    await load();
    setReloading(false);
  }

  function selectProspect(item: WorkQueueItem): void {
    setDetailDirty(false);
    setSelected(item);
  }

  function closeProspect(): void {
    if (detailDirty) {
      setDiscard(true);
      return;
    }

    setSelected(null);
  }

  const summary = useMemo(() => summarize(items ?? [], blockedIds), [blockedIds, items]);

  const region = useMemo(() => regionSummary(items ?? []), [items]);

  const narrowed =
    search.trim() !== '' || stage !== 'all' || campaignId !== 'all' || quick !== 'all';

  const visible = useMemo(() => {
    if (!items) {
      return [];
    }

    const term = search.trim().toLowerCase();

    const filtered = items.filter((item) => {
      if (stage !== 'all' && item.lifecycleStage !== stage) {
        return false;
      }

      if (campaignId !== 'all' && item.campaign.id !== campaignId) {
        return false;
      }

      if (!matchesQuickFilter(item, quick)) {
        return false;
      }

      if (!term) {
        return true;
      }

      return [item.establishment.name, item.establishment.city, item.establishment.postalCode]
        .filter((part): part is string => Boolean(part))
        .some((part) => part.toLowerCase().includes(term));
    });

    return sortPortfolio(filtered, sort);
  }, [campaignId, items, quick, search, sort, stage]);

  if (!teamId) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t('portfolio.title')} />

        <Alert tone="info" title={t('portfolio.teamScoped')}>
          {t('portfolio.teamScopedBody')}
        </Alert>
      </div>
    );
  }

  if (error && !items) {
    return (
      <div className="mx-auto max-w-2xl">
        <Alert tone="danger" title={t('portfolio.loadErrorTitle')}>
          {error}
        </Alert>

        <Button className="mt-5" loading={reloading} onClick={() => void reload()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t('portfolio.title')}
        subtitle={
          items === null
            ? t('portfolio.loading')
            : [
                t(summary.assigned === 1 ? 'portfolio.assigned.one' : 'portfolio.assigned', {
                  count: summary.assigned,
                }),
                region ? t(region.key, region.values) : null,
              ]
                .filter(Boolean)
                .join(' · ')
        }
        action={<ViewToggle view={view} onChange={setView} />}
      />

      {error ? <Alert tone="warning">{error}</Alert> : null}

      {!complete ? (
        <Alert tone="warning" title={t('portfolio.partialTitle')}>
          {t('portfolio.partialBody')}
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          label={t('portfolio.search')}
          placeholder={`${t('portfolio.search')}…`}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="min-w-[240px] flex-1 [&_input]:rounded-full"
        />

        <FilterSelect
          label={t('portfolio.status')}
          tone="brand"
          value={stage}
          onChange={(value) => setStage(value as WorkQueueLifecycleStage | 'all')}
          options={[
            { value: 'all', label: t('portfolio.all') },
            ...LIFECYCLE_ORDER.map((id) => ({ value: id, label: t(getLifecycleLabelKey(id)) })),
          ]}
        />

        <FilterSelect
          label={t('portfolio.campaign')}
          tone="brand"
          value={campaignId}
          onChange={setCampaignId}
          options={[
            { value: 'all', label: t('portfolio.all') },
            ...campaigns.map((campaign) => ({ value: campaign.id, label: campaign.name })),
          ]}
        />

        {view === 'list' ? (
          <FilterSelect
            label={t('portfolio.sort')}
            tone="brand"
            value={sort}
            onChange={(value) => setSort(value as PortfolioSort)}
            options={Object.entries(SORT_LABELS).map(([value, label]) => ({
              value,
              label: t(label),
            }))}
          />
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2.5">
        {QUICK_FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => setQuick(filter.id)}
            aria-pressed={quick === filter.id}
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[14px] font-semibold',
              'border transition-colors duration-150',
              quick === filter.id
                ? 'border-lime bg-lime/12 text-lime-deep'
                : 'border-transparent bg-surface-muted text-ink-soft hover:text-ink',
            )}
          >
            {quick === filter.id ? (
              <Star aria-hidden="true" className="size-4 fill-current" />
            ) : null}
            {t(filter.label)}
          </button>
        ))}
      </div>

      {items === null ? (
        <PortfolioSkeleton />
      ) : view === 'map' ? (
        <PortfolioMap
          items={visible}
          blockedProspectIds={blockedIds}
          onOpenProspect={selectProspect}
        />
      ) : (
        <ProspectTable
          items={visible}
          blockedProspectIds={blockedIds}
          filtered={narrowed}
          onSelect={selectProspect}
        />
      )}

      {items !== null ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-ink-muted">
          <span className="flex items-center gap-2">
            <Info aria-hidden="true" className="size-4 shrink-0" />

            {[
              t(
                summary.assigned === 1
                  ? 'portfolio.summary.assigned.one'
                  : 'portfolio.summary.assigned',
                {
                  count: summary.assigned,
                },
              ),
              t('portfolio.summary.toContact', { count: summary.toContact }),
              t(
                summary.followUpsDue === 1 ? 'portfolio.summary.due.one' : 'portfolio.summary.due',
                {
                  count: summary.followUpsDue,
                },
              ),
              t(
                summary.blocked === 1
                  ? 'portfolio.summary.blocked.one'
                  : 'portfolio.summary.blocked',
                {
                  count: summary.blocked,
                },
              ),
            ].join(' · ')}
          </span>

          <span>{t('portfolio.showing', { shown: visible.length, total: summary.assigned })}</span>
        </div>
      ) : null}

      {selected ? (
        <Drawer open title={selected.establishment.name} width="prospect" onClose={closeProspect}>
          <Suspense>
            <ProspectDetail
              campaignId={selected.campaign.id}
              prospectId={selected.campaignProspectId}
              embedded
              onDirtyChange={setDetailDirty}
            />
          </Suspense>
        </Drawer>
      ) : null}

      <ConfirmDialog
        open={discard}
        title={l('Discard this draft?', 'Abandonner ce brouillon ?')}
        description={l(
          'Your unsaved contact-permission changes will be lost.',
          'Les modifications d’autorisation de contact non enregistrées seront perdues.',
        )}
        confirmLabel={l('Discard draft', 'Abandonner le brouillon')}
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

function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (next: ViewMode) => void }) {
  const { t } = useTranslation();

  return (
    <div
      role="group"
      aria-label={t('portfolio.view')}
      className="inline-flex gap-1 rounded-xl bg-surface-muted p-1"
    >
      {(
        [
          { id: 'list', label: 'portfolio.list', icon: List },
          { id: 'map', label: 'portfolio.map', icon: MapIcon },
        ] as const
      ).map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          aria-pressed={view === option.id}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-[15px] font-semibold',
            'transition-colors duration-150',
            view === option.id
              ? 'bg-surface text-navy shadow-card'
              : 'text-ink-soft hover:text-ink',
          )}
        >
          <option.icon aria-hidden="true" className="size-[18px]" />
          {t(option.label)}
        </button>
      ))}
    </div>
  );
}

function ProspectTable({
  items,
  blockedProspectIds,
  filtered,
  onSelect,
}: {
  items: WorkQueueItem[];
  blockedProspectIds: ReadonlySet<string>;
  /** Whether any filter is narrowing the portfolio right now. */
  filtered: boolean;
  onSelect: (item: WorkQueueItem) => void;
}) {
  const { t } = useTranslation();

  if (items.length === 0) {
    /*
     * A filtered-empty result and an empty portfolio mean opposite things —
     * one says "change the filter", the other says "you have no work" — so
     * they must never share a message.
     */
    return (
      <Card>
        <p className="py-14 text-center text-[15px] text-ink-muted">
          {t(filtered ? 'portfolio.noMatch' : 'portfolio.empty')}
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Column headings only where the row actually lays out in columns. */}
      <div className="hidden px-5 lg:grid lg:grid-cols-[minmax(0,2.1fr)_130px_110px_150px_minmax(0,1.3fr)_28px] lg:items-center lg:gap-4">
        {(
          [
            'portfolio.establishment',
            'portfolio.status',
            'portfolio.campaign',
            'portfolio.lastAction',
            'portfolio.nextStep',
          ] as const
        ).map((heading) => (
          <span
            key={heading}
            className="text-[12px] font-bold tracking-[0.06em] text-ink-muted uppercase"
          >
            {t(heading)}
          </span>
        ))}
      </div>

      <ul aria-label={t('portfolio.title')} className="flex flex-col gap-2">
        {items.map((item) => (
          <ProspectRow
            key={item.campaignProspectId}
            item={item}
            blocked={blockedProspectIds.has(item.campaignProspectId)}
            onSelect={onSelect}
          />
        ))}
      </ul>
    </div>
  );
}

function ProspectRow({
  item,
  blocked,
  onSelect,
}: {
  item: WorkQueueItem;
  blocked: boolean;
  onSelect: (item: WorkQueueItem) => void;
}) {
  const { t } = useTranslation();

  const href = `/work-queue/${item.campaign.id}/${item.campaignProspectId}`;

  const nextStep = deriveNextStep(item, blocked ? new Set([item.campaignProspectId]) : new Set());

  return (
    <li>
      <Link
        href={href}
        aria-haspopup="dialog"
        onClick={(event) => {
          /* Keep the real href for deep links and modifier-clicks, while a
           * normal click opens the detail in context. */
          if (
            !event.defaultPrevented &&
            !event.altKey &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.shiftKey &&
            event.button === 0
          ) {
            event.preventDefault();
            onSelect(item);
          }
        }}
        className={cn(
          'grid gap-x-4 gap-y-3 rounded-xl border border-line-soft bg-surface px-5 py-4',
          'transition-colors duration-150 hover:border-brand-pale hover:bg-brand-wash',
          'lg:grid-cols-[minmax(0,2.1fr)_130px_110px_150px_minmax(0,1.3fr)_28px] lg:items-center',
        )}
      >
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-bold text-navy">
            {item.establishment.name}
          </span>

          <span className="block truncate text-[14px] text-ink-muted">
            {localityLabel(item) || '—'}
          </span>
        </span>

        {/* Below lg the row is a stacked card, so these pair up instead of
            each taking a line of their own. `lg:contents` hands them back to
            the grid once there are columns to sit in. */}
        <span className="flex items-center gap-2.5 lg:contents">
          <LifecycleBadge stage={item.lifecycleStage} />

          <span className="flex items-center">
            <span className="truncate rounded-md bg-surface-muted px-2.5 py-1 text-[13px] font-semibold text-ink-soft">
              {item.campaign.name}
            </span>
          </span>
        </span>

        <span className="flex min-w-0 items-center justify-between gap-3 lg:contents">
          <span className="truncate text-[14px] text-ink-soft">{lastActionLabel(item, t)}</span>

          <span className="flex min-w-0 items-center">
            <NextStepLabel step={nextStep} />
          </span>
        </span>

        <ChevronRight
          aria-hidden="true"
          className="hidden size-5 shrink-0 text-ink-muted lg:block"
        />
      </Link>
    </li>
  );
}

const NEXT_STEP_STYLES: Record<NextStep['tone'], { text: string; icon: typeof Phone }> = {
  blocked: { text: 'text-danger', icon: Ban },
  due: { text: 'text-warning', icon: Phone },
  scheduled: { text: 'text-brand', icon: CalendarClock },
  attention: { text: 'text-warning', icon: TriangleAlert },
  done: { text: 'text-success', icon: CheckCircle2 },
  neutral: { text: 'text-ink-soft', icon: Phone },
};

function NextStepLabel({ step }: { step: NextStep }) {
  const { t } = useTranslation();

  const style = NEXT_STEP_STYLES[step.tone];

  return (
    <span
      className={cn('inline-flex min-w-0 items-center gap-2 text-[14px] font-bold', style.text)}
    >
      <style.icon aria-hidden="true" className="size-4 shrink-0" />

      <span className="truncate">{t(step.label, step.values)}</span>
    </span>
  );
}

function PortfolioSkeleton() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-2" aria-busy="true" aria-live="polite">
      <span className="sr-only">{t('portfolio.loading')}</span>

      {[0, 1, 2, 3, 4, 5].map((row) => (
        <div key={row} className="h-[76px] animate-pulse rounded-xl bg-line-soft" />
      ))}
    </div>
  );
}
