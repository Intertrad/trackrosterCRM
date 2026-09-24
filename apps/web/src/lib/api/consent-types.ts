export type ConsentChannel = 'all' | 'phone' | 'email' | 'sms' | 'visit';

export type ConsentStatus = 'allowed' | 'blocked' | 'unknown';

/**
 * A recorded contact permission for one prospect.
 *
 * Consent is append-only: a correction is a new record with a later
 * `effectiveAt`, never an edit, so the history of what was believed and when
 * survives. That is what makes it usable as evidence.
 */
export interface Consent {
  id: string;
  tenantId: string;
  establishmentId: string;
  contactId: string | null;
  channel: ConsentChannel;
  status: ConsentStatus;
  reason: string;
  evidence: Record<string, string> | null;
  effectiveAt: string;
  expiresAt: string | null;
  recordedBy: string;
  createdAt: string;
}

export interface ConsentPage {
  items: Consent[];
  nextCursor: string | null;
}

export interface CreateConsentInput {
  channel: ConsentChannel;
  status: ConsentStatus;
  reason: string;
  contactId?: string;
  evidence?: Record<string, string>;
  /** Must carry an explicit offset or Z; the API rejects a bare local time. */
  effectiveAt?: string;
  expiresAt?: string | null;
}

export const MAX_CONSENT_REASON = 2000;

export const CONSENT_CHANNELS: readonly ConsentChannel[] = [
  'all',
  'phone',
  'email',
  'sms',
  'visit',
];

const CHANNEL_LABELS: Record<ConsentChannel, string> = {
  all: 'All channels',
  phone: 'Phone',
  email: 'Email',
  sms: 'SMS',
  visit: 'Visit',
};

export function consentChannelLabel(channel: ConsentChannel): string {
  return CHANNEL_LABELS[channel] ?? channel;
}

export function consentStatusTone(status: ConsentStatus): 'success' | 'danger' | 'neutral' {
  return status === 'allowed' ? 'success' : status === 'blocked' ? 'danger' : 'neutral';
}

/** A consent record stops applying once its expiry passes. */
export function isConsentExpired(consent: Consent, now: number = Date.now()): boolean {
  if (!consent.expiresAt) {
    return false;
  }

  const expiry = new Date(consent.expiresAt).getTime();

  return Number.isNaN(expiry) ? false : expiry <= now;
}

/**
 * The record that governs a channel right now.
 *
 * The latest effective, unexpired record wins. A blanket `all` record applies
 * only when nothing more specific to the channel exists, so an explicit
 * "email blocked" is never overridden by a general "all allowed".
 */
export function effectiveConsent(
  consents: Consent[],
  channel: Exclude<ConsentChannel, 'all'>,
  now: number = Date.now(),
): Consent | null {
  const applicable = consents
    .filter((consent) => !isConsentExpired(consent, now))
    .filter((consent) => new Date(consent.effectiveAt).getTime() <= now);

  const ranked = [...applicable].sort(
    (left, right) => new Date(right.effectiveAt).getTime() - new Date(left.effectiveAt).getTime(),
  );

  return (
    ranked.find((consent) => consent.channel === channel) ??
    ranked.find((consent) => consent.channel === 'all') ??
    null
  );
}
