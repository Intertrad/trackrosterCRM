export type ProspectFollowUpStatus = 'pending' | 'completed' | 'cancelled';

export type ProspectFollowUpOwnership = 'user' | 'team';

/*
 * Browser-safe representation of a follow-up.
 *
 * Internal backend metadata such as:
 *
 * - tenantId
 * - assignmentId
 * - createdBy
 * - assignedUserId
 *
 * is intentionally not exposed to the UI.
 */
/**
 * The three kinds of next action the domain defines.
 *
 * `meeting` is an appointment, and it is a category rather than a status — an
 * appointment can be overdue, due today or upcoming like anything else.
 */
export type ProspectFollowUpCategory = 'todo' | 'follow_up' | 'meeting';

export type ProspectFollowUpChannel = 'call' | 'email' | 'message' | 'visit' | 'letter';

export interface ProspectFollowUp {
  id: string;

  campaignId: string;

  prospectId: string;

  establishmentId: string;

  dueAt: string;

  status: ProspectFollowUpStatus;

  /* Both are returned by the API and were missing from this type. */
  category: ProspectFollowUpCategory;

  channel: ProspectFollowUpChannel | null;

  ownership: ProspectFollowUpOwnership;

  completedAt: string | null;

  cancelledAt: string | null;

  createdAt: string;

  updatedAt: string;
}

export interface ProspectFollowUpListResponse {
  items: ProspectFollowUp[];
}

/*
 * Operational follow-up queue item.
 *
 * Display names are resolved by the backend query
 * so the browser does not perform N+1 lookups.
 */
export interface FollowUpQueueItem extends ProspectFollowUp {
  campaignName: string;

  establishmentName: string;
}

export interface FollowUpQueueResponse {
  items: FollowUpQueueItem[];
}

export interface ListFollowUpQueueOptions {
  /*
   * Selected Prospector workspace.
   *
   * This is browser-provided context, not trusted
   * authorization state. Nest validates that the
   * authenticated caller has access to the team.
   */
  teamId: string;

  includeCompleted?: boolean;

  overdue?: boolean;

  limit?: number;

  /** Cancels a request superseded by a tab change. */
  signal?: AbortSignal;
}

export interface ListProspectFollowUpsInput {
  campaignId: string;

  prospectId: string;

  teamId: string;
}

export interface CreateProspectFollowUpInput {
  campaignId: string;

  prospectId: string;

  teamId: string;

  dueAt: string;

  /*
   * undefined / user:
   *   assign the follow-up to the authenticated caller.
   *
   * team:
   *   create a team-owned follow-up.
   *
   * Arbitrary user IDs are deliberately absent from
   * the browser contract.
   */
  ownership?: ProspectFollowUpOwnership;

  idempotencyKey: string;
}

export interface RescheduleProspectFollowUpInput {
  campaignId: string;

  prospectId: string;

  followUpId: string;

  teamId: string;

  dueAt: string;

  idempotencyKey: string;
}

export interface CompleteProspectFollowUpInput {
  campaignId: string;

  prospectId: string;

  followUpId: string;

  teamId: string;

  idempotencyKey: string;
}

export interface CancelProspectFollowUpInput {
  campaignId: string;

  prospectId: string;

  followUpId: string;

  teamId: string;

  idempotencyKey: string;
}
