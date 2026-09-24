'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { List, Map as MapIcon, MapPin, Phone } from 'lucide-react';

import {
  LIFECYCLE_ORDER,
  LifecycleBadge,
  getLifecycleLabel,
} from '@/components/prospector/lifecycle-badge';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FilterSelect } from '@/components/ui/filter-select';
import { PageHeader } from '@/components/ui/page-header';
import { ProspectMap, toMapPoint, type MapPoint } from '@/components/prospector/prospect-map';
import { LinkButton } from '@/components/ui/link-button';
import { SearchInput } from '@/components/ui/search-input';
import { ApiError } from '@/lib/api/api-error';
import { getWorkQueueOptions, listWorkQueue } from '@/lib/api/work-queue-client';
import type {
  WorkQueueCampaignOption,
  WorkQueueItem,
  WorkQueueLifecycleStage,
} from '@/lib/api/work-queue-types';
import { useAuth } from '@/lib/auth/auth-context';
import { cn } from '@/lib/ui/cn';

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;

export default function MyProspectsPage() {
  const { activeWorkspace } = useAuth();

  const teamId = activeWorkspace?.teamId ?? null;

  const [view, setView] = useState<'list' | 'map'>('list');
  const [selected, setSelected] = useState<MapPoint | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [stage, setStage] = useState<WorkQueueLifecycleStage | 'all'>('all');
  const [campaignId, setCampaignId] = useState('all');

  const [campaigns, setCampaigns] = useState<WorkQueueCampaignOption[]>([]);
  const [items, setItems] = useState<WorkQueueItem[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Typing must not fire a request per keystroke. */
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!teamId) {
      return;
    }

    const controller = new AbortController();

    getWorkQueueOptions({ teamId, signal: controller.signal })
      .then((options) => setCampaigns(options.campaigns))
      .catch(() => setCampaigns([]));

    return () => controller.abort();
  }, [teamId]);

  const requestRef = useRef(0);

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      if (!teamId) {
        return;
      }

      const requestId = ++requestRef.current;

      try {
        const response = await listWorkQueue({
          teamId,
          limit: PAGE_SIZE,
          ...(debouncedSearch ? { q: debouncedSearch } : {}),
          ...(stage !== 'all' ? { lifecycleStage: stage } : {}),
          ...(campaignId !== 'all' ? { campaignId } : {}),
          signal,
        });

        /* Drop a slower response from an earlier filter combination. */
        if (signal?.aborted || requestId !== requestRef.current) {
          return;
        }

        setItems(response.items);
        setNextCursor(response.page.nextCursor);
        setError(null);
      } catch (caught) {
        if (signal?.aborted || requestId !== requestRef.current) {
          return;
        }

        setError(
          caught instanceof ApiError && caught.statusCode === 401
            ? 'Your session has expired. Please sign in again.'
            : 'We could not load your portfolio. Please try again.',
        );
      }
    },
    [campaignId, debouncedSearch, stage, teamId],
  );

  useEffect(() => {
    const controller = new AbortController();

    void load(controller.signal);

    return () => controller.abort();
  }, [load]);

  async function loadMore(): Promise<void> {
    if (!teamId || !nextCursor) {
      return;
    }

    setLoadingMore(true);

    try {
      const response = await listWorkQueue({
        teamId,
        limit: PAGE_SIZE,
        cursor: nextCursor,
        ...(debouncedSearch ? { q: debouncedSearch } : {}),
        ...(stage !== 'all' ? { lifecycleStage: stage } : {}),
        ...(campaignId !== 'all' ? { campaignId } : {}),
      });

      setItems((current) => [...(current ?? []), ...response.items]);
      setNextCursor(response.page.nextCursor);
    } catch {
      setError('We could not load more prospects.');
    } finally {
      setLoadingMore(false);
    }
  }

  const filtered = useMemo(
    () => debouncedSearch !== '' || stage !== 'all' || campaignId !== 'all',
    [campaignId, debouncedSearch, stage],
  );

  /* Only geocoded establishments can be plotted; the rest stay in the list. */
  const points = useMemo<MapPoint[]>(
    () =>
      (items ?? []).flatMap((item) =>
        toMapPoint(
          item.campaignProspectId,
          item.establishment.name,
          item.establishment.latitude,
          item.establishment.longitude,
          item.lifecycleStage,
          `/work-queue/${item.campaign.id}/${item.campaignProspectId}`,
        ),
      ),
    [items],
  );

  const missingCoordinates = (items?.length ?? 0) - points.length;

  if (!teamId) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="My prospects" />

        <Alert tone="info" title="This view is scoped to a team.">
          Switch to a team workspace to see the portfolio assigned to you.
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="My prospects"
        subtitle={
          items
            ? `${items.length}${nextCursor ? '+' : ''} establishments assigned to you`
            : 'Loading your portfolio…'
        }
        action={
          <div
            role="group"
            aria-label="View"
            className="inline-flex rounded-lg border border-line bg-surface p-1"
          >
            {(
              [
                { id: 'list', label: 'List', icon: List },
                { id: 'map', label: 'Map', icon: MapIcon },
              ] as const
            ).map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setView(option.id)}
                aria-pressed={view === option.id}
                className={cn(
                  'inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-[14px] font-semibold transition-colors',
                  view === option.id ? 'bg-brand text-white' : 'text-ink-soft hover:text-ink',
                )}
              >
                <option.icon aria-hidden="true" className="size-[18px]" />
                {option.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="flex flex-wrap gap-3">
        <SearchInput
          label="Search my portfolio"
          placeholder="Search my portfolio..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="min-w-[240px] flex-1"
        />

        <FilterSelect
          label="Status"
          value={stage}
          onChange={(value) => setStage(value as WorkQueueLifecycleStage | 'all')}
          options={[
            { value: 'all', label: 'All' },
            ...LIFECYCLE_ORDER.map((value) => ({
              value,
              label: getLifecycleLabel(value),
            })),
          ]}
        />

        <FilterSelect
          label="Campaign"
          value={campaignId}
          onChange={setCampaignId}
          options={[
            { value: 'all', label: 'All' },
            ...campaigns.map((campaign) => ({ value: campaign.id, label: campaign.name })),
          ]}
        />
      </div>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {view === 'map' ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
          <ProspectMap points={points} onSelect={setSelected} />

          <Card>
            <h2 className="text-[19px] font-bold tracking-[-0.015em] text-navy">
              {selected ? selected.name : 'Nearby prospects'}
            </h2>

            {selected ? (
              <div className="mt-4">
                <LinkButton href={selected.href ?? '/work-queue'} variant="primary">
                  Open prospect
                </LinkButton>
              </div>
            ) : (
              <p className="mt-2 text-[14px] text-ink-muted">Select a marker to open its record.</p>
            )}

            <p className="mt-5 border-t border-line-soft pt-4 text-[13px] text-ink-muted">
              {points.length} of {items?.length ?? 0} plotted
              {missingCoordinates > 0 ? ` · ${missingCoordinates} without coordinates` : ''}
            </p>
          </Card>
        </div>
      ) : items === null ? (
        <ListSkeleton />
      ) : items.length === 0 ? (
        <Card>
          <p className="py-10 text-center text-[15px] text-ink-muted">
            {filtered
              ? 'No prospects match these filters.'
              : 'No establishments are assigned to you yet.'}
          </p>
        </Card>
      ) : (
        <>
          <Card className="p-0 sm:p-0">
            <ul className="divide-y divide-line-soft">
              {items.map((item) => (
                <ProspectRow key={item.campaignProspectId} item={item} />
              ))}
            </ul>
          </Card>

          {nextCursor ? (
            <Button
              variant="secondary"
              className="self-center"
              loading={loadingMore}
              onClick={() => void loadMore()}
            >
              Load more
            </Button>
          ) : null}
        </>
      )}

      <p className="text-[13px] text-ink-muted">
        Personal scope: only prospects assigned to you are shown — no territory-wide or unassigned
        records.
      </p>
    </div>
  );
}

