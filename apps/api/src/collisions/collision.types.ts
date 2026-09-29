import type { ProspectActivityType } from '../database/schema/prospect-activities.js';

export type CollisionDecision = 'allow' | 'block' | 'warn' | 'require_override';

export type CollisionReasonCode =
  'NO_COLLISION' | 'ACTIVE_ASSIGNMENT' | 'ACTIVE_RESERVATION' | 'PLANNED_ACTION' | 'RECENT_CONTACT';

export interface ActiveAssignmentCollisionConflict {
  assignmentId: string;

  campaignId: string;

  campaignProspectId: string;

  organizationId: string;

  teamId: string;

  assignedUserId: string | null;

  assignedAt: string;
}

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

export interface PlannedActionCollisionConflict {
  followUpId: string;

  campaignId: string;

  campaignProspectId: string;

  assignmentId: string;

  assignedUserId: string | null;

  dueAt: string;
}

export interface ScheduledActionCollisionConflict {
  actionId: string;
  campaignId: string;
  campaignProspectId: string;
  assignmentId: string;
  assignedUserId: string;
  dueAt: string | null;
  updatedAt: string;
}

export interface RecentContactCollisionConflict {
  activityId: string;

  activityType: ProspectActivityType;

  occurredAt: string;

  expiresAt: string;
}

export type CollisionConflict =
  | ActiveAssignmentCollisionConflict
  | ActiveReservationCollisionConflict
  | PlannedActionCollisionConflict
  | ScheduledActionCollisionConflict
  | RecentContactCollisionConflict;

export interface CollisionDecisionResult {
  decision: CollisionDecision;

  reasonCode: CollisionReasonCode;

  establishmentId: string;

  conflict: CollisionConflict | null;
}
