import { browserJson } from './browser-json';
import type {
  Territory,
  TerritoryAssignment,
  TerritoryAssignmentPage,
  TerritoryFeatureCollection,
} from './territory-types';

export function listTerritories(signal?: AbortSignal): Promise<Territory[]> {
  return browserJson<Territory[]>('/api/territories', { cache: 'no-store', signal });
}

/** Authorised territory boundaries as GeoJSON, ready for MapLibre. */
export function getTerritoryMap(signal?: AbortSignal): Promise<TerritoryFeatureCollection> {
  return browserJson<TerritoryFeatureCollection>('/api/territories/map', {
    cache: 'no-store',
    signal,
  });
}

function participationHeaders(etag?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'idempotency-key': crypto.randomUUID(),
  };

  if (etag) {
    headers['if-match'] = etag;
  }

  return headers;
}

export function listTerritoryAssignments(
  options: {
    territoryId?: string;
    membershipId?: string;
    teamId?: string;
    state?: 'all' | 'active' | 'scheduled' | 'ended' | 'revoked';
    cursor?: string;
    limit?: number;
  } = {},
  signal?: AbortSignal,
): Promise<TerritoryAssignmentPage> {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }

  const search = params.toString();

  return browserJson<TerritoryAssignmentPage>(
    search ? `/api/territory-assignments?${search}` : '/api/territory-assignments',
    { cache: 'no-store', signal },
  );
}

export function createTerritoryAssignment(input: {
  territoryId: string;
  membershipId?: string;
  teamId?: string;
  priority?: number;
  startsAt?: string;
}): Promise<TerritoryAssignment> {
  return browserJson<TerritoryAssignment>('/api/territory-assignments', {
    method: 'POST',
    headers: participationHeaders(),
    body: JSON.stringify(input),
  });
}

export function updateTerritoryAssignment(
  assignmentId: string,
  input: { priority?: number; startsAt?: string; endsAt?: string | null },
  etag: string | null,
): Promise<TerritoryAssignment> {
  return browserJson<TerritoryAssignment>(
    `/api/territory-assignments/${encodeURIComponent(assignmentId)}`,
    { method: 'PATCH', headers: participationHeaders(etag), body: JSON.stringify(input) },
  );
}

export function endTerritoryAssignment(assignmentId: string, etag: string | null): Promise<void> {
  return browserJson<void>(`/api/territory-assignments/${encodeURIComponent(assignmentId)}`, {
    method: 'DELETE',
    headers: participationHeaders(etag),
  });
}
