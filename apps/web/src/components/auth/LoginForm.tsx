'use client';

import { useState, type SubmitEvent } from 'react';
import { AtSign, Eye, EyeOff, Lock, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const router = useRouter();

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    setError('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          setError('Invalid email or password.');
        } else {
          setError('Unable to sign in right now. Please try again.');
        }

        return;
      }

      router.replace('/');
      router.refresh();
    } catch {
      setError('Unable to connect to TrackRoster. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <h1 className="auth-title">Login</h1>

      <p className="auth-subtitle">Enter your work email to access your TrackRoster workspace.</p>

      <label className="auth-label" htmlFor="email">
        Work email
      </label>

      <div className="auth-field">
        <span className="auth-field-icon" aria-hidden="true">
          <AtSign size={18} />
        </span>

        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          placeholder="firstname.lastname@trackroster.fr"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setError('');
          }}
          required
        />
      </div>

      <label className="auth-label" htmlFor="password">
        Password
      </label>

      <div className="auth-field">
        <span className="auth-field-icon" aria-hidden="true">
          <Lock size={18} />
        </span>

        <input
          id="password"
          name="password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setError('');
          }}
          required
        />

        <button
          type="button"
          className="auth-field-toggle"
          onClick={() => setShowPassword((current) => !current)}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>

      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}

      <button type="submit" className="auth-button" disabled={isSubmitting}>
        {isSubmitting ? 'Signing in…' : 'Log in'}
      </button>

      <div className="auth-banner">
        <ShieldCheck size={18} />
        <span>Secure access to your TrackRoster workspace</span>
      </div>
    </form>
  );
}
