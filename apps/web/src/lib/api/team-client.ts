import { browserJson } from './browser-json';
import { browserResource, type BrowserResource } from './browser-resource';
import type {
  RosterPage,
  RosterState,
  Team,
  TeamCapacity,
  TeamPage,
  TeamRole,
  TeamStatus,
} from './team-types';

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

export function listTeams(
  query: {
    organizationId?: string;
    status?: TeamStatus;
    cursor?: string;
    limit?: number;
  } = {},
  signal?: AbortSignal,
): Promise<TeamPage> {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }

  const search = params.toString();

  return browserJson<TeamPage>(search ? `/api/teams?${search}` : '/api/teams', {
    cache: 'no-store',
    signal,
  });
}

export function getTeam(teamId: string, signal?: AbortSignal): Promise<BrowserResource<Team>> {
  return browserResource<Team>(`/api/teams/${encodeURIComponent(teamId)}`, {
    cache: 'no-store',
    signal,
  });
}

export function getTeamCapacity(teamId: string, signal?: AbortSignal): Promise<TeamCapacity> {
  return browserJson<TeamCapacity>(`/api/teams/${encodeURIComponent(teamId)}/capacity`, {
    cache: 'no-store',
    signal,
  });
}

export function updateTeam(
  teamId: string,
  input: { name?: string; status?: 'active' | 'inactive' },
  etag: string | null,
): Promise<Team> {
  return browserJson<Team>(`/api/teams/${encodeURIComponent(teamId)}`, {
    method: 'PATCH',
    headers: writeHeaders(etag),
    body: JSON.stringify(input),
  });
}

export function listRoster(
  teamId: string,
  query: { state?: RosterState | 'all'; cursor?: string; limit?: number } = {},
  signal?: AbortSignal,
): Promise<RosterPage> {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }

  const search = params.toString();
  const path = `/api/teams/${encodeURIComponent(teamId)}/members`;

  return browserJson<RosterPage>(search ? `${path}?${search}` : path, {
    cache: 'no-store',
    signal,
  });
}

export function addRosterMember(
  teamId: string,
  input: { membershipId: string; teamRole?: TeamRole; startsAt?: string },
): Promise<unknown> {
  return browserJson<unknown>(`/api/teams/${encodeURIComponent(teamId)}/members`, {
    method: 'POST',
    headers: writeHeaders(),
    body: JSON.stringify(input),
  });
}

export function updateRosterMember(
  teamId: string,
  membershipId: string,
  input: { teamRole?: TeamRole; startsAt?: string; endsAt?: string | null },
  etag: string | null,
): Promise<unknown> {
  return browserJson<unknown>(
    `/api/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(membershipId)}`,
    { method: 'PATCH', headers: writeHeaders(etag), body: JSON.stringify(input) },
  );
}

/* DELETE ends the rostering; it does not remove the person from the tenant. */
export function endRosterMember(
  teamId: string,
  membershipId: string,
  etag: string | null,
): Promise<unknown> {
  return browserJson<unknown>(
    `/api/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(membershipId)}`,
    { method: 'DELETE', headers: writeHeaders(etag) },
  );
}
