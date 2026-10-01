export type OverrideRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export type CollisionReasonCode =
  'NO_COLLISION' | 'ACTIVE_RESERVATION' | 'ACTIVE_ASSIGNMENT' | 'PLANNED_ACTION' | 'RECENT_CONTACT';

/** GET /override-requests — one row per request, each carrying its validator. */
export interface OverrideRequestSummary {
  id: string;
  collisionId: string;
  campaignProspectId: string;
  requestedBy: string;
  reason: string;
  status: OverrideRequestStatus;
  decidedBy: string | null;
  decisionReason: string | null;
  decidedAt: string | null;
  overrideId: string | null;
  createdAt: string;
  updatedAt: string;

  /*
   * Server-computed validator. It must be echoed back as If-Match on a
   * decision so a request decided in another tab is rejected with 412
   * instead of being overwritten.
   */
  etag: string;
}

export interface OverrideRequestPage {
  items: OverrideRequestSummary[];
  nextCursor: string | null;
}

/** The collision the request is contesting, as the server evaluated it. */
export interface OverrideCollision {
  id: string;
  campaignId: string;
  campaignProspectId: string;
  assignmentId: string | null;
  detectedBy: string;
  establishmentId?: string;
  createdAt: string;
  expiresAt: string | null;
  decision?: string;
  reasonCode?: CollisionReasonCode;
  conflict?: Record<string, unknown> | null;
  policy: {
    evaluatorVersion?: string;
    defaultCoolingOffMinutes?: number;
  };
  overrideable: boolean;
}

export interface OverrideRequestDetail extends OverrideRequestSummary {
  collision: OverrideCollision;
  approval: { id: string; expiresAt: string | null } | null;
  /** Human-readable context resolved inside the same authorization scope. */
  context?: {
    prospect: { id: string; name: string } | null;
    campaign: { id: string; name: string } | null;
    requester: { id: string; displayName: string | null } | null;
    detector: { id: string; displayName: string | null } | null;
    decider: { id: string; displayName: string | null } | null;
  };
}

export type OverrideDecision = 'approve' | 'reject' | 'cancel';

export interface ListOverrideRequestsQuery {
  status?: OverrideRequestStatus;
  campaignId?: string;
  reasonCode?: Exclude<CollisionReasonCode, 'NO_COLLISION'>;
  cursor?: string;
  limit?: number;
}

/** Mandatory upstream: 10-1000 characters, recorded in the audit trail. */
export const MIN_OVERRIDE_REASON = 10;
export const MAX_OVERRIDE_REASON = 1000;
