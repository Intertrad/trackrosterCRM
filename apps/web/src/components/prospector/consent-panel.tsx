'use client';

import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { ApiError } from '@/lib/api/api-error';
import { listConsents, recordConsent } from '@/lib/api/consent-client';
import {
  CONSENT_CHANNELS,
  MAX_CONSENT_REASON,
  consentChannelLabel,
  consentStatusTone,
  effectiveConsent,
  isConsentExpired,
  type Consent,
  type ConsentChannel,
  type ConsentStatus,
} from '@/lib/api/consent-types';

const CONTACT_CHANNELS = ['phone', 'email', 'sms', 'visit'] as const;

/**
 * Contact permissions for one prospect.
 *
 * The record is append-only: correcting a decision means recording a newer
 * one, never editing the old. The history stays visible because that is what
 * makes it usable as evidence of what was believed, and when.
 */
export function ConsentPanel({ establishmentId }: { establishmentId: string }) {
  const [consents, setConsents] = useState<Consent[] | null>(null);
  const [recording, setRecording] = useState(false);
  const [channel, setChannel] = useState<ConsentChannel>('all');
  const [status, setStatus] = useState<ConsentStatus>('allowed');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  const load = useCallback(
    (signal?: AbortSignal): Promise<void> =>
      listConsents(establishmentId, { limit: 50 }, signal)
        .then((page) => {
          if (!signal?.aborted) {
            setConsents(page.items);
            setError(null);
          }
        })
        .catch((caught: unknown) => {
          if (signal?.aborted) {
            return;
          }

          setConsents([]);

          /* Consent is separately authorised; a denial is not a page error. */
          if (
            caught instanceof ApiError &&
            (caught.statusCode === 403 || caught.statusCode === 400)
          ) {
            setDenied(true);

            return;
          }

          setError('We could not load contact permissions.');
        }),
    [establishmentId],
  );

  useEffect(() => {
    const controller = new AbortController();

    void load(controller.signal);

    return () => controller.abort();
  }, [load]);

  if (denied) {
    return null;
  }

  return (
    <Card>
      <CardHeader
        title="Contact permissions"
        action={
          !recording ? (
            <Button variant="secondary" onClick={() => setRecording(true)}>
              Record
            </Button>
          ) : undefined
        }
      />

      {consents === null ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          {[0, 1].map((row) => (
            <div key={row} className="h-11 animate-pulse rounded-lg bg-line-soft" />
          ))}
        </div>
      ) : (
        <>
          {/* What governs each channel right now, which is what a prospector
              needs before making contact. */}
          <ul className="flex flex-wrap gap-2">
            {CONTACT_CHANNELS.map((contactChannel) => {
              const governing = effectiveConsent(consents, contactChannel);

              return (
                <li key={contactChannel}>
                  <Badge tone={governing ? consentStatusTone(governing.status) : 'neutral'} dot>
                    {consentChannelLabel(contactChannel)}:{' '}
                    {governing ? governing.status : 'unknown'}
                  </Badge>
                </li>
              );
            })}
          </ul>

          {consents.length > 0 ? (
            <ul className="mt-4 flex flex-col divide-y divide-line-soft">
              {consents.map((consent) => (
                <li key={consent.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                  <ShieldCheck aria-hidden="true" className="size-4 shrink-0 text-ink-muted" />

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] text-ink">
                      {consentChannelLabel(consent.channel)} · {consent.status}
                    </span>

                    <span className="block truncate text-[13px] text-ink-muted">
                      {consent.reason}
                    </span>
                  </span>

                  {isConsentExpired(consent) ? <Badge tone="neutral">Expired</Badge> : null}

                  <span className="shrink-0 text-[12px] text-ink-muted">
                    {formatDate(consent.effectiveAt)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-[14px] text-ink-muted">
              Nothing recorded. Every channel is treated as unknown until it is.
            </p>
          )}
        </>
      )}

      {error ? (
        <Alert tone="danger" className="mt-4">
          {error}
        </Alert>
      ) : null}

      {recording ? (
        <div className="mt-5 flex flex-col gap-4 rounded-xl border border-line-soft bg-surface-muted p-4">
          <SelectField
            label="Channel"
            value={channel}
            disabled={busy}
            onChange={(event) => setChannel(event.target.value as ConsentChannel)}
            options={CONSENT_CHANNELS.map((value) => ({
              value,
              label: consentChannelLabel(value),
            }))}
          />

          <SelectField
            label="Decision"
            value={status}
            disabled={busy}
            onChange={(event) => setStatus(event.target.value as ConsentStatus)}
            options={[
              { value: 'allowed', label: 'Allowed' },
              { value: 'blocked', label: 'Blocked' },
              { value: 'unknown', label: 'Unknown' },
            ]}
          />

          <TextField
            label="Reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="How this was established"
            maxLength={MAX_CONSENT_REASON}
            disabled={busy}
            required
          />

          <Alert tone="info" title="This is added, not substituted.">
            Earlier records stay in the history so the trail of what was believed, and when,
            survives.
          </Alert>

          <div className="flex flex-wrap gap-3">
            <Button
              loading={busy}
              disabled={reason.trim() === ''}
              onClick={() => {
                setBusy(true);
                setError(null);

                recordConsent(establishmentId, {
                  channel,
                  status,
                  reason: reason.trim(),
                })
                  .then(() => {
                    setRecording(false);
                    setReason('');

                    return load();
                  })
                  .catch((caught: unknown) =>
                    setError(
                      caught instanceof ApiError
                        ? caught.messages.join(' ')
                        : 'We could not record that decision.',
                    ),
                  )
                  .finally(() => setBusy(false));
              }}
            >
              Record decision
            </Button>

            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setRecording(false);
                setReason('');
                setError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
