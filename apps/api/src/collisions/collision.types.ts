import type { ProspectActivityType } from '../database/schema/prospect-activities.js';

export type CollisionDecision = 'allow' | 'block' | 'warn' | 'require_override';

export type CollisionReasonCode = 'NO_COLLISION' | 'ACTIVE_RESERVATION' | 'RECENT_CONTACT';

export interface ActiveReservationCollisionConflict {
  reservationId: string;

  campaignId: string;
  campaignProspectId: string;

  assignmentId: string;
  teamId: string;
  userId: string;

  acquiredAt: string;
  expiresAt: string;
}

export interface RecentContactCollisionConflict {
  activityId: string;

  activityType: ProspectActivityType;

  occurredAt: string;

  expiresAt: string;
}

export type CollisionConflict = ActiveReservationCollisionConflict | RecentContactCollisionConflict;

export interface CollisionDecisionResult {
  decision: CollisionDecision;

  reasonCode: CollisionReasonCode;

  establishmentId: string;

  conflict: CollisionConflict | null;
}
