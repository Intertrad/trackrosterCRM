'use client';

import {
  ChevronDown,
  ChevronRight,
  List,
  LoaderCircle,
  Map as MapIcon,
  RotateCcw,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { WorkQueueItem, WorkQueueResponse } from '@/lib/work-queue-types';

import './work-queue.css';

const PAGE_SIZE = 20;

type QuickFilter = 'all' | 'with-contact' | 'without-contact' | 'recent';

type SortOrder = 'newest' | 'oldest' | 'name';

function formatAssignedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return new Intl.DateTimeFormat('en', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatLocation(item: WorkQueueItem) {
  const location = [item.establishment.postalCode, item.establishment.city]
    .filter(Boolean)
    .join(' ');

  return location || item.establishment.countryCode;
}

function isRecentlyAssigned(assignedAt: string) {
  const assignedDate = new Date(assignedAt);

  if (Number.isNaN(assignedDate.getTime())) {
    return false;
  }

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  return assignedDate.getTime() >= sevenDaysAgo;
}

export default function WorkQueuePage() {
  const router = useRouter();

  const [items, setItems] = useState<WorkQueueItem[]>([]);

  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');

  const [search, setSearch] = useState('');

  const [campaignId, setCampaignId] = useState('all');

  const [contactFilter, setContactFilter] = useState('all');

  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');

  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');

  const [isLoading, setIsLoading] = useState(true);

  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const loadQueue = useCallback(
    async ({ cursor, append }: { cursor?: string; append: boolean }) => {
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }

      setError(null);

      try {
        const params = new URLSearchParams();

        params.set('limit', String(PAGE_SIZE));

        if (search) {
          params.set('search', search);
        }

        if (cursor) {
          params.set('cursor', cursor);
        }

        const response = await fetch(`/api/work-queue?${params.toString()}`, {
          cache: 'no-store',
        });

        if (response.status === 401) {
          router.replace('/login');
          router.refresh();
          return;
        }

        if (response.status === 403) {
          setError('A Prospector workspace is required to view the work queue.');

          if (!append) {
            setItems([]);
            setNextCursor(null);
          }

          return;
        }

        if (!response.ok) {
          throw new Error('Unable to load work queue');
        }

        const data = (await response.json()) as WorkQueueResponse;

        setItems((current) => (append ? [...current, ...data.items] : data.items));

        setNextCursor(data.nextCursor);
      } catch {
        setError('We could not load your work queue. Please try again.');

        if (!append) {
          setItems([]);
          setNextCursor(null);
        }
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [router, search],
  );

  useEffect(() => {
    void loadQueue({
      append: false,
    });
  }, [loadQueue]);

  const campaigns = useMemo(() => {
    const map = new Map<string, string>();

    for (const item of items) {
      map.set(item.campaign.id, item.campaign.name);
    }

    return [...map.entries()];
  }, [items]);

  const visibleItems = useMemo(() => {
    let result = [...items];

    if (campaignId !== 'all') {
      result = result.filter((item) => item.campaign.id === campaignId);
    }

    if (contactFilter === 'with-contact') {
      result = result.filter((item) => item.primaryContact !== null);
    }

    if (contactFilter === 'without-contact') {
      result = result.filter((item) => item.primaryContact === null);
    }

    if (quickFilter === 'with-contact') {
      result = result.filter((item) => item.primaryContact !== null);
    }

    if (quickFilter === 'without-contact') {
      result = result.filter((item) => item.primaryContact === null);
    }

    if (quickFilter === 'recent') {
      result = result.filter((item) => isRecentlyAssigned(item.assignedAt));
    }

    result.sort((a, b) => {
      if (sortOrder === 'name') {
        return a.establishment.name.localeCompare(b.establishment.name);
      }

      const left = new Date(a.assignedAt).getTime();

      const right = new Date(b.assignedAt).getTime();

      return sortOrder === 'oldest' ? left - right : right - left;
    });

    return result;
  }, [campaignId, contactFilter, items, quickFilter, sortOrder]);

  function resetFilters() {
    setSearchInput('');
    setSearch('');
    setCampaignId('all');
    setContactFilter('all');
    setQuickFilter('all');
    setSortOrder('newest');
  }

  return (
    <main className="work-queue-page">
      <header className="work-queue-header">
        <div>
          <h1>Work Queue</h1>

          <p>
            {items.length} {items.length === 1 ? 'establishment' : 'establishments'} assigned to me
          </p>
        </div>

        <div className="work-queue-view-toggle">
          <button type="button" className="work-queue-view-button work-queue-view-button--active">
            <List size={21} />
            List
          </button>

          <button
            type="button"
            className="work-queue-view-button"
            disabled
            title="Map view will be connected later"
          >
            <MapIcon size={21} />
            Map
          </button>
        </div>
      </header>

      <section className="work-queue-filters">
        <label className="work-queue-search">
          <Search size={21} />

          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search my portfolio..."
          />
        </label>

        <label className="work-queue-select">
          <span>
            Contact:{' '}
            <strong>
              {contactFilter === 'all'
                ? 'All'
                : contactFilter === 'with-contact'
                  ? 'Available'
                  : 'Missing'}
            </strong>
          </span>

          <select
            value={contactFilter}
            onChange={(event) => setContactFilter(event.target.value)}
            aria-label="Filter by contact"
          >
            <option value="all">All</option>

            <option value="with-contact">Available</option>

            <option value="without-contact">Missing</option>
          </select>

          <ChevronDown size={18} aria-hidden="true" />
        </label>

        <label className="work-queue-select">
          <span>
            Campaign:{' '}
            <strong>
              {campaignId === 'all'
                ? 'All'
                : (campaigns.find(([id]) => id === campaignId)?.[1] ?? 'All')}
            </strong>
          </span>

          <select
            value={campaignId}
            onChange={(event) => setCampaignId(event.target.value)}
            aria-label="Filter by campaign"
          >
            <option value="all">All</option>

            {campaigns.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>

          <ChevronDown size={18} aria-hidden="true" />
        </label>

        <label className="work-queue-sort">
          <span>
            Sort:{' '}
            <strong>
              {sortOrder === 'newest' ? 'Newest' : sortOrder === 'oldest' ? 'Oldest' : 'Name'}
            </strong>
          </span>

          <select
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value as SortOrder)}
            aria-label="Sort work queue"
          >
            <option value="newest">Newest</option>

            <option value="oldest">Oldest</option>

            <option value="name">Name</option>
          </select>
        </label>

        <button type="button" className="work-queue-reset" onClick={resetFilters}>
          <RotateCcw size={19} />
          Reset
        </button>

        <button type="button" className="work-queue-views">
          <SlidersHorizontal size={19} />
          Views
        </button>
      </section>

      <section className="work-queue-quick-filters">
        <button
          type="button"
          className={
            quickFilter === 'all' ? 'work-queue-chip work-queue-chip--active' : 'work-queue-chip'
          }
          onClick={() => setQuickFilter('all')}
        >
          All assignments
        </button>

        <button
          type="button"
          className={
            quickFilter === 'with-contact'
              ? 'work-queue-chip work-queue-chip--active'
              : 'work-queue-chip'
          }
          onClick={() => setQuickFilter('with-contact')}
        >
          With contact
        </button>

        <button
          type="button"
          className={
            quickFilter === 'without-contact'
              ? 'work-queue-chip work-queue-chip--active'
              : 'work-queue-chip'
          }
          onClick={() => setQuickFilter('without-contact')}
        >
          Data to complete
        </button>

        <button
          type="button"
          className={
            quickFilter === 'recent' ? 'work-queue-chip work-queue-chip--active' : 'work-queue-chip'
          }
          onClick={() => setQuickFilter('recent')}
        >
          Recently assigned
        </button>
      </section>

      <div className="work-queue-table-head">
        <span>ESTABLISHMENT</span>
        <span>CONTACT</span>
        <span>CAMPAIGN</span>
        <span>ASSIGNED</span>
        <span>NEXT STEP</span>
        <span />
      </div>

      {isLoading ? (
        <div className="work-queue-state">
          <LoaderCircle className="work-queue-spinner" size={27} />
          Loading assignments…
        </div>
      ) : null}

      {!isLoading && error ? (
        <div className="work-queue-state">
          <strong>Unable to load work queue</strong>

          <span>{error}</span>

          <button
            type="button"
            onClick={() =>
              void loadQueue({
                append: false,
              })
            }
          >
            Try again
          </button>
        </div>
      ) : null}

      {!isLoading && !error && visibleItems.length === 0 ? (
        <div className="work-queue-empty">
          <strong>No matching assignments</strong>

          <span>Try changing your search or filters.</span>
        </div>
      ) : null}

      {!isLoading && !error && visibleItems.length > 0 ? (
        <section className="work-queue-list">
          {visibleItems.map((item, index) => (
            <article
              key={item.assignmentId}
              className={
                index === 0 ? 'work-queue-row work-queue-row--highlight' : 'work-queue-row'
              }
            >
              <div className="work-queue-establishment">
                <strong>{item.establishment.name}</strong>

                <span>{formatLocation(item)}</span>
              </div>

              <div className="work-queue-contact-cell">
                {item.primaryContact ? (
                  <>
                    <strong>{item.primaryContact.name ?? 'Contact'}</strong>

                    <span>{item.primaryContact.jobTitle ?? 'Primary contact'}</span>
                  </>
                ) : (
                  <span className="work-queue-missing">Missing</span>
                )}
              </div>

              <div>
                <span className="work-queue-campaign-pill">{item.campaign.name}</span>
              </div>

              <div className="work-queue-assigned-cell">{formatAssignedAt(item.assignedAt)}</div>

              <div className="work-queue-next-step">
                {item.primaryContact ? (
                  <span className="work-queue-next-step--blue">Contact prospect</span>
                ) : (
                  <span className="work-queue-next-step--orange">Complete contact data</span>
                )}
              </div>

              <ChevronRight className="work-queue-chevron" size={24} />
            </article>
          ))}
        </section>
      ) : null}

      {!isLoading && !error && nextCursor ? (
        <div className="work-queue-load-more">
          <button
            type="button"
            disabled={isLoadingMore}
            onClick={() =>
              void loadQueue({
                cursor: nextCursor,
                append: true,
              })
            }
          >
            {isLoadingMore ? (
              <>
                <LoaderCircle className="work-queue-spinner" size={17} />
                Loading…
              </>
            ) : (
              'Load more'
            )}
          </button>
        </div>
      ) : null}
    </main>
  );
}
