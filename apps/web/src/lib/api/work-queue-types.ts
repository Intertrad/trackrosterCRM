export type WorkQueueEstablishmentStatus = 'active' | 'inactive' | 'archived';

export type ProspectTimelineActivityType = 'call' | 'email' | 'message' | 'visit';

export interface WorkQueueItem {
  campaignProspectId: string;

  campaign: {
    id: string;
    name: string;
  };

  assignment: {
    id: string;
    organizationId: string;
    teamId: string;

    /*
     * Nest serializes backend Date values as ISO strings.
     */
    assignedAt: string;
  };

  establishment: {
    id: string;
    regionId: string | null;

    name: string;

    addressLine1: string | null;
    postalCode: string | null;
    city: string | null;
    countryCode: string;

    phone: string | null;
    website: string | null;

    status: WorkQueueEstablishmentStatus;
  };
}

/*
 * Prospect Detail intentionally has its own explicit
 * browser contract instead of aliasing WorkQueueItem.
 *
 * This keeps list and detail APIs independently
 * evolvable.
 */
export interface WorkQueueProspectDetail {
  campaignProspectId: string;

  campaign: {
    id: string;
    name: string;
  };

  assignment: {
    id: string;
    organizationId: string;
    teamId: string;

    assignedAt: string;
  };

  establishment: {
    id: string;
    regionId: string | null;

    name: string;

    addressLine1: string | null;
    postalCode: string | null;
    city: string | null;
    countryCode: string;

    phone: string | null;
    website: string | null;

    status: WorkQueueEstablishmentStatus;
  };
}

export interface WorkQueuePage {
  limit: number;
  hasMore: boolean;
  nextCursor: string | null;
}

export interface WorkQueueResponse {
  items: WorkQueueItem[];

  page: WorkQueuePage;
}

export interface ProspectTimelineActivityItem {
  kind: 'activity';

  id: string;

  occurredAt: string;

  activityType: ProspectTimelineActivityType;

  actor: {
    userId: string;
  };

  context: {
    campaignId: string;
    campaignProspectId: string;
    establishmentId: string;
    assignmentId: string;
  };
}

export interface ProspectTimelinePage {
  items: ProspectTimelineActivityItem[];

  nextCursor: string | null;
}

export type ProspectReservationState =
  | {
      state: 'none';
    }
  | {
      state: 'owned';

      reservationId: string;

      acquiredAt: string;
      expiresAt: string;
    }
  | {
      state: 'reserved';

      expiresAt: string;
    };

export interface AcquiredProspectReservation {
  reservationId: string;

  acquiredAt: string;
  expiresAt: string;
}

export interface ReleasedProspectReservation {
  released: true;

  reservationId: string;
}

export type ProspectCollisionDecisionValue = 'allow' | 'block' | 'warn' | 'require_override';

export type ProspectCollisionReasonCode =
  'NO_COLLISION' | 'ACTIVE_ASSIGNMENT' | 'ACTIVE_RESERVATION' | 'PLANNED_ACTION' | 'RECENT_CONTACT';

export type ProspectCollisionConflict =
  | {
      expiresAt: string;
    }
  | {
      dueAt: string;
    }
  | {
      assignedAt: string;
    }
  | null;

export interface ProspectCollisionDecision {
  decision: ProspectCollisionDecisionValue;

  reasonCode: ProspectCollisionReasonCode;

  conflict: ProspectCollisionConflict;
}
export type ProspectActivityType = 'call' | 'email' | 'message' | 'visit';

export interface RecordedProspectActivity {
  id: string;

  type: ProspectActivityType;

  occurredAt: string;
}
