import { browserJson } from './browser-json';
import type {
  CreateRouteInput,
  FieldRoute,
  ListRoutesQuery,
  RoutePage,
  RouteStopStatus,
} from './route-types';

const JSON_HEADERS = { 'content-type': 'application/json' } as const;

function writeHeaders(): Record<string, string> {
  return { ...JSON_HEADERS, 'idempotency-key': crypto.randomUUID() };
}

export function listRoutes(query: ListRoutesQuery = {}, signal?: AbortSignal): Promise<RoutePage> {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }

  const search = params.toString();

  return browserJson<RoutePage>(search ? `/api/routes?${search}` : '/api/routes', {
    cache: 'no-store',
    signal,
  });
}

export function getRoute(routeId: string, signal?: AbortSignal): Promise<FieldRoute> {
  return browserJson<FieldRoute>(`/api/routes/${encodeURIComponent(routeId)}`, {
    cache: 'no-store',
    signal,
  });
}

export function createRoute(input: CreateRouteInput): Promise<FieldRoute> {
  return browserJson<FieldRoute>('/api/routes', {
    method: 'POST',
    headers: writeHeaders(),
    body: JSON.stringify(input),
  });
}

export function addRouteStop(routeId: string, campaignProspectId: string): Promise<FieldRoute> {
  return browserJson<FieldRoute>(`/api/routes/${encodeURIComponent(routeId)}/stops`, {
    method: 'POST',
    headers: writeHeaders(),
    body: JSON.stringify({ campaignProspectId }),
  });
}

export function removeRouteStop(stopId: string): Promise<unknown> {
  return browserJson<unknown>(`/api/route-stops/${encodeURIComponent(stopId)}`, {
    method: 'DELETE',
    headers: writeHeaders(),
  });
}

/** Persists an explicit order; the server recomputes distance and ETAs. */
export function reorderRouteStops(routeId: string, stopIds: string[]): Promise<FieldRoute> {
  return browserJson<FieldRoute>(`/api/routes/${encodeURIComponent(routeId)}/stop-order`, {
    method: 'PUT',
    headers: writeHeaders(),
    body: JSON.stringify({ stopIds }),
  });
}

/** Server-side optimisation; the returned order replaces the local one. */
export function optimizeRoute(routeId: string): Promise<FieldRoute> {
  return browserJson<FieldRoute>(`/api/routes/${encodeURIComponent(routeId)}/optimize`, {
    method: 'POST',
    headers: writeHeaders(),
    body: '{}',
  });
}

export function startRoute(routeId: string): Promise<FieldRoute> {
  return browserJson<FieldRoute>(`/api/routes/${encodeURIComponent(routeId)}/start`, {
    method: 'POST',
    headers: writeHeaders(),
    body: '{}',
  });
}

export function completeRoute(routeId: string): Promise<FieldRoute> {
  return browserJson<FieldRoute>(`/api/routes/${encodeURIComponent(routeId)}/complete`, {
    method: 'POST',
    headers: writeHeaders(),
    body: '{}',
  });
}

export function updateRoute(
  routeId: string,
  input: { name?: string; scheduledAt?: string },
): Promise<FieldRoute> {
  return browserJson<FieldRoute>(`/api/routes/${encodeURIComponent(routeId)}`, {
    method: 'PATCH',
    headers: writeHeaders(),
    body: JSON.stringify(input),
  });
}

/* DELETE /routes/:id is a cancel upstream, not a hard delete. */
export function cancelRoute(routeId: string): Promise<unknown> {
  return browserJson<unknown>(`/api/routes/${encodeURIComponent(routeId)}`, {
    method: 'DELETE',
    headers: writeHeaders(),
  });
}

/**
 * Marks progress at one stop.
 *
 * `status` is the field-visit outcome the API accepts — `arrived`,
 * `completed` or `skipped`. It is not the prospect's lifecycle stage; logging
 * an outcome against the prospect remains a separate call.
 */
export function updateRouteStop(
  stopId: string,
  input: { status?: RouteStopStatus; position?: number; eta?: string | null },
): Promise<FieldRoute> {
  return browserJson<FieldRoute>(`/api/route-stops/${encodeURIComponent(stopId)}`, {
    method: 'PATCH',
    headers: writeHeaders(),
    body: JSON.stringify(input),
  });
}
