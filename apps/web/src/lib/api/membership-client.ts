import { browserJson } from './browser-json';
import { browserResource, type BrowserResource } from './browser-resource';
import type {
  InviteMembershipInput,
  ListMembershipsQuery,
  MembershipDetail,
  MembershipPage,
  MembershipSummary,
  UpdateMembershipInput,
} from './membership-types';

export function listMemberships(
  query: ListMembershipsQuery = {},
  signal?: AbortSignal,
): Promise<MembershipPage> {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }

  const search = params.toString();

  return browserJson<MembershipPage>(search ? `/api/memberships?${search}` : '/api/memberships', {
    cache: 'no-store',
    signal,
  });
}

export function getMembership(
  membershipId: string,
  signal?: AbortSignal,
): Promise<BrowserResource<MembershipDetail>> {
  return browserResource<MembershipDetail>(`/api/memberships/${encodeURIComponent(membershipId)}`, {
    cache: 'no-store',
    signal,
  });
}

export function inviteMembership(
  input: InviteMembershipInput,
  idempotencyKey: string,
): Promise<MembershipSummary> {
  return browserJson<MembershipSummary>('/api/memberships', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': idempotencyKey },
    body: JSON.stringify(input),
  });
}

export function resendInvitation(membershipId: string, idempotencyKey: string): Promise<unknown> {
  return browserJson<unknown>(
    `/api/memberships/${encodeURIComponent(membershipId)}/resend-invite`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': idempotencyKey },
      body: '{}',
    },
  );
}

export function updateMembership(
  membershipId: string,
  input: UpdateMembershipInput,
  options: { etag: string | null; idempotencyKey: string },
): Promise<MembershipDetail> {
  return browserJson<MembershipDetail>(`/api/memberships/${encodeURIComponent(membershipId)}`, {
    method: 'PATCH',
    headers: writeHeaders(options),
    body: JSON.stringify(input),
  });
}

/*
 * Suspend and reactivate are distinct endpoints rather than a status PATCH:
 * the API requires a reason on each and records it in the audit log.
 */
export function setMembershipStatus(
  membershipId: string,
  action: 'suspend' | 'reactivate',
  reason: string,
  options: { etag: string | null; idempotencyKey: string },
): Promise<MembershipDetail> {
  return browserJson<MembershipDetail>(
    `/api/memberships/${encodeURIComponent(membershipId)}/${action}`,
    {
      method: 'POST',
      headers: writeHeaders(options),
      body: JSON.stringify({ reason }),
    },
  );
}

function writeHeaders(options: {
  etag: string | null;
  idempotencyKey: string;
}): Record<string, string> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'idempotency-key': options.idempotencyKey,
  };

  if (options.etag) {
    headers['if-match'] = options.etag;
  }

  return headers;
}
