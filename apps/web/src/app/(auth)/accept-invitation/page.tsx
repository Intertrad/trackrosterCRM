import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth/auth-shell';
import { InvitationAcceptanceForm } from '@/components/auth/invitation-acceptance-form';

export const metadata: Metadata = {
  title: 'Accept your invitation',
  description: 'Join your TrackRoster workspace securely.',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function AcceptInvitationPage() {
  return (
    <AuthShell>
      <InvitationAcceptanceForm />
    </AuthShell>
  );
}
