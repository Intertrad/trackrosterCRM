export type ActionType = 'call' | 'email' | 'message' | 'visit' | 'task' | 'note';

export type ActionStatus =
  'planned' | 'due' | 'overdue' | 'in_progress' | 'completed' | 'cancelled';

export type ActionLifecycleStage =
  'to_contact' | 'contact_made' | 'in_progress' | 'follow_up' | 'qualified' | 'converted';

/** The server's outcome vocabulary. Anything else is rejected upstream. */
export const OUTCOME_CODES = [
  'no_answer',
  'contacted',
  'interested',
  'not_interested',
  'qualified',
  'converted',
  'do_not_contact',
  'completed',
] as const;

export type OutcomeCode = (typeof OUTCOME_CODES)[number];

export const OUTCOME_LABELS: Record<OutcomeCode, string> = {
  no_answer: 'No answer',
  contacted: 'Contacted',
  interested: 'Interested',
  not_interested: 'Not interested',
  qualified: 'Qualified',
  converted: 'Converted',
  do_not_contact: 'Do not contact',
  completed: 'Completed',
};

/*
 * Outcomes that normally lead to another touch. Used only to preselect the
 * follow-up toggle — the operator can always override it.
 */
export const OUTCOMES_SUGGESTING_FOLLOW_UP = new Set<OutcomeCode>([
  'no_answer',
  'contacted',
  'interested',
  'qualified',
]);

export interface ActionRecord {
  id: string;
  campaignId: string;
  campaignProspectId: string;
  type: ActionType;
  subject: string;
  status: ActionStatus;
  outcomeCode: OutcomeCode | null;
  dueAt: string | null;
  completedAt: string | null;
}

export interface CreateActionInput {
  campaignId: string;
  campaignProspectId: string;
  type: ActionType;
  subject: string;
  dueAt?: string;
}

/**
 * POST /actions/:actionId/complete
 *
 * One transaction: the outcome, the prospect's new lifecycle stage, the next
 * follow-up and the reservation disposition all commit together or not at all.
 */
export interface CompleteActionInput {
  outcomeCode: OutcomeCode;
  notes?: string;
  lifecycleStage?: ActionLifecycleStage;
  nextFollowUp?: {
    /** Must carry an explicit offset or Z; the API rejects a bare local time. */
    dueAt: string;
    channel?: 'call' | 'email' | 'message' | 'visit' | 'letter';
  };
  reservationDisposition: 'keep' | 'release';
}

export const MAX_ACTION_NOTES = 10_000;

/**
 * One entry in an action's immutable history.
 *
 * Corrections never rewrite the original record: the API appends a new event,
 * so the trail of what was first logged and what it was changed to both
 * survive.
 */
export interface ActionEvent {
  id: string;
  tenantId: string;
  actionId: string;
  eventType: string;
  actorMembershipId: string | null;
  payload: Record<string, unknown>;
  occurredAt: string;
}

export interface ActionEventPage {
  items: ActionEvent[];
  nextCursor?: string | null;
}

export interface ActionPage {
  items: ActionRecord[];
  nextCursor: string | null;
}

export interface ListActionsQuery {
  campaignId?: string;
  assigneeMembershipId?: string;
  status?: ActionLifecycleStatus;
  cursor?: string;
  limit?: number;
}

export const MAX_ACTION_REASON = 2000;

export const MIN_ACTION_REASON = 1;

/*
 * The API filters actions on its own lifecycle vocabulary, which is narrower
 * than the display vocabulary above and names the running state differently:
 * the API says `started` where the UI says `in_progress`. Keeping the two
 * apart stops a display value being sent as a filter, which the API rejects.
 */
export type ActionLifecycleStatus = 'planned' | 'started' | 'completed' | 'cancelled';

export function toLifecycleStatus(status: ActionStatus): ActionLifecycleStatus | null {
  switch (status) {
    case 'in_progress':
      return 'started';
    case 'planned':
    case 'completed':
    case 'cancelled':
      return status;
    default:
      /* `due` and `overdue` are derived from a date, not stored states. */
      return null;
  }
}

/** "outcome_corrected" -> "Outcome corrected". */
export function actionEventLabel(eventType: string): string {
  const words = eventType.replace(/[._]/g, ' ').trim();

  return words.charAt(0).toUpperCase() + words.slice(1);
}

/*
 * The API only accepts a cancellation while the action is still open, and
 * only accepts a correction once it has been completed. Offering either at
 * the wrong moment produces a guaranteed rejection.
 */
export function canCancelAction(status: ActionStatus): boolean {
  return status === 'planned' || status === 'in_progress';
}

export function canCorrectAction(status: ActionStatus): boolean {
  return status === 'completed';
}

/*
 * An action type is a superset of the contact channels: `task` and `note`
 * describe internal work with nobody on the other end, so they have no
 * channel icon and must not be passed to one.
 */
export type ActionChannel = 'call' | 'email' | 'message' | 'visit';

export function toActionChannel(type: ActionType): ActionChannel | null {
  return type === 'call' || type === 'email' || type === 'message' || type === 'visit'
    ? type
    : null;
}

const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  call: 'Call',
  email: 'Email',
  message: 'Message',
  visit: 'Visit',
  task: 'Task',
  note: 'Note',
};

export function actionTypeLabel(type: ActionType): string {
  return ACTION_TYPE_LABELS[type] ?? type;
}
