import type { Metadata } from 'next';

import { AuthShell } from '@/components/auth/auth-shell';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';

export const metadata: Metadata = {
  title: 'Create a new password',
  description: 'Choose a secure password for your TrackRoster account.',

  /* A reset link must never be indexed or leak through a referrer. */
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function ResetPasswordPage({ params }: PageProps<'/reset-password/[token]'>) {
  const { token } = await params;

  return (
    <AuthShell headline="territory">
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
