'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Building2, ChevronDown, LogOut, Settings } from 'lucide-react';

import { browserJson } from '@/lib/api/browser-json';
import { clearChallenges } from '@/lib/auth/auth-challenge';
import { useAuth } from '@/lib/auth/auth-context';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { cn } from '@/lib/ui/cn';
import { getInitials } from '@/lib/ui/initials';

/*
 * The account menu on the sidebar avatar. Sign out lives here because the
 * chip is the only persistent account affordance on desktop — it previously
 * navigated straight to /profile, leaving no way out of the app.
 */
export function ProfileMenu({
  displayName,
  email,
  roleLabel,
  collapsed,
  placement = 'up',
}: {
  displayName: string | null;
  email: string;
  roleLabel: string;
  collapsed: boolean;

  /* The sidebar chip sits at the bottom, the mobile bar at the top. */
  placement?: 'up' | 'down';
}) {
  const router = useRouter();
  const { refreshSession } = useAuth();
  const { t } = useTranslation();

  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  /* Close on outside click and on Escape, like any other menu. */
  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: MouseEvent): void {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  async function signOut(): Promise<void> {
    setSigningOut(true);

    try {
      await browserJson<void>('/api/auth/logout', { method: 'POST' });
    } catch {
      /*
       * The server may already have revoked the session. Clearing locally
       * still matters, so the failure is not surfaced as an error.
       */
    }

    /* Any half-finished login challenge must not survive a sign-out. */
    clearChallenges();

    await refreshSession();

    router.replace('/login');
    router.refresh();
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
        className={cn(
          'flex w-full items-center gap-3 rounded-lg p-2 transition-colors hover:bg-white/8',
          collapsed && 'justify-center',
          open && 'bg-white/8',
        )}
      >
        <span
          aria-hidden="true"
          className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-white/14 text-[13px] font-bold text-white"
        >
          {getInitials(displayName, email)}

          <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-navy bg-lime" />
        </span>

        {!collapsed ? (
          <>
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-[14px] font-semibold text-white">
                {displayName ?? email}
              </span>

              <span className="block truncate text-[12px] text-ink-onDark-soft">{roleLabel}</span>
            </span>

            <ChevronDown
              aria-hidden="true"
              className={cn(
                'size-4 shrink-0 text-white/70 transition-transform',
                open && 'rotate-180',
              )}
            />
          </>
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Account"
          className={cn(
            'absolute z-50 overflow-hidden rounded-xl border border-line-soft bg-surface shadow-overlay',
            placement === 'up' ? 'bottom-full mb-2' : 'top-full mt-2',
            collapsed ? 'right-0 w-60' : 'inset-x-0',
          )}
        >
          <div className="border-b border-line-soft px-4 py-3">
            <p className="truncate text-[14px] font-semibold text-navy">{displayName ?? email}</p>

            <p className="truncate text-[13px] text-ink-muted">{email}</p>
          </div>

          <Link
            role="menuitem"
            href="/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-2.5 text-[14px] font-semibold text-ink transition-colors hover:bg-surface-muted"
          >
            <Settings aria-hidden="true" className="size-[18px] text-ink-muted" />
            {t('account.settings')}
          </Link>

          <Link
            role="menuitem"
            href="/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-2.5 text-[14px] font-semibold text-ink transition-colors hover:bg-surface-muted"
          >
            <Building2 aria-hidden="true" className="size-[18px] text-ink-muted" />
            {t('account.switchWorkspace')}
          </Link>

          <button
            role="menuitem"
            type="button"
            onClick={() => void signOut()}
            disabled={signingOut}
            className="flex w-full items-center gap-3 border-t border-line-soft px-4 py-2.5 text-left text-[14px] font-semibold text-danger transition-colors hover:bg-danger-bg disabled:opacity-60"
          >
            <LogOut aria-hidden="true" className="size-[18px]" />
            {signingOut ? t('account.signingOut') : t('account.signOut')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
