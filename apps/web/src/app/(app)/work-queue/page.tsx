'use client';

import {
  Building2,
  ClipboardList,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  ShieldAlert,
  X,
} from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '@/lib/api/api-error';
import { listWorkQueue } from '@/lib/api/work-queue-client';
import type { WorkQueueItem, WorkQueuePage } from '@/lib/api/work-queue-types';
import { useAuth } from '@/lib/auth/auth-context';

import styles from './page.module.css';

const PAGE_SIZE = 25;

function formatAssignedAt(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatLocation(item: WorkQueueItem): string | null {
  const parts = [
    item.establishment.postalCode,
    item.establishment.city,
    item.establishment.countryCode,
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

  return parts.length > 0 ? parts.join(' · ') : null;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.statusCode === 403) {
      return 'You no longer have access to this Prospector workspace.';
    }

    if (error.statusCode === 401) {
      return 'Your TrackRoster session has expired. Refresh the page to restore your session.';
    }

    if (error.messages.length > 0) {
      return error.messages.join(', ');
    }
  }

  return 'TrackRoster could not load your work queue. Please try again.';
}

function mergeQueueItems(
  currentItems: WorkQueueItem[],
  nextItems: WorkQueueItem[],
): WorkQueueItem[] {
  const itemsByAssignmentId = new Map<string, WorkQueueItem>();

  for (const item of currentItems) {
    itemsByAssignmentId.set(item.assignment.id, item);
  }

  for (const item of nextItems) {
    itemsByAssignmentId.set(item.assignment.id, item);
  }

  return [...itemsByAssignmentId.values()];
}

interface LoadQueueOptions {
  cursor?: string;

  append: boolean;
}

