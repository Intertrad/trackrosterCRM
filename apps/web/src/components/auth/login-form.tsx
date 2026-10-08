'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AtSign, Lock, ShieldCheck } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
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

export function LoginForm({ language = 'fr' }: { language?: 'en' | 'fr' }) {
  const l = (en: string, fr: string) => (language === 'fr' ? fr : en);
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
      setEmailError(l('Enter a valid email address', 'Saisissez une adresse e-mail valide.'));
      (event.currentTarget.elements.namedItem('email') as HTMLInputElement)?.focus();

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
        setFormError(
          l(
            'Your session could not be established. Please sign in again.',
            'Votre session n’a pas pu être ouverte. Réessayez.',
          ),
        );

        return;
      }

      router.replace('/');
      router.refresh();
    } catch (error) {
      setFormError(describeLoginError(error, language));
    } finally {
      setIsSubmitting(false);
    }
  }

  const canSubmit = email.trim().length > 0 && password.length > 0;

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <TextField
        label={l('Professional email', 'Email professionnel')}
        leading={<AtSign size={18} />}
        placeholder="firstname.lastname@trackroster.fr"
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

        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={320}
        disabled={isSubmitting}
        required
      />

      <TextField
        label={l('Password', 'Mot de passe')}
        leading={<Lock size={18} />}
        language={language}
        type="password"
        name="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}

        autoComplete="current-password"
        maxLength={1024}
        disabled={isSubmitting}
        required
      />

      {formError ? <Alert tone="danger">{formError}</Alert> : null}

      {config.passwordRecovery && (
        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-[15px] font-bold text-brand hover:underline"
          >
            {l('Forgot password?', 'Mot de passe oublié ?')}
          </Link>
        </div>
      )}
      <Button type="submit" fullWidth loading={isSubmitting} disabled={!canSubmit}>
        {l('Sign in', 'Se connecter')}
      </Button>
      <div className="mt-2 flex items-center gap-2.5 rounded-[10px] bg-success-bg px-4 py-3.5 text-[15px] font-semibold text-success">
        <ShieldCheck size={18} aria-hidden="true" />
        <span>
          {l(
            'Secure access — your permissions follow your account',
            'Accès sécurisé — vos droits sont liés à votre compte',
          )}
        </span>
      </div>
      {config.sso.enabled ? (
        <SsoOptions providers={config.sso.providers ?? []} language={language} />
      ) : null}
    </form>
  );
}

function SsoOptions({ providers, language }: { providers: string[]; language: 'en' | 'fr' }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <span className="h-px flex-1 bg-line-soft" />

        <span className="text-[13px] text-ink-muted">
          {language === 'fr' ? 'ou continuer avec' : 'or continue with'}
        </span>

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
          <span className="capitalize">
            {language === 'fr' ? 'Se connecter avec' : 'Sign in with'} {provider}
          </span>
        </Button>
      ))}
    </div>
  );
}

function describeLoginError(error: unknown, language: 'en' | 'fr'): string {
  const l = (en: string, fr: string) => (language === 'fr' ? fr : en);
  if (!(error instanceof ApiError)) {
    return l('Something went wrong. Please try again.', 'Une erreur est survenue. Réessayez.');
  }

  if (error.statusCode === 401) {
    return l('Invalid email or password.', 'Adresse e-mail ou mot de passe incorrect.');
  }

  if (error.statusCode === 423) {
    return l(
      'This account is locked. Contact your administrator.',
      'Ce compte est verrouillé. Contactez votre administrateur.',
    );
  }

  if (error.statusCode === 429) {
    return l(
      'Too many attempts. Wait a moment and try again.',
      'Trop de tentatives. Patientez avant de réessayer.',
    );
  }

  if (error.statusCode === 400) {
    return l(
      'Please check your email and password.',
      'Vérifiez votre adresse e-mail et votre mot de passe.',
    );
  }

  if (error.code === 'NETWORK_ERROR' || error.statusCode >= 500) {
    return l(
      'TrackRoster is temporarily unavailable. Please try again.',
      'TrackRoster est momentanément indisponible. Réessayez.',
    );
  }

  return error.message;
}
