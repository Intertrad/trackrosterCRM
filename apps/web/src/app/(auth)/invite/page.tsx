import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, MailOpen } from 'lucide-react';

import { AuthShell } from '@/components/auth/auth-shell';
import { Alert } from '@/components/ui/alert';

export const metadata: Metadata = {
  title: 'Accept an invitation',
  description: 'Open your TrackRoster invitation from the email you received.',
};

/*
 * An invitation is only actionable with its single-use token, so the
 * token-less entry point explains where to find the link rather than
 * asking the person to paste a credential into a form.
 */
export default function InvitePage() {
  return (
    <AuthShell>
      <Link
        href="/login"
        className="inline-flex items-center gap-2 text-[15px] font-semibold text-brand hover:text-brand-hover"
      >
        <ArrowLeft aria-hidden="true" className="size-[18px]" />
        Back to sign in
      </Link>

      <header className="mt-6 mb-6">
        <h2 className="text-[34px] leading-[1.1] font-bold tracking-[-0.03em] text-navy">
          Accept an invitation
        </h2>

        <p className="mt-2 text-[16px] text-ink-soft">
          Invitations are opened from the secure link in your email.
        </p>
      </header>

      <div className="flex items-start gap-4 rounded-xl border border-line bg-surface-muted p-5">
        <MailOpen aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-brand" />

        <div className="text-[15px] text-ink-soft">
          <p className="font-semibold text-navy">Check your inbox</p>

          <p className="mt-1">
            Look for an email from TrackRoster and open{' '}
            <strong className="font-semibold text-ink">Join your workspace</strong>. The link
            confirms the workspace and role you were invited to.
          </p>
        </div>
      </div>

      <Alert tone="info" className="mt-5">
        Invitation links expire. If yours no longer works, ask your administrator to resend it.
      </Alert>
    </AuthShell>
  );
}
