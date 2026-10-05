import { browserJson } from './browser-json';
import { browserResource, type BrowserResource } from './browser-resource';
import { getTeamCapacity, listTeams } from './team-client';
import type {
  InviteMembershipInput,
  ListMembershipsQuery,
  MembershipDetail,
  MembershipPage,
  MembershipSummary,
  UpdateMembershipInput,
} from './membership-types';

/** Names and capacity for prospectors in teams the server authorizes for management.
 * This deliberately does not request the tenant-wide admin membership directory.
 */
export async function listScopedMemberships(
  query: Omit<ListMembershipsQuery, 'territoryId' | 'campaignId'> = {},
  signal?: AbortSignal,
): Promise<MembershipPage> {
  const teamIds: string[] = [];
  if (query.teamId) teamIds.push(query.teamId);
  else {
    let cursor: string | undefined;
    do {
      const page = await listTeams(
        { organizationId: query.organizationId, cursor, limit: 100 },
        signal,
      );
      teamIds.push(...page.items.map((team) => team.id));
      cursor = page.nextCursor ?? undefined;
    } while (cursor && !signal?.aborted);
  }
  const people = new Map<string, MembershipSummary>();
  for (let offset = 0; offset < teamIds.length; offset += 5) {
    const capacities = await Promise.all(
      teamIds.slice(offset, offset + 5).map((id) => getTeamCapacity(id, signal)),
    );
    for (const capacity of capacities) {
      if (capacity.members.truncated)
        throw new Error('Narrow the team filter to load the complete roster.');
      for (const member of capacity.members.items) {
        // The capacity endpoint includes roster members that are no longer
        // assignable (suspended membership, disabled identity, or a revoked
        // prospector grant). Keep those records out of assignment pickers so
        // the preview does not immediately fail with `ineligible_target`.
        if (!member.identityId || !member.eligible) continue;
        people.set(member.membershipId, {
          id: member.membershipId,
          identityId: member.identityId,
          displayName: member.displayName,
          email: member.email ?? '',
          status: member.status as MembershipSummary['status'],
          capacity: member.capacity,
          roles: ['prospector'],
        });
      }
    }
  }
  const search = query.search?.toLowerCase();
  const items = [...people.values()]
    .filter(
      (person) =>
        (!query.cursor || person.id > query.cursor) &&
        (!query.status || person.status === query.status) &&
        (!query.role || query.role === 'prospector') &&
        (!search || `${person.displayName ?? ''} ${person.email}`.toLowerCase().includes(search)),
    )
    .sort((a, b) => a.id.localeCompare(b.id));
  const limit = query.limit ?? 100;
  return {
    items: items.slice(0, limit),
    nextCursor: items.length > limit ? items[limit - 1]!.id : null,
  };
}

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
