export type CollisionDecision = 'allow' | 'block' | 'warn' | 'require_override';

export type CollisionReasonCode = 'NO_COLLISION' | 'ACTIVE_RESERVATION';

export interface CollisionConflict {
  reservationId: string;

  campaignId: string;
  campaignProspectId: string;

  assignmentId: string;
  teamId: string;
  userId: string;

  acquiredAt: string;
  expiresAt: string;
}

export interface CollisionDecisionResult {
  decision: CollisionDecision;

  reasonCode: CollisionReasonCode;

  establishmentId: string;

  conflict: CollisionConflict | null;
}
