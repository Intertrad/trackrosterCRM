'use client';

import { useEffect, useState } from 'react';
import { ShieldQuestion } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { ApiError } from '@/lib/api/api-error';
import { checkCollision, requestCollisionOverride } from '@/lib/api/collision-client';
import {
  MAX_OVERRIDE_REASON,
  MIN_OVERRIDE_REASON,
  canRaiseOverride,
  type CollisionCheckResult,
} from '@/lib/api/collision-types';

type Phase = 'idle' | 'checking' | 'ready' | 'composing' | 'sent';

/**
 * The prospector's way out of a blocked contact.
 *
 * The read-only collision decision shown above states *that* the contact is
 * refused but yields no handle to act on: only `POST /reservations/check`
 * records a collision event and returns its id. So the check is run here, on
 * demand, and the override request is raised against the event it creates.
 *
 * Nothing is presumed about the outcome — the engine decides, and a refusal
 * that policy marks non-overrideable says so rather than offering a button
 * that would be rejected.
 */
export function OverrideRequest({
  campaignId,
  prospectId,
  onRequested,
}: {
  campaignId: string;
  prospectId: string;
  onRequested?: () => void;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [check, setCheck] = useState<CollisionCheckResult | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);

  /* A new prospect is a new decision; nothing carries over. */
  useEffect(() => {
    setPhase('idle');
    setCheck(null);
    setReason('');
    setError(null);
    setIdempotencyKey(null);
  }, [campaignId, prospectId]);

  async function runCheck(): Promise<void> {
    setPhase('checking');
    setError(null);

    try {
      const result = await checkCollision(campaignId, prospectId, crypto.randomUUID());

      setCheck(result);
      setPhase('ready');
    } catch (caught) {
      setPhase('idle');
      setError(describeOverrideError(caught));
    }
  }

  function send(): void {
    if (!canRaiseOverride(check)) {
      return;
    }

    /* One key per composed request: a retry must replay, not raise a second. */
    const key = idempotencyKey ?? crypto.randomUUID();

    setIdempotencyKey(key);
    setPhase('checking');
    setError(null);

    requestCollisionOverride(check.collisionId, reason.trim(), key)
      .then(() => {
        setIdempotencyKey(null);
        setPhase('sent');
        onRequested?.();
      })
      .catch((caught: unknown) => {
        setPhase('composing');
        setError(describeOverrideError(caught));
      });
  }

  if (phase === 'sent') {
    return (
      <Alert tone="success" title="Override request sent.">
        A manager will review it. You will see the decision here once it is made.
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? <Alert tone="danger">{error}</Alert> : null}

      {phase === 'idle' ? (
        <Button variant="secondary" onClick={() => void runCheck()}>
          <ShieldQuestion aria-hidden="true" className="mr-2 size-4" />
          Ask a manager to authorise this contact
        </Button>
      ) : null}

      {phase === 'checking' ? (
        <p aria-live="polite" className="text-[14px] text-ink-muted">
          Checking contact authorisation…
        </p>
      ) : null}

      {phase === 'ready' && check ? (
        canRaiseOverride(check) ? (
          <Button onClick={() => setPhase('composing')}>Request an override</Button>
        ) : check.decision === 'allow' ? (
          <Alert tone="success" title="This contact is allowed now.">
            The block has cleared. Reload the prospect to continue.
          </Alert>
        ) : (
          <Alert tone="warning" title="An override is not available for this conflict.">
            The reservation rule in force does not permit a manager override here.
          </Alert>
        )
      ) : null}

      {phase === 'composing' ? (
        <div className="flex flex-col gap-3 rounded-xl border border-line-soft bg-surface-muted p-4">
          <TextField
            label="Why should this contact proceed?"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Give your manager enough to decide"
            maxLength={MAX_OVERRIDE_REASON}
            required
          />

          <p className="-mt-1 text-[13px] text-ink-muted">
            At least {MIN_OVERRIDE_REASON} characters. This goes to your manager and is recorded in
            the audit log.
          </p>

          <div className="flex flex-wrap gap-3">
            <Button disabled={reason.trim().length < MIN_OVERRIDE_REASON} onClick={send}>
              Send request
            </Button>

            <Button variant="secondary" onClick={() => setPhase('ready')}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function describeOverrideError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return 'Something went wrong. Please try again.';
  }

  if (error.statusCode === 409) {
    return 'This prospect changed while you were looking at it. Reload before trying again.';
  }

  if (error.statusCode === 403) {
    return 'You are not authorised to request an override for this prospect.';
  }

  if (error.statusCode === 400) {
    return error.messages.join(' ');
  }

  return 'We could not reach the collision engine. Please try again.';
}
