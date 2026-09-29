'use client';
import { useLiveRefresh } from '@/lib/live/use-live-refresh';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building2, Megaphone, MapPin, SearchX } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { SearchInput } from '@/components/ui/search-input';
import { ApiError } from '@/lib/api/api-error';
import { search as runSearch, searchFacets } from '@/lib/api/search-client';
import {
  MAX_SEARCH_LENGTH,
  MIN_SEARCH_LENGTH,
  isSearchable,
  searchResultHref,
  searchTypeLabel,
  type SearchFacet,
  type SearchResult,
  type SearchResultType,
  type SearchScope,
} from '@/lib/api/search-types';
import { cn } from '@/lib/ui/cn';

/* Long enough that typing a word does not fire five queries. */
const DEBOUNCE_MS = 300;

const ICONS: Record<SearchResultType, typeof MapPin> = {
  prospect: MapPin,
  organization: Building2,
  campaign: Megaphone,
};

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchSkeleton />}>
      <SearchView />
    </Suspense>
  );
}

function SearchView() {
  const router = useRouter();
  const params = useSearchParams();

  const [query, setQuery] = useState(params.get('q') ?? '');
  const [scope, setScope] = useState<SearchScope>('all');
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [facets, setFacets] = useState<SearchFacet[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Holds the in-flight request so a superseded query cannot land last and
   * overwrite the results of the one the user is actually waiting on. */
  const inFlight = useRef<AbortController | null>(null);

  const load = useCallback((term: string, type: SearchScope) => {
    inFlight.current?.abort();

    if (!isSearchable(term)) {
      setResults(null);
      setFacets([]);
      setLoading(false);
      setError(null);

      return;
    }

    const controller = new AbortController();

    inFlight.current = controller;

    setLoading(true);
    setError(null);

    Promise.all([
      runSearch(term, { type, limit: 50 }, controller.signal),
      searchFacets(term, controller.signal).catch(() => ({ facets: [] as SearchFacet[] })),
    ])
      .then(([page, facetResult]) => {
        if (controller.signal.aborted) {
          return;
        }

        setResults(page.items);
        setFacets(facetResult.facets ?? []);
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setResults([]);
        setError(describeSearchError(caught));
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => load(query, scope), DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [load, query, scope]);

  useLiveRefresh(() => load(query, scope), { enabled: query.trim().length > 0 });

  /* The term lives in the URL so a search can be shared or reloaded. */
  useEffect(() => {
    const timer = setTimeout(() => {
      const next = query.trim() ? `/search?q=${encodeURIComponent(query.trim())}` : '/search';

      router.replace(next, { scroll: false });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, router]);

  useEffect(() => () => inFlight.current?.abort(), []);

  const total = useMemo(() => facets.reduce((sum, facet) => sum + facet.count, 0), [facets]);

  const tooShort = query.trim().length > 0 && query.trim().length < MIN_SEARCH_LENGTH;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Search"
        subtitle="Prospects, organizations and campaigns you are authorised to see"
      />

      <Card>
        <SearchInput
          label="Search"
          placeholder="Search by name, city or campaign…"
          value={query}
          maxLength={MAX_SEARCH_LENGTH}
          onChange={(event) => setQuery(event.target.value)}
        />

        {tooShort ? (
          <p className="mt-2 text-[13px] text-ink-muted">
            Type at least {MIN_SEARCH_LENGTH} characters.
          </p>
        ) : null}

        {facets.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <ScopeChip
              label="All"
              count={total}
              active={scope === 'all'}
              onSelect={() => setScope('all')}
            />

            {facets.map((facet) => (
              <ScopeChip
                key={facet.type}
                label={searchTypeLabel(facet.type)}
                count={facet.count}
                active={scope === facet.type}
                onSelect={() => setScope(facet.type)}
              />
            ))}
          </div>
        ) : null}
      </Card>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <Card>
        {loading && results === null ? (
          <div className="flex flex-col gap-2" aria-busy="true">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="h-14 animate-pulse rounded-lg bg-line-soft" />
            ))}
          </div>
        ) : results === null ? (
          <p className="py-14 text-center text-[15px] text-ink-muted">
            Start typing to search across your workspace.
          </p>
        ) : results.length === 0 ? (
          <div className="py-14 text-center">
            <SearchX aria-hidden="true" className="mx-auto size-8 text-line" />

            <p className="mt-3 text-[16px] font-semibold text-navy">
              Nothing matches “{query.trim()}”
            </p>

            <p className="mx-auto mt-2 max-w-md text-[15px] text-ink-muted">
              Search only covers records your workspace authorises. Try a different spelling or a
              city name.
            </p>
          </div>
        ) : (
          <ul
            aria-label="Search results"
            aria-busy={loading}
            className="flex flex-col divide-y divide-line-soft"
          >
            {results.map((result) => {
              const Icon = ICONS[result.type] ?? MapPin;
              const href = searchResultHref(result);

              const body = (
                <span className="flex w-full items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-ink-muted"
                  >
                    <Icon className="size-4" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-navy">
                      {result.title}
                    </span>

                    <span className="block truncate text-[13px] text-ink-muted">
                      {result.subtitle ?? '—'} · updated {formatDate(result.updatedAt)}
                    </span>
                  </span>

                  <Badge tone="neutral">{searchTypeLabel(result.type)}</Badge>
                </span>
              );

              return (
                <li key={`${result.type}-${result.id}`} className="py-2.5">
                  {href ? (
                    <Link href={href} className="block rounded-lg hover:opacity-80">
                      {body}
                    </Link>
                  ) : (
                    /* No detail route exists for this type yet, so the row
                       stays inert rather than linking to a 404. */
                    <span className="block">{body}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function ScopeChip({
  label,
  count,
  active,
  onSelect,
}: {
  label: string;
  count: number;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[14px] font-semibold',
        'transition-colors duration-150',
        active ? 'bg-brand-tint text-brand' : 'bg-surface-muted text-ink-soft hover:text-ink',
      )}
    >
      {label}

      <span
        className={cn(
          'rounded-full px-1.5 py-0.5 text-[12px] font-bold',
          active ? 'bg-brand text-white' : 'bg-line-soft text-ink-soft',
        )}
      >
        {count}
      </span>
    </button>
  );
}

function SearchSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <div className="h-16 animate-pulse rounded-xl bg-line-soft" />

      <div className="h-64 animate-pulse rounded-xl bg-line-soft" />
    </div>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function describeSearchError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return 'Something went wrong. Please try again.';
  }

  if (error.statusCode === 403) {
    return 'You do not have access to search this workspace.';
  }

  if (error.statusCode === 400) {
    return error.messages.join(' ');
  }

  return 'We could not reach search. Please try again.';
}
