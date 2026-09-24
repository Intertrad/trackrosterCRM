import { describe, expect, it } from 'vitest';

import {
  effectiveConsent,
  isConsentExpired,
  type Consent,
  type ConsentChannel,
  type ConsentStatus,
} from './consent-types';

const NOW = Date.parse('2026-09-24T12:00:00.000Z');

function consent(
  channel: ConsentChannel,
  status: ConsentStatus,
  effectiveAt: string,
  expiresAt: string | null = null,
): Consent {
  return {
    id: `${channel}-${effectiveAt}`,
    tenantId: 't',
    establishmentId: 'e',
    contactId: null,
    channel,
    status,
    reason: 'test',
    evidence: null,
    effectiveAt,
    expiresAt,
    recordedBy: 'm',
    createdAt: effectiveAt,
  };
}

describe('isConsentExpired', () => {
  it('is false when no expiry is set', () => {
    expect(isConsentExpired(consent('email', 'allowed', '2026-09-01T00:00:00.000Z'), NOW)).toBe(
      false,
    );
  });

  it('is true once the expiry has passed', () => {
    expect(
      isConsentExpired(
        consent('email', 'allowed', '2026-09-01T00:00:00.000Z', '2026-09-20T00:00:00.000Z'),
        NOW,
      ),
    ).toBe(true);
  });

  it('does not treat an unparseable expiry as expired', () => {
    expect(
      isConsentExpired(consent('email', 'allowed', '2026-09-01T00:00:00.000Z', 'soon'), NOW),
    ).toBe(false);
  });
});

describe('effectiveConsent', () => {
  it('is null when nothing has been recorded', () => {
    expect(effectiveConsent([], 'email', NOW)).toBeNull();
  });

  it('takes the most recent record for the channel', () => {
    const records = [
      consent('email', 'allowed', '2026-09-01T00:00:00.000Z'),
      consent('email', 'blocked', '2026-09-20T00:00:00.000Z'),
    ];

    expect(effectiveConsent(records, 'email', NOW)?.status).toBe('blocked');
  });

  /*
   * The rule that matters: an explicit channel decision must not be
   * overridden by a later blanket "all", or a blanket allow would silently
   * undo a specific block.
   */
  it('prefers a channel-specific record over a newer blanket one', () => {
    const records = [
      consent('email', 'blocked', '2026-09-01T00:00:00.000Z'),
      consent('all', 'allowed', '2026-09-20T00:00:00.000Z'),
    ];

    expect(effectiveConsent(records, 'email', NOW)?.status).toBe('blocked');
  });

  it('falls back to a blanket record when the channel has none', () => {
    const records = [consent('all', 'blocked', '2026-09-01T00:00:00.000Z')];

    expect(effectiveConsent(records, 'visit', NOW)?.status).toBe('blocked');
  });

  it('ignores an expired record', () => {
    const records = [
      consent('email', 'blocked', '2026-09-01T00:00:00.000Z', '2026-09-10T00:00:00.000Z'),
    ];

    expect(effectiveConsent(records, 'email', NOW)).toBeNull();
  });

  /* A decision dated in the future is not in force yet. */
  it('ignores a record that has not taken effect', () => {
    const records = [consent('email', 'blocked', '2026-10-01T00:00:00.000Z')];

    expect(effectiveConsent(records, 'email', NOW)).toBeNull();
  });
});
