/**
 * Contracts shared by the API boundary and web clients.
 * Keep this package dependency-free so it can be imported by either app.
 */
export type ActionType = 'call' | 'email' | 'message' | 'visit' | 'task' | 'note';

export type ActionLifecycleStage =
  'to_contact' | 'contact_made' | 'in_progress' | 'follow_up' | 'qualified' | 'converted';

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

export type ActionLifecycleStatus = 'planned' | 'started' | 'completed' | 'cancelled';

export interface CompleteActionInput {
  outcomeCode: OutcomeCode;
  notes?: string;
  lifecycleStage?: ActionLifecycleStage;
  nextFollowUp?: {
    dueAt: string;
    channel?: 'call' | 'email' | 'message' | 'visit' | 'letter';
  };
  reservationDisposition: 'keep' | 'release';
}
