'use client';

import { type FormEvent, useEffect, useState } from 'react';
import { Eye, EyeOff, Info, LockKeyhole, Mail } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { useRouter } from 'next/navigation';

import { ApiError } from '@/lib/api/api-error';
import { browserJson } from '@/lib/api/browser-json';

import styles from './login-form.module.css';

export function LoginForm() {
  const router = useRouter();
  const { refreshSession, status } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/');
    }
  }, [router, status]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (isSubmitting || !email.trim() || !password) {
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await browserJson<void>('/api/auth/login', {
        method: 'POST',

        headers: {
          'content-type': 'application/json',
        },

        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      /*
       * D3 will eventually redirect according to the
       * authenticated user's real backend grants.
       *
       * For now "/" is our temporary authenticated
       * landing location.
       */

      const user = await refreshSession();

      if (!user) {
        setErrorMessage('Your session could not be established. Please sign in again.');

        return;
      }

      router.replace('/');
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.statusCode === 401) {
          setErrorMessage('Invalid email or password.');
        } else if (error.statusCode === 400) {
          setErrorMessage('Please check your email and password.');
        } else if (error.code === 'NETWORK_ERROR' || error.statusCode >= 500) {
          setErrorMessage('TrackRoster is temporarily unavailable. Please try again.');
        } else {
          setErrorMessage(error.message);
        }

        return;
      }

      setErrorMessage('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className={styles.card} onSubmit={handleSubmit} noValidate>
      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="email">
          Work email
        </label>

        <div className={styles.inputWrapper}>
          <Mail className={styles.inputIcon} size={20} strokeWidth={1.8} aria-hidden="true" />

          <input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={styles.input}
            placeholder="name@company.com"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={320}
            required
            disabled={isSubmitting}
          />
        </div>
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="password">
          Password
        </label>

        <div className={styles.inputWrapper}>
          <LockKeyhole
            className={styles.inputIcon}
            size={20}
            strokeWidth={1.8}
            aria-hidden="true"
          />

          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={`${styles.input} ${styles.passwordInput}`}
            placeholder="Enter your password"
            autoComplete="current-password"
            maxLength={1024}
            required
            disabled={isSubmitting}
          />

          <button
            type="button"
            className={styles.passwordToggle}
            onClick={() => setShowPassword((current) => !current)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            disabled={isSubmitting}
          >
            {showPassword ? (
              <EyeOff size={20} strokeWidth={1.8} />
            ) : (
              <Eye size={20} strokeWidth={1.8} />
            )}
          </button>
        </div>
      </div>

      <div className={styles.options}>
        <div className={styles.secureSession}>
          <span className={styles.sessionDot} />

          <span>Secure session</span>
        </div>

        <button
          className={styles.forgotPassword}
          type="button"
          disabled
          title="Password recovery is not available yet"
        >
          Forgot password?
        </button>
      </div>

      {errorMessage ? (
        <div className={styles.error} role="alert" aria-live="polite">
          {errorMessage}
        </div>
      ) : null}

      <button
        className={styles.submit}
        type="submit"
        disabled={isSubmitting || !email.trim() || !password}
      >
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </button>

      <div className={styles.workspaceInfo}>
        <div className={styles.infoIcon}>
          <Info size={16} strokeWidth={2} />
        </div>

        <p>Supported workspaces: Client Admin, Director, Manager, Prospector, Observer</p>
      </div>
    </form>
  );
}
