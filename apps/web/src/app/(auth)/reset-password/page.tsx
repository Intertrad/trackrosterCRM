import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth/auth-shell';
import { ResetPasswordHashForm } from '@/components/auth/reset-password-hash-form';

export const metadata: Metadata = {
  title: 'Create a new password',
  description: 'Choose a secure password for your TrackRoster account.',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function ResetPasswordHashPage() {
  return (
    <AuthShell headline="territory">
      <ResetPasswordHashForm />
    </AuthShell>
  );
}
