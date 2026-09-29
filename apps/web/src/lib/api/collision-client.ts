import { browserJson } from './browser-json';
import type {
  CollisionCheckResult,
  CollisionEvent,
  CollisionEventPage,
  ListCollisionsQuery,
} from './collision-types';

export function listCollisionEvents(
  query: ListCollisionsQuery = {},
  signal?: AbortSignal,
): Promise<CollisionEventPage> {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }

  const search = params.toString();

  return browserJson<CollisionEventPage>(
    search ? `/api/collision-events?${search}` : '/api/collision-events',
    { cache: 'no-store', signal },
  );
}

export function getCollisionEvent(
  collisionId: string,
  signal?: AbortSignal,
): Promise<CollisionEvent> {
  return browserJson<CollisionEvent>(`/api/collision-events/${encodeURIComponent(collisionId)}`, {
    cache: 'no-store',
    signal,
  });
}

/* Raises an override request for a manager to decide on the approvals screen. */
export function requestCollisionOverride(
  collisionId: string,
  reason: string,
  idempotencyKey: string,
): Promise<unknown> {
  return browserJson<unknown>(
    `/api/collision-events/${encodeURIComponent(collisionId)}/override-request`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': idempotencyKey },
      body: JSON.stringify({ reason }),
    },
  );
}

/**
 * Runs the authoritative pre-contact check.
 *
 * This persists a collision event when the contact is refused, which is what
 * makes an override request possible. It is a POST for that reason — it is
 * not a read.
 */
export function checkCollision(
  campaignId: string,
  campaignProspectId: string,
  idempotencyKey: string,
): Promise<CollisionCheckResult> {
  return browserJson<CollisionCheckResult>('/api/reservations/check', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': idempotencyKey },
    body: JSON.stringify({ campaignId, campaignProspectId }),
  });
}
