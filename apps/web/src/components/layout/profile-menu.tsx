'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Building2, ChevronDown, Loader2, LogOut, Settings } from 'lucide-react';

import { getAccountMemberships, switchActiveMembership } from '@/lib/api/account-client';
import type { AccountMembership } from '@/lib/api/account-types';
import { ApiError } from '@/lib/api/api-error';
import { browserJson } from '@/lib/api/browser-json';
import { challengeRoute, clearChallenges, storeChallenge } from '@/lib/auth/auth-challenge';
import { useAuth } from '@/lib/auth/auth-context';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { cn } from '@/lib/ui/cn';
import { getInitials } from '@/lib/ui/initials';

/*
 * The persistent account avatar. Sign out lives here so every workspace has a
 * consistent account affordance without adding another sidebar icon.
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

  /* Desktop and mobile headers place the menu below the avatar. */
  placement?: 'up' | 'down';
}) {
  const router = useRouter();
  const { refreshSession } = useAuth();
  const { t } = useTranslation();

  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [workspacePickerOpen, setWorkspacePickerOpen] = useState(false);
  const [memberships, setMemberships] = useState<AccountMembership[] | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

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

  useEffect(() => {
    if (open || !workspacePickerOpen) {
      return;
    }

    setWorkspacePickerOpen(false);
    setWorkspaceError(null);
  }, [open, workspacePickerOpen]);

  useEffect(() => {
    if (!open || !workspacePickerOpen || memberships) {
      return;
    }

    const controller = new AbortController();
    setWorkspaceLoading(true);
    setWorkspaceError(null);

    getAccountMemberships(controller.signal)
      .then(setMemberships)
      .catch((error) => {
        if (!controller.signal.aborted) {
          setWorkspaceError(
            error instanceof ApiError && error.statusCode === 401
              ? t('common.sessionExpired')
              : t('common.loadWorkspacesError'),
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setWorkspaceLoading(false);
        }
      });

    return () => controller.abort();
  }, [memberships, open, workspacePickerOpen]);

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

  async function switchWorkspace(membership: AccountMembership): Promise<void> {
    if (membership.current || switchingId) {
      return;
    }

    setSwitchingId(membership.membershipId);
    setWorkspaceError(null);

    try {
      const outcome = await switchActiveMembership(membership.membershipId);

      if (outcome.next !== 'authenticated') {
        storeChallenge(outcome);
        router.replace(challengeRoute(outcome));

        return;
      }

      await refreshSession();
      setOpen(false);
      setWorkspacePickerOpen(false);
      router.refresh();
    } catch (error) {
      setWorkspaceError(
        error instanceof ApiError && error.statusCode === 401
          ? t('common.sessionExpired')
          : t('common.switchWorkspaceError'),
      );
    } finally {
      setSwitchingId(null);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t('common.accountMenu')}
        className={cn(
          'flex w-full items-center gap-3 rounded-lg p-2 transition-colors hover:bg-white/8',
          collapsed && 'justify-center',
          open && 'bg-white/8',
        )}
      >
        <span
          aria-hidden="true"
          className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-[13px] font-bold text-brand"
        >
          {getInitials(displayName, email)}

          <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-navy bg-lime" />
        </span>

        {!collapsed ? (
          <>
            <span className="min-w-0 flex-1 text-left">
              <span className="block text-[14px] leading-tight font-bold text-white">
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
          aria-label={t('common.account')}
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

          {workspacePickerOpen ? (
            <div className="border-b border-line-soft">
              <button
                type="button"
                role="menuitem"
                onClick={() => setWorkspacePickerOpen(false)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[14px] font-semibold text-ink transition-colors hover:bg-surface-muted"
              >
                <Building2 aria-hidden="true" className="size-[18px] text-ink-muted" />
                {t('account.switchWorkspace')}
              </button>

              {workspaceError ? (
                <p role="alert" className="px-4 pb-2 text-[12px] text-danger">
                  {workspaceError}
                </p>
              ) : null}

              {workspaceLoading ? (
                <div className="flex items-center gap-2 px-4 pb-3 text-[13px] text-ink-muted">
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                  {t('common.loadingWorkspaces')}
                </div>
              ) : memberships && memberships.length > 0 ? (
                <ul
                  className="max-h-56 overflow-y-auto px-2 pb-2"
                  aria-label={t('common.availableWorkspaces')}
                >
                  {memberships.map((membership) => (
                    <li key={membership.membershipId}>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => void switchWorkspace(membership)}
                        disabled={membership.current || switchingId !== null}
                        className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-muted disabled:cursor-default disabled:opacity-60"
                      >
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-brand-tint">
                          {switchingId === membership.membershipId ? (
                            <Loader2
                              aria-hidden="true"
                              className="size-4 animate-spin text-brand"
                            />
                          ) : (
                            <Building2 aria-hidden="true" className="size-4 text-brand" />
                          )}
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold text-navy">
                            {membership.tenantName}
                          </span>
                          {membership.roles.length > 0 ? (
                            <span className="block truncate text-[11px] text-ink-muted">
                              {membership.roles.join(', ')}
                            </span>
                          ) : null}
                        </span>

                        {membership.current ? (
                          <span className="shrink-0 text-[11px] font-semibold text-success">
                            {t('common.current')}
                          </span>
                        ) : (
                          <span className="shrink-0 text-[11px] font-semibold text-brand">
                            {t('common.open')}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : memberships ? (
                <p className="px-4 pb-3 text-[12px] text-ink-muted">
                  {t('common.noActiveWorkspaces')}
                </p>
              ) : null}
            </div>
          ) : (
            <button
              type="button"
              role="menuitem"
              onClick={() => setWorkspacePickerOpen(true)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[14px] font-semibold text-ink transition-colors hover:bg-surface-muted"
            >
              <Building2 aria-hidden="true" className="size-[18px] text-ink-muted" />
              {t('account.switchWorkspace')}
            </button>
          )}

          <Link
            role="menuitem"
            href="/workspace"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-2.5 text-[14px] font-semibold text-ink hover:bg-surface-muted"
          >
            <Settings aria-hidden="true" className="size-[18px] text-ink-muted" />
            {t('nav.workspaceTools')}
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
