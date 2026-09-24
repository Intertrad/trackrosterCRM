export type AuditActorType = 'user' | 'system';

/**
 * GET /audit/events — one immutable record of a sensitive change.
 *
 * The stored row is deliberately narrow: an actor id, a verb, the resource it
 * touched and a bounded metadata object. There is no severity column, no
 * request id and no before/after snapshot, so anything the screen shows
 * beyond these fields has to be derived here rather than invented.
 */
export interface AuditEvent {
  id: string;
  tenantId: string;
  actorType: AuditActorType;
  actorUserId: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata: Record<string, unknown>;
  occurredAt: string;
}

export interface AuditEventPage {
  items: AuditEvent[];
  nextCursor: string | null;
}

export interface AuditOverview {
  tenantId: string;
  events: number;
  actors: number;
  latest: string | null;
}

/** The named streams the API exposes, each a pre-filtered view of the log. */
export type AuditStream =
  | 'events'
  | 'data-changes'
  | 'security-events'
  | 'assignments'
  | 'overrides'
  | 'collisions'
  | 'exports';

export interface ListAuditQuery {
  stream?: AuditStream;
  action?: string;
  resourceType?: string;
  cursor?: string;
  limit?: number;
}

export type AuditSeverity = 'info' | 'warning' | 'error';

/*
 * Severity is a presentation concern, derived from the action verb. It is
 * kept in one table so the audit list and the detail panel can never disagree,
 * and so the rule is reviewable rather than scattered through JSX.
 */
const ERROR_ACTIONS = new Set([
  'session.failed',
  'auth.failed',
  'auth.locked',
  'import.cancelled',
  'export.failed',
]);

const WARNING_PREFIXES = [
  'role.',
  'membership.',
  'access_grant.',
  'collision_override.',
  'account.',
  'session.revoked',
];

export function auditSeverity(action: string): AuditSeverity {
  if (ERROR_ACTIONS.has(action)) {
    return 'error';
  }

  if (WARNING_PREFIXES.some((prefix) => action.startsWith(prefix))) {
    return 'warning';
  }

  return 'info';
}

/** "collision_override.approved" -> "Collision override approved". */
export function auditActionLabel(action: string): string {
  const words = action.replace(/[._]/g, ' ').trim();

  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** "tenant_membership" -> "Tenant membership". */
export function auditResourceLabel(resourceType: string): string {
  const words = resourceType.replace(/_/g, ' ');

  return words.charAt(0).toUpperCase() + words.slice(1);
}
