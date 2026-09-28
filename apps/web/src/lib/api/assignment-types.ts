import type { EstablishmentCategory } from './import-types';

/** GET /assignments/unassigned — campaignId is required upstream. */
export interface UnassignedProspect {
  campaignProspectId: string;
  campaignId: string;
  establishmentId: string;
  name: string;
  category: EstablishmentCategory | null;
  city: string | null;
  postalCode: string | null;
  /* Read from the postal code upstream; null when there is no usable one. */
  department: string | null;
  regionId: string | null;
  latitude: number | null;
  longitude: number | null;
  lifecycleStage: ProspectLifecycleStage;
  /* An opposition covers this prospect: the reservation would be refused. */
  contactBlocked: boolean;
  /* Another campaign is actively working the same establishment. */
  activeElsewhere: boolean;
}

export type ProspectLifecycleStage =
  'to_contact' | 'contact_made' | 'in_progress' | 'follow_up' | 'qualified' | 'converted';

/*
 * Every filter is applied by the API, not here. The base is over 14,000
 * establishments and a page is at most 100, so narrowing a loaded page in the
 * browser searches the page and reports nothing for everything else.
 */
export interface UnassignedFilters {
  campaignId: string;
  teamId?: string;
  search?: string;
  category?: EstablishmentCategory;
  department?: string;
  city?: string;
  regionId?: string;
  lifecycleStage?: ProspectLifecycleStage;
  contactable?: boolean;
  availability?: 'unassigned' | 'uncontested';
  cursor?: string;
  limit?: number;
}

/*
 * The group's own names for the taxonomy, taken from the workbook the base is
 * maintained in, so a manager reads the same words here and there.
 */
export const CATEGORY_LABELS: Record<EstablishmentCategory, string> = {
  prospection: 'Prospection',
  justice_enquetes: 'Justice et enquêtes',
  sante: 'Santé',
  asile_social: 'Asile et social',
  douanes_onaf: 'Douanes et ONAF',
  cra: 'CRA',
  prescripteurs: 'Prescripteurs',
};

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
