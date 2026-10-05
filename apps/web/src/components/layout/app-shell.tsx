'use client';
import { LiveStatus } from './live-status';

import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  MoreHorizontal,
  Search,
  Settings,
  X,
} from 'lucide-react';

import { NavIcon } from '@/components/layout/nav-icon';
import { NotificationBell } from '@/components/layout/notification-bell';
import { ProfileMenu } from '@/components/layout/profile-menu';
import { Alert } from '@/components/ui/alert';
import { BrandLockup, BrandMark } from '@/components/ui/brand-mark';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth/auth-context';
import { getUnreadMessageCount } from '@/lib/api/messaging-client';
import {
  getNavigationForWorkspace,
  getPlatformNavigation,
  getRoleHome,
  isRouteAllowedForWorkspace,
  isNavigationItemActive,
  type WorkspaceNavigationItem,
} from '@/lib/auth/navigation';
import { getWorkspaceModeLabelKey } from '@/lib/auth/workspace';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { cn } from '@/lib/ui/cn';

const COLLAPSE_STORAGE_KEY = 'trackroster.sidebar.collapsed';

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const { user, activeWorkspace, status, sessionError, refreshSession } = useAuth();
  const { t } = useTranslation();

  const [collapsed, setCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [mobileQuery, setMobileQuery] = useState('');
  const [unreadMessages, setUnreadMessages] = useState(0);

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
    const home = getRoleHome(activeWorkspace?.mode, user?.platformAdmin);
    if (status === 'authenticated' && pathname === '/' && home !== '/') router.replace(home);
  }, [status, activeWorkspace?.mode, user?.platformAdmin, pathname, router]);

  const routeAllowed = isRouteAllowedForWorkspace(
    pathname,
    activeWorkspace?.mode,
    user?.platformAdmin,
  );

  useEffect(() => {
    if (status !== 'authenticated' || !user || routeAllowed) return;

    router.replace(getRoleHome(activeWorkspace?.mode, user.platformAdmin));
  }, [activeWorkspace?.mode, routeAllowed, router, status, user]);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (status !== 'authenticated') return;

    const controller = new AbortController();
    const refresh = () => {
      void getUnreadMessageCount(controller.signal)
        .then((result) => {
          if (!controller.signal.aborted) setUnreadMessages(result.count);
        })
        .catch(() => undefined);
    };

    refresh();
    window.addEventListener('trackroster:messages-read', refresh);
    const timer = window.setInterval(refresh, 15_000);
    return () => {
      controller.abort();
      window.removeEventListener('trackroster:messages-read', refresh);
      window.clearInterval(timer);
    };
  }, [status]);

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

  function submitMobileSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const value = mobileQuery.trim();
    if (!value) return;
    router.push(`/search?q=${encodeURIComponent(value)}`);
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

  if (!routeAllowed) {
    return <ShellSkeleton />;
  }

  const mode = activeWorkspace?.mode ?? 'prospector';
  const platformView =
    user.platformAdmin === true && (!activeWorkspace || pathname.startsWith('/platform'));
  const items = platformView ? getPlatformNavigation() : getNavigationForWorkspace(mode);
  if (!platformView && user.platformAdmin)
    items.push({
      id: 'platform',
      label: 'nav.platform',
      icon: 'administration',
      href: '/platform/overview',
      availability: 'ready',
      group: 'tools',
    });
  const roleLabel = platformView ? t('role.platform') : t(getWorkspaceModeLabelKey(mode));
  const isProspector = mode === 'prospector' && !platformView;
  const sidebarItems = items.filter((item) => item.group !== 'tools');
  const toolItems = items.filter((item) => item.group === 'tools');
  const toolActive = toolItems.some((item) => isNavigationItemActive(pathname, item));
  const primaryItems = items.filter((item) => item.primary).slice(0, 4);
  const overflowItems = items.filter((item) => !primaryItems.includes(item));

  return (
    <div className="flex min-h-dvh flex-col bg-canvas lg:flex-row">
      {/* Mobile top bar — the sidebar is replaced by a bottom bar below lg. */}
      <header className="flex flex-wrap items-center gap-3 bg-navy px-4 py-3 lg:hidden">
        <div className="flex w-full items-center justify-between gap-3">
          <BrandLockup className="[&_span:last-child]:text-[18px]" />

          <div className="flex items-center gap-2">
            <NotificationBell />

            <ProfileMenu
              displayName={user.displayName}
              email={user.email}
              roleLabel={roleLabel}
              collapsed
              placement="down"
            />
          </div>
        </div>

        <form onSubmit={submitMobileSearch} role="search" className="relative w-full">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted"
          />
          <input
            aria-label={isProspector ? 'Search my assigned prospects' : 'Search workspace'}
            value={mobileQuery}
            onChange={(event) => setMobileQuery(event.target.value)}
            placeholder={isProspector ? 'Search my assigned prospects…' : 'Search workspace…'}
            className="h-10 w-full rounded-lg border border-white/15 bg-white px-9 text-[14px] text-ink outline-none placeholder:text-ink-muted focus:border-brand"
          />
        </form>
      </header>

      <aside
        className={cn(
          'sticky top-0 hidden h-dvh shrink-0 flex-col bg-navy transition-[width] duration-200 lg:flex',
          collapsed ? 'w-[76px]' : 'w-[220px]',
        )}
      >
        <div className={cn('px-[14px] pt-6 pb-7 text-center', collapsed && 'px-0 text-center')}>
          {collapsed ? (
            <BrandMark className="mx-auto" />
          ) : (
            <BrandLockup className="[&_span:last-child]:text-[19px]" />
          )}
        </div>

        {!collapsed ? (
          <WorkspaceScopeCard activeWorkspace={activeWorkspace} isProspector={isProspector} />
        ) : null}

        <nav
          aria-label={t('nav.workspace')}
          className={cn(
            'reference-sidebar-nav flex min-h-0 flex-1 flex-col overflow-y-auto px-[14px] py-1',
            isProspector && 'pt-2',
          )}
        >
          <ul className="flex flex-col gap-0.5">
            {sidebarItems.map((item, index) => (
              <li key={item.id}>
                {!collapsed && item.group && item.group !== sidebarItems[index - 1]?.group && (
                  <p className="px-3 pt-2 pb-0.5 text-[11px] font-semibold text-ink-onDark-soft">
                    {t(
                      item.group === 'configuration'
                        ? 'nav.configuration'
                        : item.group === 'operate'
                          ? 'nav.operate'
                          : item.group === 'control'
                            ? 'nav.control'
                            : 'nav.tools',
                    )}
                  </p>
                )}
                <SidebarItem
                  item={item}
                  pathname={pathname}
                  collapsed={collapsed}
                  unreadCount={item.id === 'messages' ? unreadMessages : 0}
                />
              </li>
            ))}
          </ul>
        </nav>

        {toolItems.length > 0 && (
          <details open={toolActive} className="relative mx-3 mb-2">
            <summary
              aria-label={t('nav.tools')}
              className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold text-ink-onDark-soft hover:bg-white/8"
            >
              <Settings className="size-4 shrink-0" />
              {!collapsed && t('nav.tools')}
            </summary>
            <nav
              aria-label={t('nav.tools')}
              className="absolute bottom-full left-0 z-40 mb-1 w-60 rounded-xl border border-white/15 bg-navy p-2 shadow-overlay"
            >
              <ul className="space-y-1">
                {toolItems.map((item) => (
                  <li key={item.id}>
                    <SidebarItem item={item} pathname={pathname} collapsed={false} />
                  </li>
                ))}
              </ul>
            </nav>
          </details>
        )}
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={t(collapsed ? 'nav.expand' : 'nav.collapse')}
          aria-expanded={!collapsed}
          className={cn(
            'absolute top-[30%] -right-6 z-10 flex h-[34px] w-6 items-center justify-center',
            'rounded-r-lg border border-white/20 bg-navy text-white',
            'transition-colors hover:bg-navy-800',
          )}
        >
          {collapsed ? (
            <ChevronRight aria-hidden="true" className="size-4" />
          ) : (
            <ChevronLeft aria-hidden="true" className="size-4" />
          )}
        </button>
      </aside>

      <main className="min-w-0 flex-1 bg-canvas">
        <WorkspaceTopbar
          isProspector={isProspector}
          roleLabel={roleLabel}
          displayName={user.displayName}
          email={user.email}
        />

        <div className="reference-main min-w-0">
          <LiveStatus />
          {children}
        </div>
      </main>

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

function WorkspaceScopeCard({
  activeWorkspace,
  isProspector,
}: {
  activeWorkspace: { organizationId: string | null; teamId: string | null } | null;
  isProspector: boolean;
}) {
  return (
    <div className="px-3 pb-4">
      <div className="rounded-xl border border-white/12 bg-white/6 px-3 py-3">
        <p className="truncate text-[12px] font-bold text-white">
          {isProspector ? 'Assigned workspace' : 'Current workspace'}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-ink-onDark-soft">
          {activeWorkspace?.organizationId ? 'Organization scope' : 'Workspace scope'}
          {activeWorkspace?.teamId ? ' · Team' : ''}
        </p>
      </div>
    </div>
  );
}

function WorkspaceTopbar({
  isProspector,
  roleLabel,
  displayName,
  email,
}: {
  isProspector: boolean;
  roleLabel: string;
  displayName: string | null;
  email: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    router.push(`/search?q=${encodeURIComponent(value)}`);
  }

  return (
    <header className="hidden h-[58px] items-center gap-4 border-b border-line-soft bg-surface px-6 lg:flex">
      <form onSubmit={submit} role="search" className="relative w-full max-w-[320px]">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted"
        />
        <input
          aria-label={isProspector ? 'Search my assigned prospects' : 'Search workspace'}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={isProspector ? 'Search my assigned prospects…' : 'Search workspace…'}
          className="h-9 w-full rounded-lg border border-line-soft bg-canvas px-9 text-[13px] text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-brand focus:bg-surface"
        />
      </form>

      <div className="ml-auto flex items-center gap-1.5">
        <span className="rounded-full border border-brand-tint bg-brand-wash px-3 py-1 text-[10px] font-extrabold tracking-[0.12em] text-brand">
          {roleLabel.toUpperCase()}
        </span>
        <NotificationBell tone="dark" />
        <Link
          href="/workspace"
          aria-label="Help and workspace tools"
          className="flex size-9 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-muted hover:text-navy"
        >
          <CircleHelp aria-hidden="true" className="size-[17px]" />
        </Link>
        <ProfileMenu
          displayName={displayName}
          email={email}
          roleLabel={roleLabel}
          collapsed
          placement="down"
        />
      </div>
    </header>
  );
}

function SidebarItem({
  item,
  pathname,
  collapsed,
  unreadCount = 0,
}: {
  item: WorkspaceNavigationItem;
  pathname: string;
  collapsed: boolean;
  unreadCount?: number;
}) {
  const { t } = useTranslation();

  const active = isNavigationItemActive(pathname, item);

  const shared = cn(
    'flex min-h-8 items-center gap-3 rounded-[10px] px-3 py-[7px] text-[14.4px] leading-[1.2]',
    'transition-colors duration-150',
    collapsed && 'justify-center px-0',
  );

  if (item.availability === 'planned' || !item.href) {
    return (
      <span
        aria-disabled="true"
        title={t('nav.unavailable', { label: t(item.label) })}
        className={cn(shared, 'cursor-not-allowed font-semibold text-white/35')}
      >
        <NavIcon id={item.icon} className="size-5 shrink-0" />

        {!collapsed ? <span className="truncate">{t(item.label)}</span> : null}
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
          ? 'bg-brand font-bold text-white'
          : 'font-semibold text-white/72 hover:bg-white/8 hover:text-white',
      )}
    >
      {/* Lime on the current screen is the one accent in the sidebar, so the
          position is readable at a glance without reading a label. */}
      <NavIcon
        id={item.icon}
        className={cn('size-4 shrink-0', active ? 'text-lime' : 'text-brand-pale')}
      />

      {!collapsed ? (
        <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
          <span className="truncate">{t(item.label)}</span>
          {unreadCount > 0 ? (
            <span
              aria-label={`${unreadCount} unread messages`}
              className="flex size-6 shrink-0 items-center justify-center rounded-full bg-lime text-[12px] font-bold leading-none text-navy"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : null}
        </span>
      ) : null}
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
  const { t } = useTranslation();

  return (
    <>
      {moreOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label={t('common.close')}
            onClick={onToggleMore}
            className="absolute inset-0 bg-navy/45"
          />

          <div
            className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-surface p-5 shadow-overlay"
            style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[17px] font-bold text-navy">{t('nav.more')}</h2>

              <button
                type="button"
                onClick={onToggleMore}
                aria-label={t('common.close')}
                className="text-ink-muted hover:text-ink"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>

            <ul className="my-auto flex flex-col gap-0.5">
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
                  {t('account.settings')}
                </Link>
              </li>
            </ul>
          </div>
        </div>
      ) : null}

      <nav
        aria-label={t('nav.primary')}
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line-soft bg-surface lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {primaryItems.map((item) => {
          const active = isNavigationItemActive(pathname, item);
          const disabled = item.availability === 'planned' || !item.href;

          const content = (
            <>
              <NavIcon id={item.icon} className="size-[22px]" />

              <span className="truncate text-[11px] font-semibold">{t(item.label)}</span>
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
              className={cn(
                shared,
                active ? 'rounded-xl bg-brand-tint text-brand' : 'text-ink-muted',
              )}
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

          <span className="text-[11px] font-semibold">{t('nav.more')}</span>
        </button>
      </nav>
    </>
  );
}

function MobileMoreItem({ item }: { item: WorkspaceNavigationItem }) {
  const { t } = useTranslation();

  const shared = 'flex items-center gap-3 rounded-lg px-3 py-3 text-[15px] font-semibold';

  if (item.availability === 'planned' || !item.href) {
    return (
      <span aria-disabled="true" className={cn(shared, 'text-ink-muted/55')}>
        <NavIcon id={item.icon} className="size-5" />
        {t(item.label)}
      </span>
    );
  }

  return (
    <Link href={item.href} className={cn(shared, 'text-ink hover:bg-surface-muted')}>
      <NavIcon id={item.icon} className="size-5 text-ink-muted" />
      {t(item.label)}
    </Link>
  );
}

function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh bg-canvas" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading your workspace…</span>

      <div className="hidden w-[220px] shrink-0 bg-navy lg:block" />

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
