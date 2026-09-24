'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { TextField } from '@/components/ui/text-field';
import { ApiError } from '@/lib/api/api-error';
import { getAuthConfig, login } from '@/lib/api/auth-client';
import type { AuthConfig } from '@/lib/api/auth-types';
import { challengeRoute, clearChallenges, storeChallenge } from '@/lib/auth/auth-challenge';
import { useAuth } from '@/lib/auth/auth-context';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/*
 * If /auth/config cannot be read we assume the standard password build:
 * hiding the recovery link on a transient failure would strand anyone who
 * actually needs it. SSO stays off, because offering an unconfigured
 * provider produces a dead end rather than a degraded one.
 */
const FALLBACK_CONFIG: AuthConfig = {
  password: true,
  mfa: { totp: true, recoveryCodes: true },
  passwordRecovery: true,
  sso: { enabled: false },
};

export function LoginForm() {
  const router = useRouter();
  const { refreshSession, status } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [config, setConfig] = useState<AuthConfig>(FALLBACK_CONFIG);

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/');
    }
  }, [router, status]);

  /*
   * Sign-in methods are declared by the backend. Rendering SSO or the
   * recovery link unconditionally would offer a path that cannot complete.
   */
  useEffect(() => {
    const controller = new AbortController();

    getAuthConfig(controller.signal)
      .then(setConfig)
      .catch(() => setConfig(FALLBACK_CONFIG));

    return () => controller.abort();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const trimmed = email.trim();

    if (!EMAIL_PATTERN.test(trimmed)) {
      setEmailError('Enter a valid email address');

      return;
    }

    setEmailError(null);
    setFormError(null);
    setIsSubmitting(true);

    try {
      clearChallenges();

      const outcome = await login(trimmed, password);

      if (outcome.next !== 'authenticated') {
        storeChallenge(outcome);
        router.push(challengeRoute(outcome));

        return;
      }

      const user = await refreshSession();

      if (!user) {
        setFormError('Your session could not be established. Please sign in again.');

        return;
      }

      router.replace('/');
      router.refresh();
    } catch (error) {
      setFormError(describeLoginError(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  const canSubmit = email.trim().length > 0 && password.length > 0;

  return (
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

      <TextField
        label="Password"
        type="password"
        name="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Enter your password"
        autoComplete="current-password"
        maxLength={1024}
        disabled={isSubmitting}
        required
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        {/*
         * "Remember this device" is deliberately absent until a trusted-device
         * contract exists; MFA owns the only device-trust flow today.
         */}
        <Checkbox label="Keep me signed in on this device" disabled />

        {config.passwordRecovery ? (
          <Link
            href="/forgot-password"
            className="text-[14px] font-semibold text-brand hover:text-brand-hover"
          >
            Forgot password?
          </Link>
        ) : null}
      </div>

      {formError ? <Alert tone="danger">{formError}</Alert> : null}

      <Button type="submit" fullWidth loading={isSubmitting} disabled={!canSubmit}>
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </Button>

      {config.sso.enabled ? <SsoOptions providers={config.sso.providers ?? []} /> : null}
    </form>
  );
}

function SsoOptions({ providers }: { providers: string[] }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <span className="h-px flex-1 bg-line-soft" />

        <span className="text-[13px] text-ink-muted">or continue with</span>

        <span className="h-px flex-1 bg-line-soft" />
      </div>

      {providers.map((provider) => (
        <Button
          key={provider}
          variant="secondary"
          fullWidth
          onClick={() => {
            window.location.assign(`/api/auth/sso/${encodeURIComponent(provider)}/start`);
          }}
        >
          <span className="capitalize">Sign in with {provider}</span>
        </Button>
      ))}
    </div>
  );
}

function describeLoginError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return 'Something went wrong. Please try again.';
  }

  if (error.statusCode === 401) {
    return 'Invalid email or password.';
  }

  if (error.statusCode === 423) {
    return 'This account is locked. Contact your administrator.';
  }

  if (error.statusCode === 429) {
    return 'Too many attempts. Wait a moment and try again.';
  }

  if (error.statusCode === 400) {
    return 'Please check your email and password.';
  }

  if (error.code === 'NETWORK_ERROR' || error.statusCode >= 500) {
    return 'TrackRoster is temporarily unavailable. Please try again.';
  }

  return error.message;
}
