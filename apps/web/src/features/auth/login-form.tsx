'use client';

import { Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

function extractMessage(payload: unknown): string {
  if (typeof payload === 'object' && payload !== null && 'message' in payload) {
    const message = (payload as { message?: unknown }).message;

    if (typeof message === 'string') {
      return message;
    }

    if (Array.isArray(message)) {
      return message.filter((item) => typeof item === 'string').join('. ');
    }
  }

  return 'Unable to sign in. Please check your credentials.';
}

export function LoginForm() {
  const router = useRouter();

  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (submitting) {
      return;
    }

    const form = new FormData(event.currentTarget);

    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      if (!response.ok) {
        let payload: unknown = null;

        try {
          payload = await response.json();
        } catch {
          // Keep the generic message.
        }

        setError(extractMessage(payload));
        return;
      }

      router.replace('/');
      router.refresh();
    } catch {
      setError('TrackRoster could not reach the authentication service. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-danger/20 bg-danger-background px-4 py-3 text-sm leading-5 text-danger"
        >
          {error}
        </div>
      ) : null}

      <div>
        <label htmlFor="email" className="mb-2 block text-sm font-medium text-foreground">
          Email address
        </label>

        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={320}
          disabled={submitting}
          className="h-11 w-full rounded-lg border border-border bg-surface px-3.5 text-sm text-foreground outline-none transition placeholder:text-text-muted focus:border-primary focus:ring-3 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
          placeholder="you@company.com"
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-2 block text-sm font-medium text-foreground">
          Password
        </label>

        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            maxLength={1024}
            disabled={submitting}
            className="h-11 w-full rounded-lg border border-border bg-surface px-3.5 pr-11 text-sm text-foreground outline-none transition placeholder:text-text-muted focus:border-primary focus:ring-3 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
            placeholder="Enter your password"
          />

          <button
            type="button"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
            onClick={() => setShowPassword((value) => !value)}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-text-muted transition hover:text-foreground"
          >
            {showPassword ? (
              <EyeOff aria-hidden="true" className="size-4.5" />
            ) : (
              <Eye aria-hidden="true" className="size-4.5" />
            )}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary-hover active:bg-primary-active disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? (
          <>
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            Signing in...
          </>
        ) : (
          'Sign in'
        )}
      </button>
    </form>
  );
}
