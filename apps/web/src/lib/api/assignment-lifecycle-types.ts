export type AssignmentStatus = 'active' | 'paused' | 'completed' | 'revoked';

export type AssignmentPriority = 'low' | 'normal' | 'high' | 'critical';

/**
 * One prospect assigned to one team, and optionally one person.
 *
 * `assignedUserId` is nullable: an assignment can sit with a team before
 * anyone picks it up, so "unassigned" here means team-owned, not missing.
 */
export interface Assignment {
  id: string;
  tenantId: string;
  campaignId: string;
  campaignProspectId: string;
  organizationId: string;
  teamId: string;
  assignedUserId: string | null;
  assignedAt: string;
  endedAt: string | null;
  status: AssignmentStatus;
  priority: AssignmentPriority;
  endReason: string | null;
  updatedAt: string;
  etag: string;
}

export interface AssignmentPage {
  items: Assignment[];
  nextCursor: string | null;
}

export interface ListAssignmentsQuery {
  campaignId?: string;
  teamId?: string;
  assignedUserId?: string;
  status?: AssignmentStatus;
  cursor?: string;
  limit?: number;
}

/** The API requires 3–1000 characters on every lifecycle end. */
export const MIN_ASSIGNMENT_REASON = 3;

export const MAX_ASSIGNMENT_REASON = 1000;

export const ASSIGNMENT_PRIORITIES: readonly AssignmentPriority[] = [
  'low',
  'normal',
  'high',
  'critical',
];

export function priorityTone(
  priority: AssignmentPriority,
): 'danger' | 'warning' | 'neutral' | 'brand' {
  switch (priority) {
    case 'critical':
      return 'danger';
    case 'high':
      return 'warning';
    case 'low':
      return 'neutral';
    default:
      return 'brand';
  }
}

export function statusTone(status: AssignmentStatus): 'success' | 'warning' | 'neutral' | 'danger' {
  switch (status) {
    case 'active':
      return 'success';
    case 'paused':
      return 'warning';
    case 'revoked':
      return 'danger';
    default:
      return 'neutral';
  }
}

/**
 * Whether the assignment can still be acted on.
 *
 * The API refuses any mutation once `endedAt` is set, so the UI must not
 * offer actions that are certain to be rejected.
 */
export function isAssignmentOpen(assignment: Assignment): boolean {
  return assignment.endedAt === null;
}
