'use client';

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, CircleDashed } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { ApiError } from '@/lib/api/api-error';
import { acceptInvitation, previewInvitation } from '@/lib/api/auth-client';
import type { InvitationPreview } from '@/lib/api/auth-types';
import { MAX_PASSWORD_LENGTH, PASSWORD_RULES, assessPassword } from '@/lib/auth/password-policy';

type TokenState =
  | { kind: 'checking' }
  | { kind: 'valid'; preview: InvitationPreview }
  | { kind: 'invalid' }
  | { kind: 'unavailable' };

export function InvitationAcceptanceForm() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [tokenState, setTokenState] = useState<TokenState>({ kind: 'checking' });
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const assessment = useMemo(() => assessPassword(password), [password]);

  useEffect(() => {
    const value = new URLSearchParams(window.location.hash.slice(1)).get('token');
    window.history.replaceState(null, '', window.location.pathname);
    if (!value || !/^[A-Za-z0-9_-]{43}$/.test(value)) {
      setTokenState({ kind: 'invalid' });
      return;
    }
    setToken(value);
    const controller = new AbortController();
    previewInvitation(value, controller.signal)
      .then((preview) => setTokenState({ kind: 'valid', preview }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setTokenState(
          error instanceof ApiError && error.statusCode >= 400 && error.statusCode < 500
            ? { kind: 'invalid' }
            : { kind: 'unavailable' },
        );
      });
    return () => controller.abort();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || tokenState.kind !== 'valid') return;
    if (password !== confirmation) {
      setFormError('Passwords do not match.');
      return;
    }
    setFormError(null);
    setIsSubmitting(true);
    try {
      await acceptInvitation(token, password, mfaCode || undefined);
      router.replace('/login?invitation=accepted');
    } catch (error) {
      setFormError(
        error instanceof ApiError && error.statusCode === 401
          ? 'The password or authenticator code was not accepted.'
          : error instanceof ApiError && error.statusCode === 400
            ? error.messages.join(' ')
            : 'TrackRoster is temporarily unavailable. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (tokenState.kind === 'checking') {
    return (
      <div className="flex items-center gap-3 py-12 text-ink-soft">
        <CircleDashed className="size-5 animate-spin" /> Checking your invitation…
      </div>
    );
  }
  if (tokenState.kind === 'invalid') {
    return (
      <InvitationState
        title="This invitation is no longer valid."
        message="Ask your workspace administrator to send a fresh invitation."
      />
    );
  }
  if (tokenState.kind === 'unavailable') {
    return (
      <InvitationState
        title="We could not verify this invitation."
        message="TrackRoster is temporarily unavailable. Please try again in a moment."
      />
    );
  }

  const { preview } = tokenState;
  const passwordOkay = preview.existingAccount ? password.length > 0 : assessment.acceptable;
  const canSubmit =
    passwordOkay && password === confirmation && (!preview.mfaRequired || /^\d{6}$/.test(mfaCode));
  return (
    <div>
      <BackToSignIn />
      <header className="mt-5 mb-7">
        <h2 className="text-[34px] leading-[1.1] font-bold tracking-[-0.03em] text-navy">
          Join your workspace
        </h2>
        <p className="mt-2 text-[16px] text-ink-soft">
          You were invited to <strong className="text-ink">{preview.workspaceName}</strong> as{' '}
          {preview.emailHint}.
        </p>
      </header>
      <div className="mb-6 flex items-start gap-3 rounded-lg border border-success-border bg-success-bg px-4 py-3 text-sm font-semibold text-navy">
        <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden="true" />
        Your secure invitation link is valid for seven days.
      </div>
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        <TextField
          label={preview.existingAccount ? 'Current password' : 'Create a password'}
          type="password"
          name="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="new-password"
          maxLength={MAX_PASSWORD_LENGTH}
          disabled={isSubmitting}
          required
          hint={PASSWORD_RULES.map((rule) => rule.label).join(' · ')}
        />
        <TextField
          label="Confirm password"
          type="password"
          name="password-confirmation"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          autoComplete="new-password"
          maxLength={MAX_PASSWORD_LENGTH}
          disabled={isSubmitting}
          required
        />
        {preview.mfaRequired ? (
          <TextField
            label="Authenticator code"
            type="text"
            inputMode="numeric"
            name="mfa-code"
            value={mfaCode}
            onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            autoComplete="one-time-code"
            disabled={isSubmitting}
            required
            hint="Enter the six-digit code from your authenticator app."
          />
        ) : null}
        {formError ? <Alert tone="danger">{formError}</Alert> : null}
        <Button type="submit" fullWidth loading={isSubmitting} disabled={!canSubmit}>
          Accept invitation
        </Button>
      </form>
    </div>
  );
}

function BackToSignIn() {
  return (
    <Link
      href="/login"
      className="inline-flex items-center gap-2 text-[15px] font-semibold text-brand hover:text-brand-hover"
    >
      <ArrowLeft aria-hidden="true" className="size-[18px]" /> Back to sign in
    </Link>
  );
}

function InvitationState({ title, message }: { title: string; message: string }) {
  return (
    <div>
      <BackToSignIn />
      <header className="mt-6 mb-6">
        <h2 className="text-[34px] leading-[1.1] font-bold tracking-[-0.03em] text-navy">
          {title}
        </h2>
      </header>
      <Alert tone="warning">{message}</Alert>
    </div>
  );
}
