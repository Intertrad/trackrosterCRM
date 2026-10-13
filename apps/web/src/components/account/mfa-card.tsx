'use client';

import { useState } from 'react';
import { KeyRound, ShieldCheck } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { OtpInput } from '@/components/ui/otp-input';
import { TextField } from '@/components/ui/text-field';
import { ApiError } from '@/lib/api/api-error';
import {
  disableMfa,
  regenerateRecoveryCodes,
  startMfaEnrollment,
  verifyMfaCode,
} from '@/lib/api/auth-client';
import type { MfaEnrollment } from '@/lib/api/auth-types';
import { notify } from '@/lib/notifications/notify';

type Mode = 'idle' | 'enrolling' | 'confirming' | 'rotating' | 'disabling';

/**
 * Two-factor authentication for the signed-in user.
 *
 * Every transition here re-proves the password, and removal and rotation also
 * require a live TOTP code — that is the API's contract, not extra friction
 * added here. The password is held only in component state for the length of
 * one request and is never stored, logged or echoed back.
 *
 * Confirmation reuses `POST /auth/mfa/verify`, the same endpoint the login
 * challenge uses, so a successful enrolment also refreshes the session
 * cookies. That is expected rather than a side effect to guard against.
 */
export function MfaCard({ enabled }: { enabled: boolean }) {
  const [mode, setMode] = useState<Mode>('idle');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset(): void {
    setMode('idle');
    setPassword('');
    setCode('');
    setEnrollment(null);
    setError(null);
  }

  async function begin(): Promise<void> {
    setBusy(true);
    setError(null);

    try {
      const started = await startMfaEnrollment(password);

      setEnrollment(started);
      setPassword('');
      setMode('confirming');
    } catch (caught) {
      setError(describeMfaError(caught));
    } finally {
      setBusy(false);
    }
  }

  async function confirm(): Promise<void> {
    if (!enrollment) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await verifyMfaCode(enrollment.challengeToken, code);

      notify.success('Two-factor authentication is now on for your account.', {
        id: 'mfa-enabled',
      });
      reset();
    } catch (caught) {
      setError(describeMfaError(caught));
    } finally {
      setBusy(false);
    }
  }

  async function rotate(): Promise<void> {
    setBusy(true);
    setError(null);

    try {
      const result = await regenerateRecoveryCodes(password, code);

      setRecoveryCodes(result.recoveryCodes);
      notify.success('New recovery codes generated. Your previous codes no longer work.', {
        id: 'mfa-recovery-codes-rotated',
      });
      reset();
    } catch (caught) {
      setError(describeMfaError(caught));
    } finally {
      setBusy(false);
    }
  }

  async function remove(): Promise<void> {
    setBusy(true);
    setError(null);

    try {
      await disableMfa(password, code);

      notify.success('Two-factor authentication has been removed from your account.', {
        id: 'mfa-disabled',
      });
      setRecoveryCodes(null);
      reset();
    } catch (caught) {
      setError(describeMfaError(caught));
    } finally {
      setBusy(false);
    }
  }

  const passwordTooShort = password.length === 0;
  const codeIncomplete = code.length !== 6;

  return (
    <Card>
      <CardHeader
        title="Two-factor authentication"
        action={
          enabled ? (
            <Badge tone="success" dot>
              On
            </Badge>
          ) : (
            <Badge tone="warning" dot>
              Off
            </Badge>
          )
        }
      />

      {recoveryCodes ? (
        <Alert tone="warning" className="mb-4" title="Save these recovery codes now.">
          <p className="mt-1">
            They are shown once and cannot be retrieved again. Each one works a single time if you
            lose your authenticator.
          </p>

          <ul className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {recoveryCodes.map((recoveryCode) => (
              <li
                key={recoveryCode}
                className="rounded-md bg-surface px-2.5 py-1.5 font-mono text-[13px] text-ink"
              >
                {recoveryCode}
              </li>
            ))}
          </ul>

          <Button variant="secondary" className="mt-4" onClick={() => setRecoveryCodes(null)}>
            I have saved them
          </Button>
        </Alert>
      ) : null}

      {mode === 'idle' ? (
        <>
          <p className="text-[15px] text-ink-muted">
            {enabled
              ? 'An authenticator app is protecting your account. You will be asked for a six-digit code when you sign in.'
              : 'Add an authenticator app so a stolen password alone cannot open your account.'}
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            {enabled ? (
              <>
                <Button variant="secondary" onClick={() => setMode('rotating')}>
                  <KeyRound aria-hidden="true" className="mr-2 size-4" />
                  New recovery codes
                </Button>

                <Button variant="danger" onClick={() => setMode('disabling')}>
                  Turn off
                </Button>
              </>
            ) : (
              <Button onClick={() => setMode('enrolling')}>
                <ShieldCheck aria-hidden="true" className="mr-2 size-4" />
                Set up authenticator
              </Button>
            )}
          </div>
        </>
      ) : null}

      {mode === 'enrolling' ? (
        <div className="flex flex-col gap-4">
          <p className="text-[15px] text-ink-muted">Confirm your password to begin.</p>

          <TextField
            label="Current password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            maxLength={1024}
            disabled={busy}
            required
          />

          {error ? <Alert tone="danger">{error}</Alert> : null}

          <div className="flex flex-wrap gap-3">
            <Button loading={busy} disabled={passwordTooShort} onClick={() => void begin()}>
              Continue
            </Button>

            <Button variant="secondary" disabled={busy} onClick={reset}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {mode === 'confirming' && enrollment ? (
        <div className="flex flex-col gap-4">
          <p className="text-[15px] text-ink-muted">
            Add this account to your authenticator app, then enter the six-digit code it shows. This
            setup expires in {Math.round(enrollment.expiresIn / 60)} minutes.
          </p>

          <div className="rounded-xl border border-line-soft bg-surface-muted p-4">
            <p className="text-[13px] font-semibold text-ink-muted">Setup key</p>

            <p className="mt-1 font-mono text-[15px] break-all text-ink">{enrollment.setupKey}</p>

            <a
              href={enrollment.otpauthUri}
              className="mt-3 inline-block text-[14px] font-semibold text-brand hover:text-brand-hover"
            >
              Open in your authenticator app
            </a>
          </div>

          <OtpInput
            label="Six-digit code from your authenticator"
            value={code}
            onChange={setCode}
            disabled={busy}
          />

          {error ? <Alert tone="danger">{error}</Alert> : null}

          <div className="flex flex-wrap gap-3">
            <Button loading={busy} disabled={codeIncomplete} onClick={() => void confirm()}>
              Turn on
            </Button>

            <Button variant="secondary" disabled={busy} onClick={reset}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {mode === 'rotating' || mode === 'disabling' ? (
        <div className="flex flex-col gap-4">
          <p className="text-[15px] text-ink-muted">
            {mode === 'rotating'
              ? 'Generating new codes invalidates every existing recovery code.'
              : 'Removing two-factor authentication leaves your password as the only protection on this account.'}
          </p>

          <TextField
            label="Current password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            maxLength={1024}
            disabled={busy}
            required
          />

          <OtpInput
            label="Six-digit code from your authenticator"
            value={code}
            onChange={setCode}
            disabled={busy}
          />

          {error ? <Alert tone="danger">{error}</Alert> : null}

          <div className="flex flex-wrap gap-3">
            <Button
              loading={busy}
              variant={mode === 'disabling' ? 'danger' : 'primary'}
              disabled={passwordTooShort || codeIncomplete}
              onClick={() => void (mode === 'rotating' ? rotate() : remove())}
            >
              {mode === 'rotating' ? 'Generate new codes' : 'Turn off'}
            </Button>

            <Button variant="secondary" disabled={busy} onClick={reset}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function describeMfaError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return 'Something went wrong. Please try again.';
  }

  if (error.statusCode === 401) {
    return 'That password is not correct.';
  }

  if (error.statusCode === 400) {
    return 'That code was not accepted. Check your authenticator and try again.';
  }

  if (error.statusCode === 409) {
    return 'This setup has expired. Start again.';
  }

  if (error.statusCode === 429) {
    return 'Too many attempts. Wait a moment and try again.';
  }

  return 'We could not complete that change. Please try again.';
}
