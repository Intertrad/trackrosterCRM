import type { Metadata } from 'next';

import { AuthShell } from '@/components/auth/auth-shell';
import { MfaChallengeForm } from '@/components/auth/mfa-challenge-form';

export const metadata: Metadata = {
  title: 'Verify it’s you',
  description: 'Complete multi-factor authentication to finish signing in.',

  robots: { index: false, follow: false },
};

export default function MfaPage() {
  return (
    <AuthShell headline="territory">
      <MfaChallengeForm />
    </AuthShell>
  );
}
