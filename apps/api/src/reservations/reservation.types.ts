export interface ProspectReservation {
  overrideId?: string;
  reservationId: string;

  tenantId: string;

  organizationId: string;

  campaignId: string;
  campaignProspectId: string;

  establishmentId: string;

  assignmentId: string;
  teamId: string;
  userId: string;

  acquiredAt: string;
  expiresAt: string;
}

/*
 * Prospector-facing operational reservation state.
 *
 * Deliberately excludes:
 *
 * - tenant identity
 * - organization identity
 * - team identity
 * - assignment identity
 * - establishment identity
 * - reservation ownership identity
 *
 * A caller only needs to know whether:
 *
 * - no reservation exists;
 * - they own the current valid reservation; or
 * - some reservation currently blocks the prospect.
 */
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
