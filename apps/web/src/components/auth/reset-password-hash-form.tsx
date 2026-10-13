'use client';

import { useEffect, useState } from 'react';
import { ResetPasswordForm } from './reset-password-form';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function readResetTokenFromHash(hash: string): string | null {
  const token = new URLSearchParams(hash.replace(/^#/, '')).get('token');
  return token && TOKEN_PATTERN.test(token) ? token : null;
}

export function ResetPasswordHashForm() {
  const [token, setToken] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setToken(readResetTokenFromHash(window.location.hash));
    setChecked(true);
  }, []);

  if (!checked) {
    return <div className="h-56 animate-pulse rounded-xl bg-line-soft" aria-busy="true" />;
  }

  if (!token) {
    return (
      <div>
        <header className="mb-6">
          <h2 className="text-[34px] leading-[1.1] font-bold tracking-[-0.03em] text-navy">
            This reset link is not valid
          </h2>
        </header>
        <Alert tone="warning" title="Open the latest password reset email.">
          The secure token is missing or malformed. Request a new reset link to continue.
        </Alert>
        <Link href="/forgot-password" className="mt-6 block">
          <Button fullWidth>Request a new link</Button>
        </Link>
      </div>
    );
  }

  return <ResetPasswordForm token={token} />;
}
