/**
 * Standalone reservation lifecycle (`/reservations/*`).
 *
 * Distinct from the work-queue-nested reservation endpoints, which only claim
 * and release. These are the ones that keep a held reservation alive.
 */
export type ReservationStatus = 'active' | 'released' | 'expired';

export interface Reservation {
  id: string;
  tenantId: string;
  campaignId: string;
  campaignProspectId: string;
  membershipId?: string;
  status: ReservationStatus;
  acquiredAt: string;
  expiresAt: string;
  releasedAt?: string | null;
}

export interface ReservationPage {
  items: Reservation[];
  nextCursor: string | null;
}

/**
 * How long before expiry a held reservation should be refreshed.
 *
 * The server owns the TTL and never publishes it, so the cadence is derived
 * from each response's own `expiresAt`: refresh at a third of the remaining
 * window, clamped so a long TTL does not go unrefreshed for too long and a
 * short one does not busy-loop.
 */
const MIN_HEARTBEAT_MS = 20_000;

const MAX_HEARTBEAT_MS = 120_000;

export function heartbeatDelayMs(expiresAt: string, now: number = Date.now()): number {
  const expiry = new Date(expiresAt).getTime();

  if (Number.isNaN(expiry)) {
    return MAX_HEARTBEAT_MS;
  }

  const remaining = expiry - now;

  if (remaining <= 0) {
    return 0;
  }

  return Math.min(Math.max(Math.floor(remaining / 3), MIN_HEARTBEAT_MS), MAX_HEARTBEAT_MS);
}

export function isExpired(expiresAt: string, now: number = Date.now()): boolean {
  const expiry = new Date(expiresAt).getTime();

  return Number.isNaN(expiry) ? false : expiry <= now;
}

export function minutesRemaining(expiresAt: string, now: number = Date.now()): number {
  const expiry = new Date(expiresAt).getTime();

  if (Number.isNaN(expiry)) {
    return 0;
  }

  return Math.max(0, Math.ceil((expiry - now) / 60_000));
}
