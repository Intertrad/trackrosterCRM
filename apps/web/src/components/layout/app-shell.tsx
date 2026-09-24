'use client';

import { type ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, MoreHorizontal, Settings, X } from 'lucide-react';

import { NavIcon } from '@/components/layout/nav-icon';
import { NotificationBell } from '@/components/layout/notification-bell';
import { ProfileMenu } from '@/components/layout/profile-menu';
import { Alert } from '@/components/ui/alert';
import { BrandLockup, BrandMark } from '@/components/ui/brand-mark';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth/auth-context';
import {
  getNavigationForWorkspace,
  isNavigationItemActive,
  type WorkspaceNavigationItem,
} from '@/lib/auth/navigation';
import { getWorkspaceModeLabel } from '@/lib/auth/workspace';
import { cn } from '@/lib/ui/cn';

const COLLAPSE_STORAGE_KEY = 'trackroster.sidebar.collapsed';

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const { user, activeWorkspace, status, sessionError, refreshSession } = useAuth();

  const [collapsed, setCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  /* Per-viewer convenience only; never a source of truth for access. */
  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === 'true');
    } catch {
      /* Private browsing can refuse storage; the default stays expanded. */
    }
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [router, status]);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  function toggleCollapsed(): void {
    setCollapsed((current) => {
      const next = !current;

      try {
        window.localStorage.setItem(COLLAPSE_STORAGE_KEY, String(next));
      } catch {
        /* Ignore storage failures. */
      }

      return next;
    });
  }

  if (status === 'loading') {
    return <ShellSkeleton />;
  }

  if (status === 'error') {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-canvas px-6">
        <div className="w-full max-w-md">
          <Alert tone="danger" title="We could not restore your session.">
            {sessionError ?? 'Check your connection and try again.'}
          </Alert>

          <Button fullWidth className="mt-5" onClick={() => void refreshSession()}>
            Try again
          </Button>
        </div>
      </main>
    );
  }

  if (status === 'unauthenticated' || !user) {
    return <ShellSkeleton />;
  }

  const mode = activeWorkspace?.mode ?? 'prospector';
  const items = getNavigationForWorkspace(mode);
  const primaryItems = items.filter((item) => item.primary).slice(0, 4);
  const overflowItems = items.filter((item) => !primaryItems.includes(item));

  return (
    <div className="flex min-h-dvh flex-col bg-canvas lg:flex-row">
      {/* Mobile top bar — the sidebar is replaced by a bottom bar below lg. */}
      <header className="flex items-center justify-between gap-3 bg-navy px-4 py-3 lg:hidden">
        <BrandLockup className="[&_span:last-child]:text-[18px]" />

        <div className="flex items-center gap-2">
          <NotificationBell />

          <ProfileMenu
            displayName={user.displayName}
            email={user.email}
            roleLabel={getWorkspaceModeLabel(mode)}
            collapsed
            placement="down"
          />
        </div>
      </header>

      <aside
        className={cn(
          'relative hidden shrink-0 flex-col bg-navy transition-[width] duration-200 lg:flex',
          collapsed ? 'w-[76px]' : 'w-[214px]',
        )}
      >
        <div className={cn('px-4 py-5', collapsed && 'px-0 text-center')}>
          {collapsed ? (
            <BrandMark className="mx-auto" />
          ) : (
            <BrandLockup className="[&_span:last-child]:text-[19px]" />
          )}
        </div>

        <nav aria-label="Workspace" className="flex-1 overflow-y-auto px-3 py-6">
          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <li key={item.id}>
                <SidebarItem item={item} pathname={pathname} collapsed={collapsed} />
              </li>
            ))}
          </ul>
        </nav>

        <div className={cn('border-t border-white/10 p-3', collapsed && 'px-2')}>
          {!collapsed ? (
            <div className="mb-1 flex justify-end">
              <NotificationBell />
            </div>
          ) : null}

          <ProfileMenu
            displayName={user.displayName}
            email={user.email}
            roleLabel={getWorkspaceModeLabel(mode)}
            collapsed={collapsed}
          />
        </div>

        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          className={cn(
            'absolute top-1/2 -right-3 flex h-10 w-6 -translate-y-1/2 items-center justify-center',
            'rounded-md border border-line-soft bg-surface text-ink-muted shadow-card',
            'transition-colors hover:text-ink',
          )}
        >
          {collapsed ? (
            <ChevronRight aria-hidden="true" className="size-4" />
          ) : (
            <ChevronLeft aria-hidden="true" className="size-4" />
          )}
        </button>
      </aside>

      <main className="min-w-0 flex-1 px-4 pt-6 pb-24 sm:px-6 lg:px-8 lg:pb-10">{children}</main>

      <MobileNav
        primaryItems={primaryItems}
        overflowItems={overflowItems}
        pathname={pathname}
        moreOpen={moreOpen}
        onToggleMore={() => setMoreOpen((open) => !open)}
      />
    </div>
  );
}