export default function WorkQueuePage() {
  const { activeWorkspace } = useAuth();

  const [items, setItems] = useState<WorkQueueItem[]>([]);

  const [page, setPage] = useState<WorkQueuePage | null>(null);

  const [loading, setLoading] = useState(false);

  const [loadingMore, setLoadingMore] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');

  const [appliedSearch, setAppliedSearch] = useState('');

  /*
   * Every request receives a monotonically increasing
   * sequence number.
   *
   * When the workspace, search, refresh, or page changes,
   * a response from an older request is ignored.
   */
  const requestSequence = useRef(0);

  const teamId =
    activeWorkspace?.mode === 'prospector' && activeWorkspace.scopeType === 'team'
      ? activeWorkspace.teamId
      : null;

  const loadQueue = useCallback(
    async ({ cursor, append }: LoadQueueOptions): Promise<void> => {
      if (!teamId) {
        requestSequence.current += 1;

        setItems([]);
        setPage(null);
        setError(null);
        setLoadMoreError(null);
        setLoading(false);
        setLoadingMore(false);

        return;
      }

      const requestId = ++requestSequence.current;

      if (append) {
        setLoadingMore(true);
        setLoadMoreError(null);
      } else {
        setLoading(true);
        setError(null);
        setLoadMoreError(null);

        /*
         * Do not leave rows from an old workspace or
         * previous search visible while a new queue is
         * being resolved.
         */
        setItems([]);
        setPage(null);
      }

      try {
        const response = await listWorkQueue({
          teamId,

          limit: PAGE_SIZE,

          ...(appliedSearch
            ? {
                q: appliedSearch,
              }
            : {}),

          ...(cursor
            ? {
                cursor,
              }
            : {}),
        });

        if (requestId !== requestSequence.current) {
          return;
        }

        if (append) {
          setItems((currentItems) => mergeQueueItems(currentItems, response.items));
        } else {
          setItems(response.items);
        }

        setPage(response.page);
      } catch (loadError) {
        if (requestId !== requestSequence.current) {
          return;
        }

        const message = getErrorMessage(loadError);

        if (append) {
          /*
           * A later-page failure must not destroy
           * already loaded queue rows.
           */
          setLoadMoreError(message);
        } else {
          setItems([]);
          setPage(null);
          setError(message);
        }
      } finally {
        if (requestId === requestSequence.current) {
          if (append) {
            setLoadingMore(false);
          } else {
            setLoading(false);
          }
        }
      }
    },
    [appliedSearch, teamId],
  );

  useEffect(() => {
    if (!teamId) {
      requestSequence.current += 1;

      setItems([]);
      setPage(null);
      setError(null);
      setLoadMoreError(null);
      setLoading(false);
      setLoadingMore(false);

      return;
    }

    void loadQueue({
      append: false,
    });
  }, [teamId, appliedSearch, loadQueue]);

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const nextSearch = searchInput.trim();

    /*
     * Re-submitting the same query acts as a refresh.
     */
    if (nextSearch === appliedSearch) {
      void loadQueue({
        append: false,
      });

      return;
    }

    /*
     * Changing appliedSearch triggers a fresh first-page
     * request through the effect above. No old cursor is
     * carried into the new search.
     */
    setAppliedSearch(nextSearch);
  }

  function handleClearSearch(): void {
    setSearchInput('');

    if (!appliedSearch) {
      return;
    }

    setAppliedSearch('');
  }

  function handleLoadMore(): void {
    if (loading || loadingMore || !page?.hasMore || !page.nextCursor) {
      return;
    }

    void loadQueue({
      append: true,
      cursor: page.nextCursor,
    });
  }

  if (!teamId) {
    return (
      <main className={styles.page}>
        <section className={styles.unavailableCard} aria-labelledby="work-queue-unavailable-title">
          <div className={styles.unavailableIcon}>
            <ShieldAlert size={24} strokeWidth={1.8} aria-hidden="true" />
          </div>

          <p className={styles.eyebrow}>Prospector workspace required</p>

          <h1 id="work-queue-unavailable-title">Work Queue is not available in this workspace.</h1>

          <p className={styles.unavailableMessage}>
            Select a Prospector team workspace from the sidebar to view assigned prospecting work.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Prospecting</p>

          <h1>Work Queue</h1>

          <p className={styles.pageDescription}>
            Active prospects currently assigned to you in this team workspace.
          </p>
        </div>

        <button
          type="button"
          className={styles.refreshButton}
          onClick={() => {
            void loadQueue({
              append: false,
            });
          }}
          disabled={loading || loadingMore}
        >
          <RefreshCw size={17} strokeWidth={1.9} aria-hidden="true" />

          <span>{loading ? 'Refreshing…' : 'Refresh'}</span>
        </button>
      </header>

      <section className={styles.controls}>
        <form className={styles.searchForm} onSubmit={handleSearchSubmit} role="search">
          <div className={styles.searchField}>
            <Search size={18} strokeWidth={1.9} aria-hidden="true" />

            <input
              type="search"
              value={searchInput}
              onChange={(event) => {
                setSearchInput(event.target.value);
              }}
              maxLength={100}
              placeholder="Search establishments, city or postal code"
              aria-label="Search Work Queue"
            />

            {searchInput ? (
              <button
                type="button"
                className={styles.inputClearButton}
                onClick={() => {
                  setSearchInput('');
                }}
                aria-label="Clear search input"
              >
                <X size={17} strokeWidth={2} aria-hidden="true" />
              </button>
            ) : null}
          </div>

          <button type="submit" className={styles.searchButton} disabled={loading || loadingMore}>
            Search
          </button>

          {appliedSearch ? (
            <button
              type="button"
              className={styles.clearSearchButton}
              onClick={handleClearSearch}
              disabled={loading || loadingMore}
            >
              Clear
            </button>
          ) : null}
        </form>

        {appliedSearch ? (
          <p className={styles.activeFilter} aria-live="polite">
            Results for <strong>“{appliedSearch}”</strong>
          </p>
        ) : null}
      </section>

      <section className={styles.summaryBar} aria-label="Work Queue summary">
        <div className={styles.summaryIcon}>
          <ClipboardList size={20} strokeWidth={1.9} aria-hidden="true" />
        </div>

        <div>
          <span className={styles.summaryValue}>{loading ? '—' : items.length}</span>

          <span className={styles.summaryLabel}>
            {items.length === 1 ? 'prospect loaded' : 'prospects loaded'}
          </span>
        </div>
      </section>

      {loading ? (
        <section className={styles.stateCard} role="status" aria-live="polite">
          <div className={styles.spinner} />

          <div>
            <h2>{appliedSearch ? 'Searching your work queue' : 'Loading your work queue'}</h2>

            <p>TrackRoster is retrieving your active assignments.</p>
          </div>
        </section>
      ) : null}

      {error ? (
        <section className={styles.errorCard} role="alert" aria-live="assertive">
          <div className={styles.errorIcon}>
            <ShieldAlert size={22} strokeWidth={1.8} aria-hidden="true" />
          </div>

          <div className={styles.errorContent}>
            <h2>Work Queue unavailable</h2>

            <p>{error}</p>

            <button
              type="button"
              onClick={() => {
                void loadQueue({
                  append: false,
                });
              }}
            >
              Try again
            </button>
          </div>
        </section>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <section className={styles.emptyCard}>
          <div className={styles.emptyIcon}>
            <ClipboardList size={24} strokeWidth={1.8} aria-hidden="true" />
          </div>

          <h2>{appliedSearch ? 'No matching prospects.' : 'Your queue is clear.'}</h2>

          <p>
            {appliedSearch
              ? 'No active assignments in this workspace match your search.'
              : 'There are currently no active prospects assigned to you in this team workspace.'}
          </p>

          {appliedSearch ? (
            <button type="button" className={styles.emptyClearButton} onClick={handleClearSearch}>
              Clear search
            </button>
          ) : null}
        </section>
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <>
          <section className={styles.queueList} aria-label="Assigned prospects">
            {items.map((item) => {
              const location = formatLocation(item);

              return (
                <article key={item.assignment.id} className={styles.queueCard}>
                  <div className={styles.cardPrimary}>
                    <div className={styles.establishmentIcon}>
                      <Building2 size={21} strokeWidth={1.8} aria-hidden="true" />
                    </div>

                    <div className={styles.establishmentContent}>
                      <div className={styles.cardTitleRow}>
                        <h2>{item.establishment.name}</h2>

                        <span className={styles.statusBadge}>Assigned</span>
                      </div>

                      <p className={styles.campaignName}>{item.campaign.name}</p>

                      <div className={styles.metadata}>
                        {location ? (
                          <span>
                            <MapPin size={15} strokeWidth={1.9} aria-hidden="true" />

                            {location}
                          </span>
                        ) : null}

                        {item.establishment.phone ? (
                          <span>
                            <Phone size={15} strokeWidth={1.9} aria-hidden="true" />

                            {item.establishment.phone}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className={styles.cardAside}>
                    <span className={styles.assignedLabel}>Assigned</span>

                    <time dateTime={item.assignment.assignedAt}>
                      {formatAssignedAt(item.assignment.assignedAt)}
                    </time>
                  </div>
                </article>
              );
            })}
          </section>

          {loadMoreError ? (
            <div className={styles.paginationError} role="alert">
              <span>{loadMoreError}</span>

              <button type="button" onClick={handleLoadMore} disabled={loadingMore}>
                Retry
              </button>
            </div>
          ) : null}

          {page?.hasMore && page.nextCursor ? (
            <div className={styles.pagination}>
              <button
                type="button"
                className={styles.loadMoreButton}
                onClick={handleLoadMore}
                disabled={loading || loadingMore}
              >
                {loadingMore ? (
                  <>
                    <span className={styles.smallSpinner} aria-hidden="true" />
                    Loading more…
                  </>
                ) : (
                  'Load more'
                )}
              </button>
            </div>
          ) : (
            <p className={styles.endOfQueue}>
              {items.length > 0 ? 'You have reached the end of this queue.' : null}
            </p>
          )}
        </>
      ) : null}
    </main>
  );
}
