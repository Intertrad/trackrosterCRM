import { browserJson } from './browser-json';
import type { Consent, ConsentPage, CreateConsentInput } from './consent-types';

export function listConsents(
  prospectId: string,
  options: { cursor?: string; limit?: number } = {},
  signal?: AbortSignal,
): Promise<ConsentPage> {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }

  const search = params.toString();
  const path = `/api/prospects/${encodeURIComponent(prospectId)}/consents`;

  return browserJson<ConsentPage>(search ? `${path}?${search}` : path, {
    cache: 'no-store',
    signal,
  });
}

/* Append-only: this records a new decision, it never edits an earlier one. */
export function recordConsent(prospectId: string, input: CreateConsentInput): Promise<Consent> {
  return browserJson<Consent>(`/api/prospects/${encodeURIComponent(prospectId)}/consents`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
    body: JSON.stringify(input),
  });
}
