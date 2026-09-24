import type { Metadata } from 'next';
import Link from 'next/link';
import { Lock } from 'lucide-react';

import { AuthShell } from '@/components/auth/auth-shell';
import { LoginForm } from '@/components/auth/login-form';
import { Alert } from '@/components/ui/alert';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to your TrackRoster workspace.',
};

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const { reset } = await searchParams;

  return (
    <AuthShell>
      {reset === 'success' ? (
        <Alert tone="success" className="mb-6" title="Password updated">
          Sign in with your new password. Other sessions were signed out.
        </Alert>
      ) : null}

      <header className="mb-8">
        <h2 className="text-[38px] leading-[1.1] font-bold tracking-[-0.03em] text-navy">
          Welcome back
        </h2>

        <p className="mt-2 text-[16px] text-ink-soft">Sign in to your TrackRoster workspace</p>
      </header>

      <LoginForm />

      <div className="mt-8 border-t border-line-soft pt-5">
        <div className="flex items-center justify-center gap-3 text-[14px] font-semibold text-brand">
          <Link href="/invite" className="hover:text-brand-hover">
            Accept an invitation
          </Link>

          <span aria-hidden="true" className="text-line">
            |
          </span>

          <a href="mailto:support@trackroster.app" className="hover:text-brand-hover">
            Get support
          </a>
        </div>

        <p className="mt-4 flex items-center justify-center gap-2 text-[13px] text-ink-muted">
          <Lock aria-hidden="true" className="size-4" />
          Protected by encrypted sessions and optional MFA.
        </p>
      </div>
    </AuthShell>
  );
}
