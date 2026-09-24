'use client';

import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { OtpInput } from '@/components/ui/otp-input';
import { TextField } from '@/components/ui/text-field';
import { ApiError } from '@/lib/api/api-error';
import { verifyMfaCode, verifyRecoveryCode } from '@/lib/api/auth-client';
import type { LoginOutcome } from '@/lib/api/auth-types';
import {
  challengeRoute,
  clearChallenges,
  readMfaChallenge,
  storeChallenge,
} from '@/lib/auth/auth-challenge';
import { useAuth } from '@/lib/auth/auth-context';

const TOTP_PERIOD_SECONDS = 30;

/* The backend accepts 32 lowercase hex characters; the field is presented in
 * readable groups and normalized by the client before it is sent. */
const RECOVERY_CODE_LENGTH = 32;

export function MfaChallengeForm() {
  const router = useRouter();
  const { refreshSession } = useAuth();

  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const [code, setCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [usingRecovery, setUsingRecovery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(() => remainingInPeriod());

  useEffect(() => {
    const challenge = readMfaChallenge();

    if (!challenge) {
      /* Expired or opened directly — the flow must restart at sign-in. */
      router.replace('/login');

      return;
    }

    setChallengeToken(challenge.challengeToken);
    setReady(true);
  }, [router]);

  useEffect(() => {
    const timer = setInterval(() => setSecondsLeft(remainingInPeriod()), 1000);

    return () => clearInterval(timer);
  }, []);

  const finish = useCallback(
    async (outcome: LoginOutcome): Promise<void> => {
      if (outcome.next !== 'authenticated') {
        storeChallenge(outcome);
        router.push(challengeRoute(outcome));

        return;
      }

      clearChallenges();

      const user = await refreshSession();

      if (!user) {
        setError('Your session could not be established. Please sign in again.');

        return;
      }

      router.replace('/');
      router.refresh();
    },
    [refreshSession, router],
  );

  const submitTotp = useCallback(
    async (value: string): Promise<void> => {
      if (!challengeToken || isSubmitting || value.length !== 6) {
        return;
      }

      setError(null);
      setIsSubmitting(true);

      try {
        await finish(await verifyMfaCode(challengeToken, value));
      } catch (caught) {
        setCode('');
        setError(describeMfaError(caught, router));
      } finally {
        setIsSubmitting(false);
      }
    },
    [challengeToken, finish, isSubmitting, router],
  );

  async function submitRecovery(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const normalized = recoveryCode.replace(/[\s-]/g, '').toLowerCase();

    if (!challengeToken || normalized.length !== RECOVERY_CODE_LENGTH) {
      setError('Enter the full recovery code from your saved list.');

      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await finish(await verifyRecoveryCode(challengeToken, normalized));
    } catch (caught) {
      setError(describeMfaError(caught, router));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!ready) {
    return <MfaSkeleton />;
  }

  return (
    <div>
      <Link
        href="/login"
        className="inline-flex items-center gap-2 text-[15px] font-semibold text-brand hover:text-brand-hover"
      >
        <ArrowLeft aria-hidden="true" className="size-[18px]" />
        Back to sign in
      </Link>

      <header className="mt-6 mb-7">
        <h2 className="text-[34px] leading-[1.1] font-bold tracking-[-0.03em] text-navy">
          Verify it&rsquo;s you
        </h2>

        <p className="mt-2 text-[16px] text-ink-soft">
          Enter the 6-digit code from your authenticator app.
        </p>
      </header>

      <OtpInput
        label="Authentication code"
        value={code}
        onChange={setCode}
        onComplete={(value) => void submitTotp(value)}
        disabled={isSubmitting}
        invalid={Boolean(error) && !usingRecovery}
      />

      <p className="mt-3.5 flex items-center gap-2.5 text-[14px] text-ink-soft">
        <PeriodRing secondsLeft={secondsLeft} />
        Code refreshes every {TOTP_PERIOD_SECONDS} seconds
      </p>

      {error ? (
        <Alert tone="danger" className="mt-4">
          {error}
        </Alert>
      ) : null}

      <Button
        fullWidth
        className="mt-5"
        loading={isSubmitting}
        disabled={code.length !== 6}
        onClick={() => void submitTotp(code)}
      >
        Verify and continue
      </Button>

      {!usingRecovery ? (
        <button
          type="button"
          onClick={() => {
            setUsingRecovery(true);
            setError(null);
          }}
          className="mt-4 w-full text-center text-[15px] font-semibold text-brand hover:text-brand-hover"
        >
          Use a recovery code instead
        </button>
      ) : (
        <>
          <div className="mt-6 flex items-center gap-4">
            <span className="h-px flex-1 bg-line-soft" />

            <span className="text-[13px] text-ink-muted">or</span>

            <span className="h-px flex-1 bg-line-soft" />
          </div>

          <form
            onSubmit={submitRecovery}
            className="mt-5 rounded-xl border border-line-soft bg-surface-muted p-5"
          >
            <TextField
              label="Recovery code"
              value={recoveryCode}
              onChange={(event) => setRecoveryCode(event.target.value)}
              placeholder="xxxxxxxx-xxxxxxxx-xxxxxxxx-xxxxxxxx"
              autoComplete="one-time-code"
              autoCapitalize="none"
              spellCheck={false}
              disabled={isSubmitting}
              hint="Each recovery code can be used once."
            />

            <Button
              type="submit"
              variant="secondary"
              fullWidth
              size="md"
              className="mt-4"
              loading={isSubmitting}
            >
              Use recovery code
            </Button>

            <button
              type="button"
              onClick={() => {
                setUsingRecovery(false);
                setRecoveryCode('');
                setError(null);
              }}
              className="mt-3 w-full text-center text-[14px] font-semibold text-brand hover:text-brand-hover"
            >
              Return to authenticator code
            </button>
          </form>
        </>
      )}

      {/*
       * Device trust has no backend contract yet, so the control is shown
       * disabled rather than silently doing nothing on submit.
       */}
      <div className="mt-6">
        <Checkbox label="Trust this device for 30 days" disabled />
      </div>

      <div className="mt-7 flex items-center justify-center gap-3 border-t border-line-soft pt-5 text-[13px] text-ink-muted">
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

function remainingInPeriod(): number {
  return TOTP_PERIOD_SECONDS - (Math.floor(Date.now() / 1000) % TOTP_PERIOD_SECONDS);
}

function PeriodRing({ secondsLeft }: { secondsLeft: number }) {
  const progress = secondsLeft / TOTP_PERIOD_SECONDS;

  return (
    <span
      aria-hidden="true"
      className="size-5 shrink-0 rounded-full"
      style={{
        background: `conic-gradient(var(--color-lime-deep) ${progress * 360}deg, var(--color-line-soft) 0deg)`,
        mask: 'radial-gradient(circle, transparent 54%, black 56%)',
        WebkitMask: 'radial-gradient(circle, transparent 54%, black 56%)',
      }}
    />
  );
}

function describeMfaError(error: unknown, router: ReturnType<typeof useRouter>): string {
  if (!(error instanceof ApiError)) {
    return 'Something went wrong. Please try again.';
  }

  if (error.statusCode === 401 || error.statusCode === 400) {
    return 'That code is not valid. Check your authenticator and try again.';
  }

  if (error.statusCode === 410 || error.statusCode === 404) {
    /* The five-minute challenge has lapsed; restart cleanly. */
    clearChallenges();
    router.replace('/login');

    return 'Your verification window expired. Please sign in again.';
  }

  if (error.statusCode === 429) {
    return 'Too many attempts. Wait a moment before trying again.';
  }

  return 'TrackRoster is temporarily unavailable. Please try again.';
}

function MfaSkeleton() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-live="polite">
      <span className="sr-only">Preparing verification…</span>

      <div className="h-5 w-32 rounded bg-line-soft" />
      <div className="mt-7 h-10 w-2/3 rounded bg-line-soft" />
      <div className="mt-3 h-5 w-3/4 rounded bg-line-soft" />

      <div className="mt-8 flex gap-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-[62px] flex-1 rounded-xl bg-line-soft" />
        ))}
      </div>

      <div className="mt-6 h-12 rounded-lg bg-line-soft" />
    </div>
  );
}
