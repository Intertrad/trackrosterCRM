'use client';

import { type FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Lock } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { ApiError } from '@/lib/api/api-error';
import { requestPasswordReset } from '@/lib/api/auth-client';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_COOLDOWN_SECONDS = 45;

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }

    intervalRef.current = setInterval(() => {
      setCooldown((current) => (current <= 1 ? 0 : current - 1));
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [cooldown]);

  async function send(address: string): Promise<void> {
    setFormError(null);
    setIsSubmitting(true);

    try {
      await requestPasswordReset(address);

      /*
       * The confirmation is identical whether or not the address exists.
       * Never branch the UI on account existence.
       */
      setSubmitted(true);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 429) {
        setFormError('Too many requests. Please wait before trying again.');
      } else if (error instanceof ApiError && error.statusCode === 400) {
        setEmailError('Enter a valid email address');
      } else {
        setFormError('TrackRoster is temporarily unavailable. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const trimmed = email.trim();

    if (!EMAIL_PATTERN.test(trimmed)) {
      setEmailError('Enter a valid email address');

      return;
    }

    setEmailError(null);

    await send(trimmed);
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
          Reset your password
        </h2>

        <p className="mt-2 text-[16px] text-ink-soft">
          Enter your email and we&rsquo;ll send you a secure reset link.
        </p>
      </header>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <TextField
          label="Email"
          type="email"
          name="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);

            if (emailError) {
              setEmailError(null);
            }
          }}
          error={emailError}
          placeholder="name@company.com"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={320}
          disabled={isSubmitting}
          required
        />

        {formError ? <Alert tone="danger">{formError}</Alert> : null}

        <Button type="submit" fullWidth loading={isSubmitting} disabled={!email.trim()}>
          Send reset link
        </Button>
      </form>

      <p className="mt-4 text-center text-[14px] text-ink-muted">
        If an account exists for this email, you will receive instructions shortly.
      </p>

      {submitted ? (
        <div className="mt-7 rounded-xl border border-success-border bg-success-bg px-6 py-7 text-center">
          <CheckCircle2 aria-hidden="true" className="mx-auto size-9 text-success" />

          <p className="mt-3 text-[19px] font-bold text-navy">Check your inbox</p>

          <p className="mt-1 text-[14px] text-ink-soft">The link expires in 30 minutes.</p>

          <Button
            variant="secondary"
            fullWidth
            size="md"
            className="mt-5"
            disabled={cooldown > 0 || isSubmitting}
            loading={isSubmitting}
            onClick={() => void send(email.trim())}
          >
            {cooldown > 0 ? `Resend in ${cooldown} seconds` : 'Resend reset link'}
          </Button>

          <button
            type="button"
            onClick={() => {
              setSubmitted(false);
              setCooldown(0);
              setEmail('');
            }}
            className="mt-3 text-[14px] font-semibold text-brand hover:text-brand-hover"
          >
            Use a different email
          </button>
        </div>
      ) : null}

      <div className="mt-8 flex items-center justify-center gap-3 border-t border-line-soft pt-5 text-[13px]">
        <a
          href="mailto:support@trackroster.app"
          className="font-semibold text-brand hover:text-brand-hover"
        >
          Get support
        </a>

        <span aria-hidden="true" className="text-line">
          |
        </span>

        <span className="flex items-center gap-2 text-ink-muted">
          <Lock aria-hidden="true" className="size-4" />
          Protected by encrypted sessions and optional MFA.
        </span>
      </div>
    </div>
  );
}
