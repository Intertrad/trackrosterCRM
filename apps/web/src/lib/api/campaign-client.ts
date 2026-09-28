import { browserJson } from './browser-json';
import { browserResource, type BrowserResource } from './browser-resource';
import type {
  AllocationResult,
  Campaign,
  CampaignEnrolmentResult,
  CampaignEnrolmentSelection,
  CampaignMember,
  CampaignMemberPage,
  CampaignMemberRole,
  CampaignOrganizationPage,
  CampaignPage,
  CampaignStatus,
  CreateCampaignInput,
  ListCampaignsQuery,
  ParticipationState,
  UpdateCampaignInput,
} from './campaign-types';

function writeHeaders(etag?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'idempotency-key': crypto.randomUUID(),
  };

  if (etag) {
    headers['if-match'] = etag;
  }

  return headers;
}

function query(params: object): string {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      search.set(key, String(value));
    }
  }

  return search.toString();
}

export function listCampaigns(
  options: ListCampaignsQuery = {},
  signal?: AbortSignal,
): Promise<CampaignPage> {
  const search = query(options);

  return browserJson<CampaignPage>(search ? `/api/campaigns?${search}` : '/api/campaigns', {
    cache: 'no-store',
    signal,
  });
}

export function getCampaign(
  campaignId: string,
  signal?: AbortSignal,
): Promise<BrowserResource<Campaign>> {
  return browserResource<Campaign>(`/api/campaigns/${encodeURIComponent(campaignId)}`, {
    cache: 'no-store',
    signal,
  });
}

export function createCampaign(input: CreateCampaignInput): Promise<Campaign> {
  return browserJson<Campaign>('/api/campaigns', {
    method: 'POST',
    headers: writeHeaders(),
    body: JSON.stringify(input),
  });
}

export function updateCampaign(
  campaignId: string,
  input: UpdateCampaignInput,
  etag: string | null,
): Promise<Campaign> {
  return browserJson<Campaign>(`/api/campaigns/${encodeURIComponent(campaignId)}`, {
    method: 'PATCH',
    headers: writeHeaders(etag),
    body: JSON.stringify(input),
  });
}

/**
 * Moves a campaign to another status.
 *
 * Separate from PATCH because the API records a reason against the
 * transition and validates which moves are legal.
 */
export function setCampaignStatus(
  campaignId: string,
  status: CampaignStatus,
  reason: string,
  etag: string | null,
): Promise<Campaign> {
  return browserJson<Campaign>(`/api/campaigns/${encodeURIComponent(campaignId)}/status`, {
    method: 'POST',
    headers: writeHeaders(etag),
    body: JSON.stringify({ status, reason }),
  });
}

/* DELETE is an archive upstream, not a hard delete. */
export function archiveCampaign(campaignId: string, etag: string | null): Promise<unknown> {
  return browserJson<unknown>(`/api/campaigns/${encodeURIComponent(campaignId)}`, {
    method: 'DELETE',
    headers: writeHeaders(etag),
  });
}

export function listCampaignMembers(
  campaignId: string,
  options: { state?: ParticipationState | 'all'; cursor?: string; limit?: number } = {},
  signal?: AbortSignal,
): Promise<CampaignMemberPage> {
  const search = query(options);
  const path = `/api/campaigns/${encodeURIComponent(campaignId)}/members`;

  return browserJson<CampaignMemberPage>(search ? `${path}?${search}` : path, {
    cache: 'no-store',
    signal,
  });
}

/*
 * A participant is either a person or a whole team, never both — the API's
 * ParticipantDto accepts membershipId or teamId.
 */
export function addCampaignMember(
  campaignId: string,
  input: {
    role: CampaignMemberRole;
    membershipId?: string;
    teamId?: string;
    startsAt?: string;
  },
): Promise<CampaignMember> {
  return browserJson<CampaignMember>(`/api/campaigns/${encodeURIComponent(campaignId)}/members`, {
    method: 'POST',
    headers: writeHeaders(),
    body: JSON.stringify(input),
  });
}

export function updateCampaignMember(
  memberId: string,
  input: { role?: CampaignMemberRole; startsAt?: string; endsAt?: string | null },
  etag: string | null,
): Promise<CampaignMember> {
  return browserJson<CampaignMember>(`/api/campaign-members/${encodeURIComponent(memberId)}`, {
    method: 'PATCH',
    headers: writeHeaders(etag),
    body: JSON.stringify(input),
  });
}

export function removeCampaignMember(memberId: string, etag: string | null): Promise<unknown> {
  return browserJson<unknown>(`/api/campaign-members/${encodeURIComponent(memberId)}`, {
    method: 'DELETE',
    headers: writeHeaders(etag),
  });
}

export function listCampaignOrganizations(
  campaignId: string,
  options: { state?: 'active' | 'ended' | 'all'; cursor?: string; limit?: number } = {},
  signal?: AbortSignal,
): Promise<CampaignOrganizationPage> {
  const search = query(options);
  const path = `/api/campaigns/${encodeURIComponent(campaignId)}/organizations`;

  return browserJson<CampaignOrganizationPage>(search ? `${path}?${search}` : path, {
    cache: 'no-store',
    signal,
  });
}

/**
 * Distributes prospects across the campaign's territories.
 *
 * `preview` is a dry run and changes nothing; `apply` commits. The two share
 * a payload so a caller can show the outcome before committing to it.
 */
export function previewGeographicAllocation(
  campaignId: string,
  prospectIds: string[],
): Promise<AllocationResult> {
  return browserJson<AllocationResult>(
    `/api/campaigns/${encodeURIComponent(campaignId)}/geographic-allocation/preview`,
    { method: 'POST', headers: writeHeaders(), body: JSON.stringify({ prospectIds }) },
  );
}

export function applyGeographicAllocation(
  campaignId: string,
  prospectIds: string[],
): Promise<AllocationResult> {
  return browserJson<AllocationResult>(
    `/api/campaigns/${encodeURIComponent(campaignId)}/geographic-allocation/apply`,
    { method: 'POST', headers: writeHeaders(), body: JSON.stringify({ prospectIds }) },
  );
}

/**
 * Bulk campaign enrolment: the step between the shared référentiel and anything
 * a prospector can be sent to do.
 *
 * `preview` writes nothing and exists so the operator sees the counts before
 * committing them — the same shape as the geographic allocation above, and the
 * same reason. The API refuses a selection with no criteria rather than enrolling
 * the whole base, so callers should check `hasEnrolmentSelection` before offering
 * the action; the refusal is still the API's to make.
 */
export function previewCampaignEnrolment(
  campaignId: string,
  selection: CampaignEnrolmentSelection,
  signal?: AbortSignal,
): Promise<CampaignEnrolmentResult> {
  return browserJson<CampaignEnrolmentResult>(
    `/api/campaigns/${encodeURIComponent(campaignId)}/prospects/bulk/preview`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(selection),
      cache: 'no-store',
      signal,
    },
  );
}

export function applyCampaignEnrolment(
  campaignId: string,
  selection: CampaignEnrolmentSelection,
): Promise<CampaignEnrolmentResult> {
  /*
   * writeHeaders mints the idempotency key. Enrolment is one bulk request whose
   * retry must not enrol twice; upstream de-duplicates on the key as well as on
   * the membership uniqueness constraint.
   */
  return browserJson<CampaignEnrolmentResult>(
    `/api/campaigns/${encodeURIComponent(campaignId)}/prospects/bulk`,
    {
      method: 'POST',
      headers: writeHeaders(),
      body: JSON.stringify(selection),
    },
  );
}
