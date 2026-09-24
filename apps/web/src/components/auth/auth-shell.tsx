import type { ReactNode } from 'react';
import { BarChart3, FileText, ShieldCheck } from 'lucide-react';

import { BrandLockup } from '@/components/ui/brand-mark';

/*
 * One shared branded shell serves every authentication screen
 * (design spec §13). The user is routed from verified memberships
 * after sign-in and never chooses a privileged role on this form.
 */
const PROMISES = [
  {
    icon: ShieldCheck,
    title: 'Secure workspace',
    description: 'Your data is protected.',
  },
  {
    icon: BarChart3,
    title: 'Real-time coordination',
    description: 'Teams stay in sync.',
  },
  {
    icon: FileText,
    title: 'Audited activity',
    description: 'Full visibility and control.',
  },
] as const;

export type AuthHeadline = 'prospect' | 'territory';

const HEADLINES: Record<AuthHeadline, { lead: string[]; accent: string }> = {
  prospect: {
    lead: ['Every prospect,', 'at the right time,'],
    accent: 'by the right team.',
  },
  territory: {
    lead: ['Turn territories'],
    accent: 'into action.',
  },
};

export function AuthShell({
  children,
  headline = 'prospect',
}: {
  children: ReactNode;
  headline?: AuthHeadline;
}) {
  const { lead, accent } = HEADLINES[headline];

  return (
    <main className="flex min-h-dvh flex-col lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      {/*
       * Mobile is a compact brand bar, not a full-height panel: the dossier
       * is mobile-first and a phone user must reach the form without
       * scrolling past a screen of marketing. The full narrative panel
       * returns at lg, where it costs nothing.
       */}
      <aside className="relative flex flex-col justify-between overflow-hidden bg-navy px-6 py-5 sm:px-10 lg:px-14 lg:py-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_18%_8%,rgba(23,57,161,0.55),transparent_62%)]"
        />

        <div className="relative">
          <BrandLockup />
        </div>

        <div className="relative hidden lg:block">
          <h1 className="text-[34px] leading-[1.12] font-bold tracking-[-0.025em] text-white sm:text-[42px] lg:text-[46px]">
            {lead.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}

            <span className="block text-brand-mid">{accent}</span>
          </h1>

          <ul className="mt-14 flex flex-col gap-6">
            {PROMISES.map((promise) => (
              <li key={promise.title} className="flex items-start gap-4">
                <promise.icon
                  aria-hidden="true"
                  strokeWidth={1.6}
                  className="mt-0.5 size-7 shrink-0 text-brand-mid"
                />

                <div>
                  <p className="text-[16px] font-semibold text-white">{promise.title}</p>

                  <p className="text-[14px] text-ink-onDark-soft">{promise.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative mt-2 text-[14px] font-medium text-brand-mid lg:hidden">
          Multichannel prospecting coordination
        </p>

        <div className="relative hidden border-t border-white/12 pt-6 lg:block">
          <p className="text-[13px] text-ink-onDark-soft">
            TrackRoster · Multichannel prospecting coordination
          </p>
        </div>
      </aside>

      <section className="flex flex-1 items-center justify-center bg-surface px-6 py-10 sm:px-10 lg:px-16 lg:py-12">
        <div className="w-full max-w-[460px]">{children}</div>
      </section>
    </main>
  );
}

export function AuthFooterNote({ children }: { children: ReactNode }) {
  return (
    <div className="mt-8 border-t border-line-soft pt-5 text-[13px] text-ink-muted">{children}</div>
  );
}
