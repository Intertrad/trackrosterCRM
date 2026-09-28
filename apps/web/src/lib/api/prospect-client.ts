import { browserJson } from './browser-json';
import type { ProspectPage, ProspectQuery } from './prospect-types';

/**
 * One page of the shared référentiel.
 *
 * Every filter goes to the server. The base is 14,649 establishments and a page
 * is at most 100, so narrowing a loaded page would search the page and report
 * nothing for the rest.
 */
export function listProspects(
  query: ProspectQuery = {},
  signal?: AbortSignal,
): Promise<ProspectPage> {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    /* An empty filter is no filter; sending it would be a 400 on a length rule. */
    if (value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  }

  const search = params.toString();

  return browserJson<ProspectPage>(search ? `/api/prospects?${search}` : '/api/prospects', {
    cache: 'no-store',
    signal,
  });
}
