import type { ReactNode } from 'react';
import { ShieldCheck } from 'lucide-react';
import { BrandLockup } from '@/components/ui/brand-mark';
export type AuthHeadline = 'prospect' | 'territory';
export function AuthShell({
  children,
  language = 'fr',
}: {
  children: ReactNode;
  headline?: AuthHeadline;
  language?: 'en' | 'fr';
}) {
  const fr = language === 'fr';
  return (
    <main className="reference-auth-layout">
      <aside className="reference-auth-sidebar">
        <BrandLockup />
        <p className="mt-8 text-center text-[14.4px] leading-[1.5] text-ink-onDark-soft">
          {fr
            ? 'Chaque prospect, au bon moment, par la bonne équipe.'
            : 'Every prospect, at the right time, by the right team.'}
        </p>
        <div className="mt-auto flex gap-3 border-t border-white/15 px-2.5 pt-[18px] text-[13px] text-ink-onDark-soft">
          <ShieldCheck className="size-5 shrink-0 text-lime" aria-hidden="true" />
          <div>
            <p className="mb-1 font-bold text-white">{fr ? 'Accès sécurisé' : 'Secure access'}</p>
            <p>{fr ? 'Accès selon votre rôle' : 'Access based on your role'}</p>
            <p>{fr ? 'Espace de travail protégé' : 'Protected workspace'}</p>
          </div>
        </div>
      </aside>
      <section className="reference-auth-page">
        <div className="reference-auth-form">{children}</div>
      </section>
    </main>
  );
}
export function AuthFooterNote({ children }: { children: ReactNode }) {
  return (
    <div className="mt-8 border-t border-line-soft pt-5 text-sm text-ink-muted">{children}</div>
  );
}
