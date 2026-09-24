/** GET /assignments/unassigned — campaignId is required upstream. */
export interface UnassignedProspect {
  campaignProspectId: string;
  campaignId: string;
  establishmentId: string;
  name: string;
}

export interface UnassignedProspectPage {
  items: UnassignedProspect[];
  nextCursor: string | null;
}

export type AssignmentOutcome =
  'proposed' | 'already_assigned' | 'inactive_prospect' | 'missing_coordinates';

export interface AssignmentDecision {
  prospectId: string;
  outcome: AssignmentOutcome;
  teamId?: string;
  assignedUserId?: string | null;
  conflict?: {
    teamId?: string;
    assignedUserId?: string | null;
  } | null;
}

/**
 * POST /assignments/preview and /assignments/bulk share one response.
 *
 * `preview` is a dry run: `proposed` counts what would be assigned and
 * `canApply` is false while any conflict remains, which is what gates the
 * apply button rather than a client-side guess.
 */
export interface AssignmentBatchResult {
  campaignId: string;
  ruleId: string | null;
  mode: 'preview' | 'apply';
  canApply: boolean;
  assigned: number;
  proposed: number;
  conflicts: number;
  decisions: AssignmentDecision[];
}

export interface AssignmentBatchInput {
  campaignId: string;
  prospectIds: string[];
  teamId?: string;
  assignedUserId?: string | null;
  ruleId?: string;
}

/** Upstream caps a batch at 100 prospects. */
export const MAX_BATCH_SIZE = 100;

export const OUTCOME_LABELS: Record<AssignmentOutcome, string> = {
  proposed: 'Will be assigned',
  already_assigned: 'Already assigned to another member',
  inactive_prospect: 'Prospect is not active',
  missing_coordinates: 'Establishment has no coordinates',
};
