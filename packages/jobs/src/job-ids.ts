export function buildFollowUpReminderJobId(followUpId: string, scheduledFor: string): string {
  const timestamp = Date.parse(scheduledFor);

  if (Number.isNaN(timestamp)) {
    throw new Error('scheduledFor must be a valid timestamp');
  }

  return ['follow-up-reminder', followUpId, timestamp].join('-');
}

export function buildReservationExpiryJobId(reservationId: string): string {
  return ['reservation-expiry', reservationId].join('-');
}
