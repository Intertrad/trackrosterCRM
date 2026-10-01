import { browserJson } from './browser-json';
import type { Reservation, ReservationPage } from './reservation-types';

export function listReservations(
  query: { status?: string; cursor?: string; limit?: number } = {},
  signal?: AbortSignal,
): Promise<ReservationPage> {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }

  const search = params.toString();

  return browserJson<ReservationPage>(
    search ? `/api/reservations?${search}` : '/api/reservations',
    { cache: 'no-store', signal },
  );
}

export function getReservation(reservationId: string, signal?: AbortSignal): Promise<Reservation> {
  return browserJson<Reservation>(`/api/reservations/${encodeURIComponent(reservationId)}`, {
    cache: 'no-store',
    signal,
  });
}

/*
 * Every lifecycle write upstream is @Idempotent, and the Idempotency-Key
 * header is mandatory. A heartbeat must therefore mint a FRESH key on each
 * tick: replaying a key would return the previous cached response and the
 * reservation would quietly fail to extend — the exact failure this call
 * exists to prevent.
 */
export function heartbeatReservation(
  reservationId: string,
  signal?: AbortSignal,
): Promise<Reservation> {
  return browserJson<Reservation>(
    `/api/reservations/${encodeURIComponent(reservationId)}/heartbeat`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
      body: '{}',
      signal,
    },
  );
}

export function extendReservation(
  reservationId: string,
  idempotencyKey: string,
): Promise<Reservation> {
  return browserJson<Reservation>(`/api/reservations/${encodeURIComponent(reservationId)}/extend`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': idempotencyKey },
    body: '{}',
  });
}

export function releaseReservation(
  reservationId: string,
  idempotencyKey: string,
  reason = 'Released from live activity',
): Promise<Reservation> {
  return browserJson<Reservation>(
    `/api/reservations/${encodeURIComponent(reservationId)}/release`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': idempotencyKey },
      body: JSON.stringify({ reason }),
    },
  );
}
