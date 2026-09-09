export interface ProspectReservation {
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
