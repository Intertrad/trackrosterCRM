import { browserJson } from './browser-json';
import type {
  ListOverrideRequestsQuery,
  OverrideDecision,
  OverrideRequestDetail,
  OverrideRequestPage,
} from './override-types';

export function listOverrideRequests(
  query: ListOverrideRequestsQuery = {},
  signal?: AbortSignal,
): Promise<OverrideRequestPage> {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }

  const search = params.toString();

  return browserJson<OverrideRequestPage>(
    search ? `/api/override-requests?${search}` : '/api/override-requests',
    { cache: 'no-store', signal },
  );
}

export function getOverrideRequest(
  requestId: string,
  signal?: AbortSignal,
): Promise<OverrideRequestDetail> {
  return browserJson<OverrideRequestDetail>(
    `/api/override-requests/${encodeURIComponent(requestId)}`,
    { cache: 'no-store', signal },
  );
}

export function decideOverrideRequest(
  requestId: string,
  decision: OverrideDecision,
  reason: string,
  etag: string | null,
): Promise<OverrideRequestDetail> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'idempotency-key': crypto.randomUUID(),
  };

  /*
   * The validator read with the request is echoed back, so a decision made
   * in another tab or by another manager is rejected rather than overwritten.
   */
  if (etag) {
    headers['if-match'] = etag;
  }

  return browserJson<OverrideRequestDetail>(
    `/api/override-requests/${encodeURIComponent(requestId)}/${decision}`,
    { method: 'POST', headers, body: JSON.stringify({ reason }) },
  );
}