function SidebarItem({
  item,
  pathname,
  collapsed,
}: {
  item: WorkspaceNavigationItem;
  pathname: string;
  collapsed: boolean;
}) {
  const active = isNavigationItemActive(pathname, item);

  const shared = cn(
    'flex items-center gap-3.5 rounded-xl px-3.5 py-3 text-[15px]',
    'transition-colors duration-150',
    collapsed && 'justify-center px-0',
  );

  if (item.availability === 'planned' || !item.href) {
    return (
      <span
        aria-disabled="true"
        title={`${item.label} is not available yet`}
        className={cn(shared, 'cursor-not-allowed font-semibold text-white/35')}
      >
        <NavIcon id={item.icon} className="size-5 shrink-0" />

        {!collapsed ? <span className="truncate">{item.label}</span> : null}
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        shared,
        active
          ? 'bg-navy-700 font-bold text-white'
          : 'font-semibold text-white/72 hover:bg-white/8 hover:text-white',
      )}
    >
      {/* Lime on the current screen is the one accent in the sidebar, so the
          position is readable at a glance without reading a label. */}
      <NavIcon id={item.icon} className={cn('size-5 shrink-0', active && 'text-lime')} />

      {!collapsed ? <span className="truncate">{item.label}</span> : null}
    </Link>
  );
}

function MobileNav({
  primaryItems,
  overflowItems,
  pathname,
  moreOpen,
  onToggleMore,
}: {
  primaryItems: WorkspaceNavigationItem[];
  overflowItems: WorkspaceNavigationItem[];
  pathname: string;
  moreOpen: boolean;
  onToggleMore: () => void;
}) {
  return (
    <>
      {moreOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={onToggleMore}
            className="absolute inset-0 bg-navy/45"
          />

          <div
            className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-surface p-5 shadow-overlay"
            style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[17px] font-bold text-navy">More</h2>

              <button
                type="button"
                onClick={onToggleMore}
                aria-label="Close menu"
                className="text-ink-muted hover:text-ink"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>

            <ul className="flex flex-col gap-1">
              {overflowItems.map((item) => (
                <li key={item.id}>
                  <MobileMoreItem item={item} />
                </li>
              ))}

              <li>
                <Link
                  href="/profile"
                  className="flex items-center gap-3 rounded-lg px-3 py-3 text-[15px] font-semibold text-ink hover:bg-surface-muted"
                >
                  <Settings aria-hidden="true" className="size-5 text-ink-muted" />
                  Account settings
                </Link>
              </li>
            </ul>
          </div>
        </div>
      ) : null}

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line-soft bg-surface lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {primaryItems.map((item) => {
          const active = isNavigationItemActive(pathname, item);
          const disabled = item.availability === 'planned' || !item.href;

          const content = (
            <>
              <NavIcon id={item.icon} className="size-[22px]" />

              <span className="truncate text-[11px] font-semibold">{item.label}</span>
            </>
          );

          const shared =
            'flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 px-1 py-2';

          return disabled ? (
            <span key={item.id} aria-disabled="true" className={cn(shared, 'text-ink-muted/45')}>
              {content}
            </span>
          ) : (
            <Link
              key={item.id}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(shared, active ? 'text-brand' : 'text-ink-muted')}
            >
              {content}
            </Link>
          );
        })}

        <button
          type="button"
          onClick={onToggleMore}
          aria-expanded={moreOpen}
          className="flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-ink-muted"
        >
          <MoreHorizontal aria-hidden="true" className="size-[22px]" />

          <span className="text-[11px] font-semibold">More</span>
        </button>
      </nav>
    </>
  );
}

function MobileMoreItem({ item }: { item: WorkspaceNavigationItem }) {
  const shared = 'flex items-center gap-3 rounded-lg px-3 py-3 text-[15px] font-semibold';

  if (item.availability === 'planned' || !item.href) {
    return (
      <span aria-disabled="true" className={cn(shared, 'text-ink-muted/55')}>
        <NavIcon id={item.icon} className="size-5" />
        {item.label}
      </span>
    );
  }

  return (
    <Link href={item.href} className={cn(shared, 'text-ink hover:bg-surface-muted')}>
      <NavIcon id={item.icon} className="size-5 text-ink-muted" />
      {item.label}
    </Link>
  );
}

function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh bg-canvas" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading your workspace…</span>

      <div className="hidden w-[214px] shrink-0 bg-navy lg:block" />

      <div className="min-w-0 flex-1 animate-pulse px-6 py-8">
        <div className="h-9 w-56 rounded bg-line-soft" />
        <div className="mt-3 h-5 w-80 rounded bg-line-soft" />

        <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="h-96 rounded-xl bg-line-soft" />
          <div className="h-96 rounded-xl bg-line-soft" />
        </div>
      </div>
    </div>
  );
}
