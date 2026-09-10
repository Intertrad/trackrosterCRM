import { describe, expect, it } from 'vitest';

import { buildFollowUpReminderJobId, buildReservationExpiryJobId } from './job-ids.js';

describe('TrackRoster job IDs', () => {
  it('creates a deterministic follow-up reminder ID for one schedule', () => {
    const first = buildFollowUpReminderJobId(
      '11111111-1111-4111-8111-111111111111',
      '2026-09-10T14:00:00.000Z',
    );

    const second = buildFollowUpReminderJobId(
      '11111111-1111-4111-8111-111111111111',
      '2026-09-10T14:00:00.000Z',
    );

    expect(first).toBe(second);
  });

  it('creates a different reminder ID after rescheduling', () => {
    const first = buildFollowUpReminderJobId(
      '11111111-1111-4111-8111-111111111111',
      '2026-09-10T14:00:00.000Z',
    );

    const second = buildFollowUpReminderJobId(
      '11111111-1111-4111-8111-111111111111',
      '2026-09-10T16:00:00.000Z',
    );

    expect(first).not.toBe(second);
  });

  it('creates a deterministic reservation expiry ID', () => {
    expect(buildReservationExpiryJobId('22222222-2222-4222-8222-222222222222')).toBe(
      'reservation-expiry-22222222-2222-4222-8222-222222222222',
    );
  });

  it('rejects invalid reminder timestamps', () => {
    expect(() =>
      buildFollowUpReminderJobId('11111111-1111-4111-8111-111111111111', 'invalid'),
    ).toThrow('scheduledFor');
  });
});
