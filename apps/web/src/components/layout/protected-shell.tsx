'use client';

import {
  BarChart3,
  CalendarClock,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldAlert,
  ShieldCheck,
  Upload,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth/auth-context';
import {
  getNavigationForWorkspace,
  isNavigationItemActive,
  type NavigationItemId,
} from '@/lib/auth/navigation';
import {
  getWorkspaceModeLabel,
  getWorkspaceScopeLabel,
  type WorkspaceOption,
} from '@/lib/auth/workspace';

import styles from './protected-shell.module.css';

interface ProtectedShellProps {
  children: ReactNode;
}

function shortenId(value: string): string {
  if (value.length <= 16) {
    return value;
  }

  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function getWorkspaceOptionLabel(workspace: WorkspaceOption): string {
  const mode = getWorkspaceModeLabel(workspace.mode);

  if (workspace.scopeType === 'team' && workspace.teamId) {
    return `${mode} · Team ${shortenId(workspace.teamId)}`;
  }

  if (workspace.scopeType === 'organization' && workspace.organizationId) {
    return `${mode} · Organization ${shortenId(workspace.organizationId)}`;
  }

  return `${mode} · Tenant`;
}

function renderNavigationIcon(id: NavigationItemId) {
  switch (id) {
    case 'overview':
      return <LayoutDashboard size={19} strokeWidth={1.9} aria-hidden="true" />;

    case 'work_queue':
      return <ClipboardList size={19} strokeWidth={1.9} aria-hidden="true" />;

    case 'follow_ups':
      return <CalendarClock size={19} strokeWidth={1.9} aria-hidden="true" />;

    case 'dashboard':
      return <BarChart3 size={19} strokeWidth={1.9} aria-hidden="true" />;

    case 'imports':
      return <Upload size={19} strokeWidth={1.9} aria-hidden="true" />;

    case 'administration':
      return <Users size={19} strokeWidth={1.9} aria-hidden="true" />;

    case 'overrides':
      return <ShieldAlert size={19} strokeWidth={1.9} aria-hidden="true" />;
  }
}

export function ProtectedShell({ children }: ProtectedShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  const {
    user,
    status,
    sessionError,
    availableWorkspaces,
    activeWorkspace,
    refreshSession,
    selectWorkspace,
  } = useAuth();

  const [mobileOpen, setMobileOpen] = useState(false);

  const [loggingOut, setLoggingOut] = useState(false);

  const [logoutError, setLogoutError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [router, status]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  async function handleLogout(): Promise<void> {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);
    setLogoutError(null);

    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        cache: 'no-store',
      });

      if (!response.ok) {
        /*
         * The BFF may already have cleared the
         * cookies. Resolve the real session state
         * before deciding what the UI should do.
         */
        const currentUser = await refreshSession();

        if (!currentUser) {
          router.replace('/login');
          router.refresh();

          return;
        }

        throw new Error('Logout request failed');
      }

      await refreshSession();

      router.replace('/login');
      router.refresh();
    } catch {
      setLogoutError('We could not end your session. Please try again.');
    } finally {
      setLoggingOut(false);
    }
  }

  if (status === 'loading') {
    return (
      <main className={styles.sessionLoading}>
        <div className={styles.sessionLoadingContent} role="status" aria-live="polite">
          <div className={styles.spinner} />

          <p>Restoring your TrackRoster session…</p>
        </div>
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main className={styles.sessionErrorPage}>
        <section className={styles.sessionErrorCard} role="alert" aria-live="assertive">
          <div className={styles.sessionErrorIcon}>
            <ShieldAlert size={26} strokeWidth={1.8} aria-hidden="true" />
          </div>

          <p className={styles.sessionErrorEyebrow}>Connection problem</p>

          <h1>We couldn&apos;t restore your workspace.</h1>

          <p className={styles.sessionErrorMessage}>
            {sessionError ?? 'TrackRoster could not restore your session.'}
          </p>

          <button
            type="button"
            className={styles.sessionRetryButton}
            onClick={() => {
              void refreshSession();
            }}
          >
            Try again
          </button>
        </section>
      </main>
    );
  }

  if (status !== 'authenticated' || !user) {
    return <main className={styles.sessionRedirect} aria-hidden="true" />;
  }

  if (availableWorkspaces.length === 0) {
    return (
      <main className={styles.accessDeniedPage}>
        <section className={styles.accessDeniedCard} aria-labelledby="access-denied-title">
          <div className={styles.accessDeniedIcon}>
            <ShieldAlert size={26} strokeWidth={1.8} aria-hidden="true" />
          </div>

          <p className={styles.accessDeniedEyebrow}>Access required</p>

          <h1 id="access-denied-title">You don&apos;t have a TrackRoster workspace yet.</h1>

          <p className={styles.accessDeniedMessage}>
            Your account is authenticated, but no organization, team, or tenant access has been
            assigned. Contact a TrackRoster administrator if you believe you should have access.
          </p>

          <div className={styles.accessDeniedIdentity}>
            <span>User</span>

            <strong title={user.userId}>{shortenId(user.userId)}</strong>
          </div>

          <button
            type="button"
            className={styles.accessDeniedLogout}
            onClick={() => {
              void handleLogout();
            }}
            disabled={loggingOut}
          >
            <LogOut size={18} strokeWidth={1.9} aria-hidden="true" />

            <span>{loggingOut ? 'Signing out…' : 'Sign out'}</span>
          </button>

          {logoutError ? (
            <p className={styles.logoutError} role="alert">
              {logoutError}
            </p>
          ) : null}
        </section>
      </main>
    );
  }

  const navigationItems = activeWorkspace ? getNavigationForWorkspace(activeWorkspace.mode) : [];

  const sidebar = (
    <>
      <div className={styles.brand}>
        <div className={styles.brandMark} aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>

        <div>
          <p className={styles.brandName}>TrackRoster</p>

          <p className={styles.brandTagline}>Prospecting coordination</p>
        </div>
      </div>

      <div className={styles.navigationLabel}>Workspace</div>

      <nav className={styles.navigation} aria-label="Primary navigation">
        {navigationItems.map((item) => {
          const active = isNavigationItemActive(pathname, item);

          if (item.availability === 'planned') {
            return (
              <div
                key={item.id}
                className={`${styles.navigationLink} ${styles.navigationLinkPlanned}`}
                aria-disabled="true"
              >
                {renderNavigationIcon(item.id)}

                <span className={styles.navigationLinkLabel}>{item.label}</span>

                <span className={styles.soonBadge}>Soon</span>
              </div>
            );
          }

          return (
            <Link
              key={item.id}
              href={item.href}
              className={
                active
                  ? `${styles.navigationLink} ${styles.navigationLinkActive}`
                  : styles.navigationLink
              }
              aria-current={active ? 'page' : undefined}
            >
              {renderNavigationIcon(item.id)}

              <span className={styles.navigationLinkLabel}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className={styles.sidebarSpacer} />

      <section className={styles.workspaceCard} aria-label="Current workspace">
        <div className={styles.workspaceCardHeader}>
          <ShieldCheck size={18} strokeWidth={1.9} aria-hidden="true" />

          <span>
            {activeWorkspace ? getWorkspaceModeLabel(activeWorkspace.mode) : 'No workspace access'}
          </span>
        </div>

        {availableWorkspaces.length > 1 ? (
          <label className={styles.workspaceSwitcher}>
            <span className={styles.workspaceSwitcherLabel}>Active workspace</span>

            <select
              className={styles.workspaceSelect}
              value={activeWorkspace?.key ?? ''}
              onChange={(event) => {
                selectWorkspace(event.currentTarget.value);
              }}
            >
              {availableWorkspaces.map((workspace) => (
                <option key={workspace.key} value={workspace.key}>
                  {getWorkspaceOptionLabel(workspace)}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <dl className={styles.identityList}>
          {activeWorkspace ? (
            <div>
              <dt>Scope</dt>

              <dd>{getWorkspaceScopeLabel(activeWorkspace.scopeType)}</dd>
            </div>
          ) : null}

          <div>
            <dt>User</dt>

            <dd title={user.userId}>{shortenId(user.userId)}</dd>
          </div>

          <div>
            <dt>Tenant</dt>

            <dd title={user.tenantId}>{shortenId(user.tenantId)}</dd>
          </div>
        </dl>
      </section>

      {logoutError ? (
        <p className={styles.logoutError} role="alert">
          {logoutError}
        </p>
      ) : null}

      <button
        type="button"
        className={styles.logoutButton}
        onClick={() => {
          void handleLogout();
        }}
        disabled={loggingOut}
      >
        <LogOut size={18} strokeWidth={1.9} aria-hidden="true" />

        <span>{loggingOut ? 'Signing out…' : 'Sign out'}</span>
      </button>
    </>
  );

  return (
    <div className={styles.shell}>
      <aside className={styles.desktopSidebar}>{sidebar}</aside>

      {mobileOpen ? (
        <div className={styles.mobileLayer}>
          <button
            type="button"
            className={styles.mobileBackdrop}
            aria-label="Close navigation"
            onClick={() => {
              setMobileOpen(false);
            }}
          />

          <aside className={styles.mobileSidebar} aria-label="Mobile navigation">
            <div className={styles.mobileSidebarTop}>
              <span className={styles.mobileMenuTitle}>Navigation</span>

              <button
                type="button"
                className={styles.iconButton}
                aria-label="Close navigation"
                onClick={() => {
                  setMobileOpen(false);
                }}
              >
                <X size={21} aria-hidden="true" />
              </button>
            </div>

            {sidebar}
          </aside>
        </div>
      ) : null}

      <div className={styles.contentColumn}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <button
              type="button"
              className={`${styles.iconButton} ${styles.mobileMenuButton}`}
              aria-label="Open navigation"
              aria-expanded={mobileOpen}
              onClick={() => {
                setMobileOpen(true);
              }}
            >
              <Menu size={22} aria-hidden="true" />
            </button>

            <div>
              <p className={styles.topbarEyebrow}>TrackRoster workspace</p>

              <p className={styles.topbarTitle}>Prospecting operations</p>
            </div>
          </div>

          <div className={styles.topbarIdentity}>
            <span className={styles.statusDot} aria-hidden="true" />

            <div>
              <span className={styles.topbarIdentityLabel}>Signed in</span>

              <span className={styles.topbarIdentityValue} title={user.userId}>
                {shortenId(user.userId)}
              </span>
            </div>
          </div>
        </header>

        <main className={styles.mainContent}>{children}</main>
      </div>
    </div>
  );
}
