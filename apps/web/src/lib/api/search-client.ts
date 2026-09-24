import { browserJson } from './browser-json';
import type { SearchFacets, SearchResultPage, SearchScope } from './search-types';

export function search(
  query: string,
  options: { type?: SearchScope; limit?: number; cursor?: string } = {},
  signal?: AbortSignal,
): Promise<SearchResultPage> {
  const params = new URLSearchParams({ q: query });

  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }

  return browserJson<SearchResultPage>(`/api/search?${params.toString()}`, {
    cache: 'no-store',
    signal,
  });
}

export function searchFacets(query: string, signal?: AbortSignal): Promise<SearchFacets> {
  return browserJson<SearchFacets>(`/api/search/facets?q=${encodeURIComponent(query)}`, {
    cache: 'no-store',
    signal,
  });
}
