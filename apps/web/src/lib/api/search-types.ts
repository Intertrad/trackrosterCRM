export type SearchResultType = 'prospect' | 'organization' | 'campaign';

export type SearchScope = 'all' | SearchResultType;

export interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string | null;
  updatedAt: string;
}

export interface SearchResultPage {
  items: SearchResult[];
  nextCursor: string | null;
}

export interface SearchFacet {
  type: SearchResultType;
  count: number;
}

export interface SearchFacets {
  facets: SearchFacet[];
  [key: string]: unknown;
}

/** The API rejects anything shorter, so the UI must not ask for it. */
export const MIN_SEARCH_LENGTH = 2;

export const MAX_SEARCH_LENGTH = 120;

const TYPE_LABELS: Record<SearchResultType, string> = {
  prospect: 'Prospect',
  organization: 'Organization',
  campaign: 'Campaign',
};

export function searchTypeLabel(type: SearchResultType): string {
  return TYPE_LABELS[type] ?? type;
}

/**
 * Where a result opens.
 *
 * Only prospects have a detail route today, and reaching one needs a campaign
 * the search response does not carry — so a prospect result routes into the
 * work queue, which resolves the campaign itself. Returning null is how a
 * result says "no destination", rather than linking somewhere that 404s.
 */
export function searchResultHref(result: SearchResult): string | null {
  switch (result.type) {
    case 'campaign':
      return `/manager/campaigns/${result.id}`;
    case 'prospect':
      return `/work-queue?search=${encodeURIComponent(result.title)}`;
    default:
      return null;
  }
}

/** A query the API will accept; anything else should not be sent. */
export function isSearchable(query: string): boolean {
  const trimmed = query.trim();

  return trimmed.length >= MIN_SEARCH_LENGTH && trimmed.length <= MAX_SEARCH_LENGTH;
}
