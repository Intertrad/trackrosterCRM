import { browserJson } from './browser-json';
import type {
  ProspectCampaignMembershipPage,
  ProspectDetail,
  ProspectPage,
  ProspectQuery,
} from './prospect-types';

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

/**
 * One establishment, with its tags and custom fields.
 *
 * The API answers 404 rather than 403 for a record the caller may not see, so a
 * missing establishment and an unauthorised one are deliberately
 * indistinguishable from here — that is the API not disclosing what exists.
 */
export function getProspect(prospectId: string, signal?: AbortSignal): Promise<ProspectDetail> {
  return browserJson<ProspectDetail>(`/api/prospects/${encodeURIComponent(prospectId)}`, {
    cache: 'no-store',
    signal,
  });
}

/**
 * The campaigns holding this establishment, with each one's current state.
 *
 * A summary, not a history: it carries the `campaignProspectId` that the existing
 * activity and follow-up endpoints need, and those remain the way to read depth.
 */
export function listProspectCampaignMemberships(
  prospectId: string,
  signal?: AbortSignal,
): Promise<ProspectCampaignMembershipPage> {
  return browserJson<ProspectCampaignMembershipPage>(
    `/api/prospects/${encodeURIComponent(prospectId)}/campaign-memberships`,
    { cache: 'no-store', signal },
  );
}
