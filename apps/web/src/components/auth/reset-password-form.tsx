'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, CircleCheck, CircleDashed, Clock, X } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { ApiError } from '@/lib/api/api-error';
import { getPasswordResetStatus, resetPassword } from '@/lib/api/auth-client';
import { MAX_PASSWORD_LENGTH, PASSWORD_RULES, assessPassword } from '@/lib/auth/password-policy';
import { cn } from '@/lib/ui/cn';

type TokenState =
  | { kind: 'checking' }
  | { kind: 'valid'; expiresAt?: string }
  | { kind: 'invalid' }
  | { kind: 'unavailable' };

const STRENGTH_LABEL = {
  weak: 'Weak',
  fair: 'Fair',
  good: 'Good',
  strong: 'Strong',
} as const;

const STRENGTH_COLOR = {
  weak: 'bg-danger',
  fair: 'bg-warning',
  good: 'bg-lime-deep',
  strong: 'bg-success',
} as const;

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();

  const [tokenState, setTokenState] = useState<TokenState>({ kind: 'checking' });
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verifiedNoticeVisible, setVerifiedNoticeVisible] = useState(true);

  /* Validate without consuming, so an expired link shows its own state. */
  useEffect(() => {
    const controller = new AbortController();

    getPasswordResetStatus(token, controller.signal)
      .then((status) =>
        setTokenState(
          status.valid ? { kind: 'valid', expiresAt: status.expiresAt } : { kind: 'invalid' },
        ),
      )
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setTokenState(
          error instanceof ApiError && error.statusCode >= 400 && error.statusCode < 500
            ? { kind: 'invalid' }
            : { kind: 'unavailable' },
        );
      });

    return () => controller.abort();
  }, [token]);

  const assessment = useMemo(() => assessPassword(password), [password]);

  const minutesLeft = useMemo(() => {
    if (tokenState.kind !== 'valid' || !tokenState.expiresAt) {
      return null;
    }

    const diff = new Date(tokenState.expiresAt).getTime() - Date.now();

    return diff > 0 ? Math.ceil(diff / 60000) : 0;
  }, [tokenState]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (password !== confirmation) {
      setConfirmError('Passwords do not match');

      return;
    }

    setConfirmError(null);
    setFormError(null);
    setIsSubmitting(true);

    try {
      await resetPassword(token, password);

      /*
       * The reset revokes existing sessions server-side, so the user is
       * routed back to sign-in rather than silently authenticated.
       */
      router.replace('/login?reset=success');
    } catch (error) {
      if (error instanceof ApiError && (error.statusCode === 400 || error.statusCode === 410)) {
        setTokenState({ kind: 'invalid' });
      } else if (error instanceof ApiError && error.statusCode === 429) {
        setFormError('Too many attempts. Please wait before trying again.');
      } else {
        setFormError('TrackRoster is temporarily unavailable. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (tokenState.kind === 'checking') {
    return <ResetSkeleton />;
  }

  if (tokenState.kind === 'invalid') {
    return (
      <div>
        <BackToSignIn />

        <header className="mt-6 mb-6">
          <h2 className="text-[34px] leading-[1.1] font-bold tracking-[-0.03em] text-navy">
            This link has expired
          </h2>
        </header>

        <Alert tone="warning" title="Reset links are single-use and time-limited.">
          Request a new link and open it from the most recent email.
        </Alert>

        <Button fullWidth className="mt-6" onClick={() => router.push('/forgot-password')}>
          Request a new link
        </Button>
      </div>
    );
  }

  if (tokenState.kind === 'unavailable') {
    return (
      <div>
        <BackToSignIn />

        <header className="mt-6 mb-6">
          <h2 className="text-[34px] leading-[1.1] font-bold tracking-[-0.03em] text-navy">
            Create a new password
          </h2>
        </header>

        <Alert tone="danger" title="We could not verify this link.">
          TrackRoster is temporarily unavailable. Please try again in a moment.
        </Alert>
      </div>
    );
  }

  const canSubmit = assessment.acceptable && confirmation.length > 0 && password === confirmation;

  return (
    <div>
      {verifiedNoticeVisible ? (
        <div className="mb-6 flex items-start justify-between gap-3 rounded-lg border border-success-border bg-success-bg px-4 py-3">
          <p className="flex items-center gap-2.5 text-[14px] font-semibold text-navy">
            <CircleCheck aria-hidden="true" className="size-5 text-success" />
            Email address verified
          </p>

          <button
            type="button"
            onClick={() => setVerifiedNoticeVisible(false)}
            aria-label="Dismiss"
            className="text-ink-muted transition-colors hover:text-ink"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
      ) : null}

      <BackToSignIn />

      <header className="mt-5 mb-7">
        <h2 className="text-[34px] leading-[1.1] font-bold tracking-[-0.03em] text-navy">
          Create a new password
        </h2>

        <p className="mt-2 text-[16px] text-ink-soft">
          Choose a secure password for your TrackRoster account.
        </p>
      </header>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <div>
          <TextField
            label="New password"
            type="password"
            name="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            maxLength={MAX_PASSWORD_LENGTH}
            disabled={isSubmitting}
            required
          />

          {password ? <StrengthMeter assessment={assessment} /> : null}
        </div>

        <TextField
          label="Confirm new password"
          type="password"
          name="confirm-password"
          value={confirmation}
          onChange={(event) => {
            setConfirmation(event.target.value);

            if (confirmError) {
              setConfirmError(null);
            }
          }}
          error={confirmError}
          autoComplete="new-password"
          maxLength={MAX_PASSWORD_LENGTH}
          disabled={isSubmitting}
          required
        />

        {formError ? <Alert tone="danger">{formError}</Alert> : null}

        <Button type="submit" fullWidth loading={isSubmitting} disabled={!canSubmit}>
          Update password
        </Button>
      </form>

      {minutesLeft !== null ? (
        <p className="mt-4 flex items-center justify-center gap-2 text-[14px] text-ink-muted">
          <Clock aria-hidden="true" className="size-4" />
          This link expires in {minutesLeft} minute{minutesLeft === 1 ? '' : 's'}.
        </p>
      ) : null}

      <div className="mt-8 flex items-center justify-center gap-3 border-t border-line-soft pt-5 text-[13px] text-ink-muted">
        <span>Privacy</span>
        <span aria-hidden="true">·</span>
        <span>Terms</span>
        <span aria-hidden="true">·</span>
        <a href="mailto:support@trackroster.app" className="hover:text-ink">
          Support
        </a>
      </div>
    </div>
  );
}

function StrengthMeter({ assessment }: { assessment: ReturnType<typeof assessPassword> }) {
  return (
    <div className="mt-3">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1.5" aria-hidden="true">
          {[0, 1, 2, 3].map((index) => (
            <span
              key={index}
              className={cn(
                'h-[5px] flex-1 rounded-full transition-colors duration-200',
                index < assessment.score ? STRENGTH_COLOR[assessment.strength] : 'bg-line-soft',
              )}
            />
          ))}
        </div>

        <span
          className={cn(
            'text-[14px] font-semibold',
            assessment.strength === 'strong' ? 'text-success' : 'text-ink-soft',
          )}
        >
          {STRENGTH_LABEL[assessment.strength]}
        </span>
      </div>

      <ul className="mt-3 flex flex-col gap-2">
        {PASSWORD_RULES.map((rule) => {
          const met = assessment.satisfied.has(rule.id);

          return (
            <li key={rule.id} className="flex items-center gap-2.5 text-[14px]">
              {met ? (
                <CircleCheck aria-hidden="true" className="size-[18px] text-success" />
              ) : (
                <CircleDashed aria-hidden="true" className="size-[18px] text-line" />
              )}

              <span className={met ? 'text-ink' : 'text-ink-muted'}>
                {rule.label}
                {rule.enforced ? null : <span className="text-ink-muted"> (recommended)</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function BackToSignIn() {
  return (
    <Link
      href="/login"
      className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-brand hover:text-brand-hover"
    >
      <ChevronLeft aria-hidden="true" className="size-[18px]" />
      Back to sign in
    </Link>
  );
}

function ResetSkeleton() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-live="polite">
      <span className="sr-only">Checking your reset link…</span>

      <div className="h-5 w-32 rounded bg-line-soft" />
      <div className="mt-7 h-10 w-3/4 rounded bg-line-soft" />
      <div className="mt-3 h-5 w-2/3 rounded bg-line-soft" />

      <div className="mt-8 flex flex-col gap-5">
        <div className="h-12 rounded-lg bg-line-soft" />
        <div className="h-12 rounded-lg bg-line-soft" />
        <div className="h-12 rounded-lg bg-line-soft" />
      </div>
    </div>
  );
}