function ProspectRow({ item }: { item: WorkQueueItem }) {
  const href = `/work-queue/${item.campaign.id}/${item.campaignProspectId}`;

  const location = [item.establishment.postalCode, item.establishment.city]
    .filter(Boolean)
    .join(' ');

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 sm:px-6">
      <span className="min-w-0 flex-1 basis-56">
        <Link
          href={href}
          className="block truncate text-[15px] font-bold text-navy hover:text-brand"
        >
          {item.establishment.name}
        </Link>

        <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-ink-muted">
          {location ? (
            <span className="inline-flex items-center gap-1.5">
              <MapPin aria-hidden="true" className="size-4" />
              {location}
            </span>
          ) : null}

          {item.establishment.phone ? (
            <span className="inline-flex items-center gap-1.5">
              <Phone aria-hidden="true" className="size-4" />
              {item.establishment.phone}
            </span>
          ) : null}
        </span>
      </span>

      <span className="hidden w-40 shrink-0 truncate text-[14px] text-ink-soft lg:block">
        {item.campaign.name}
      </span>

      <span className="w-32 shrink-0 text-[14px] text-ink-muted">
        {item.nextFollowUp ? formatDate(item.nextFollowUp.dueAt) : '—'}
      </span>

      <LifecycleBadge stage={item.lifecycleStage} className="shrink-0" />
    </li>
  );
}

function ListSkeleton() {
  return (
    <Card className="p-0 sm:p-0" aria-busy="true">
      <span className="sr-only">Loading your portfolio…</span>

      <ul className="divide-y divide-line-soft">
        {[0, 1, 2, 3, 4, 5].map((row) => (
          <li key={row} className="flex animate-pulse items-center gap-4 px-6 py-5">
            <span className="h-5 flex-1 rounded bg-line-soft" />
            <span className="h-6 w-24 rounded-md bg-line-soft" />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}
