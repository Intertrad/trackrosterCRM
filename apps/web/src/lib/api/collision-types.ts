export type CollisionDecision = 'allow' | 'block' | 'warn' | 'require_override';

export type CollisionReasonCode =
  'NO_COLLISION' | 'ACTIVE_RESERVATION' | 'ACTIVE_ASSIGNMENT' | 'PLANNED_ACTION' | 'RECENT_CONTACT';

/**
 * GET /collision-events
 *
 * One recorded decision by the anti-collision engine. The engine's full
 * evaluation is deliberately not published verbatim — the API returns a
 * redacted decision so a prospector cannot infer another team's portfolio
 * from the conflict detail.
 */
export interface CollisionEvent {
  id: string;
  tenantId: string;
  campaignId: string;
  campaignProspectId: string;
  assignmentId: string | null;
  detectedBy: string;
  createdAt: string;
  expiresAt: string;
  decision: CollisionDecision;
  reasonCode: CollisionReasonCode;
  policy: {
    evaluatorVersion?: string | number;
    defaultCoolingOffMinutes?: number;
  };

  /** False when policy forbids a manager override for this conflict. */
  overrideable: boolean;

  [key: string]: unknown;
}

export interface CollisionEventPage {
  items: CollisionEvent[];
  nextCursor: string | null;
}

export interface ListCollisionsQuery {
  campaignId?: string;
  reasonCode?: CollisionReasonCode;
  cursor?: string;
  limit?: number;
}

const REASON_LABELS: Record<string, string> = {
  NO_COLLISION: 'No collision',
  ACTIVE_RESERVATION: 'Active reservation',
  ACTIVE_ASSIGNMENT: 'Active assignment',
  PLANNED_ACTION: 'Planned action',
  RECENT_CONTACT: 'Recent contact',
};

export function reasonLabel(code: string): string {
  return REASON_LABELS[code] ?? code.replace(/_/g, ' ').toLowerCase();
}

const DECISION_LABELS: Record<CollisionDecision, string> = {
  allow: 'Allowed',
  block: 'Blocked',
  warn: 'Warned',
  require_override: 'Override required',
};

export function decisionLabel(decision: CollisionDecision): string {
  return DECISION_LABELS[decision] ?? decision;
}

export function decisionTone(
  decision: CollisionDecision,
): 'success' | 'danger' | 'warning' | 'brand' {
  switch (decision) {
    case 'allow':
      return 'success';
    case 'block':
      return 'danger';
    case 'warn':
      return 'warning';
    default:
      return 'brand';
  }
}

/** A collision event stops being actionable once its window closes. */
export function isCollisionExpired(event: CollisionEvent, now: number = Date.now()): boolean {
  const expiry = new Date(event.expiresAt).getTime();

  return Number.isNaN(expiry) ? false : expiry <= now;
}

/** Whether a manager can still raise an override request for this event. */
export function canRequestOverride(event: CollisionEvent, now: number = Date.now()): boolean {
  return event.overrideable && !isCollisionExpired(event, now);
}

/**
 * POST /reservations/check
 *
 * The authoritative pre-contact check, and the only call that yields a
 * `collisionId`. The read-only `collision-decision` endpoint returns the same
 * verdict without persisting an event, so a prospector blocked there has no
 * handle to request an override against — this is the call that opens that
 * door.
 *
 * `collisionId` is null when the decision is `allow`: nothing was blocked, so
 * no event exists and there is nothing to override.
 */
export interface CollisionCheckResult {
  decision: CollisionDecision;
  reasonCode: CollisionReasonCode;
  establishmentId?: string;
  conflict?: { expiresAt?: string; dueAt?: string; assignedAt?: string } | null;
  collisionId: string | null;
  overrideable: boolean;
  expiresAt?: string;
  policy?: { evaluatorVersion?: string | number; defaultCoolingOffMinutes?: number };
}

/** The API requires 10–1000 characters on an override request. */
export const MIN_OVERRIDE_REASON = 10;

export const MAX_OVERRIDE_REASON = 1000;

/**
 * Whether the prospector can raise an override request right now.
 *
 * All three must hold: the engine blocked the contact, it recorded an event
 * to hang the request on, and policy permits an override for this conflict.
 */
export function canRaiseOverride(
  check: CollisionCheckResult | null,
  now: number = Date.now(),
): check is CollisionCheckResult & { collisionId: string } {
  if (!check || check.collisionId === null || !check.overrideable) {
    return false;
  }

  if (check.decision !== 'block' && check.decision !== 'require_override') {
    return false;
  }

  /* A collision event is only actionable inside its window. */
  if (check.expiresAt) {
    const expiry = new Date(check.expiresAt).getTime();

    if (!Number.isNaN(expiry) && expiry <= now) {
      return false;
    }
  }

  return true;
}
