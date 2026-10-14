'use client';

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePathname } from 'next/navigation';

import { ApiError } from '@/lib/api/api-error';
import type { SelfAccessContext, SelfAccessGrant } from '@/lib/api/auth-types';
import { browserJson } from '@/lib/api/browser-json';
import { deriveAvailableWorkspaces, type WorkspaceOption } from './workspace';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

interface AuthContextValue {
  user: SelfAccessContext | null;

  grants: SelfAccessGrant[];

  availableWorkspaces: WorkspaceOption[];

  activeWorkspace: WorkspaceOption | null;

  status: AuthStatus;

  sessionError: string | null;

  refreshSession: () => Promise<SelfAccessContext | null>;

  /** Apply account changes locally without waiting for a second session read. */
  updateUser: (patch: Partial<SelfAccessContext>) => void;

  selectWorkspace: (workspaceKey: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const EMPTY_GRANTS: SelfAccessGrant[] = [];

const WORKSPACE_STORAGE_PREFIX = 'trackroster.activeWorkspace';

/**
 * Public authentication screens do not need to restore an existing session.
 * Avoiding that request keeps an unauthenticated login flow quiet while the
 * explicit sign-in handler still calls refreshSession after authentication.
 */
function isPublicAuthRoute(pathname: string | null): boolean {
  return (
    pathname === '/login' ||
    pathname === '/forgot-password' ||
    pathname === '/invite' ||
    pathname === '/reset-password' ||
    pathname?.startsWith('/reset-password/') === true
  );
}

interface AuthProviderProps {
  children: ReactNode;
}

function getWorkspaceStorageKey(user: Pick<SelfAccessContext, 'userId' | 'tenantId'>): string {
  return [WORKSPACE_STORAGE_PREFIX, user.tenantId, user.userId].join(':');
}

export function AuthProvider({ children }: AuthProviderProps) {
  const pathname = usePathname();
  const [user, setUser] = useState<SelfAccessContext | null>(null);

  const [status, setStatus] = useState<AuthStatus>('loading');

  const [sessionError, setSessionError] = useState<string | null>(null);

  const [activeWorkspaceKey, setActiveWorkspaceKey] = useState<string | null>(null);

  const initialized = useRef(false);
  const wasPublicAuthRoute = useRef<boolean | null>(null);

  const refreshSession = useCallback(async (): Promise<SelfAccessContext | null> => {
    setStatus('loading');
    setSessionError(null);

    try {
      const currentUser = await browserJson<SelfAccessContext>('/api/auth/me/access-grants', {
        method: 'GET',
        cache: 'no-store',
      });

      setUser(currentUser);
      setStatus('authenticated');

      return currentUser;
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 401) {
        setUser(null);
        setActiveWorkspaceKey(null);
        setSessionError(null);
        setStatus('unauthenticated');

        return null;
      }

      /*
       * A network failure, 5xx response, or
       * unexpected BFF failure is different
       * from an authentication failure.
       *
       * Do not redirect the user to login.
       */
      setUser(null);
      setActiveWorkspaceKey(null);

      setSessionError(
        'TrackRoster could not restore your session. Check the connection and try again.',
      );

      setStatus('error');

      return null;
    }
  }, []);

  const updateUser = useCallback((patch: Partial<SelfAccessContext>): void => {
    setUser((current) => (current ? { ...current, ...patch } : current));
  }, []);

  useEffect(() => {
    const publicAuthRoute = isPublicAuthRoute(pathname);
    const enteredFromPublicAuthRoute = wasPublicAuthRoute.current === true;
    wasPublicAuthRoute.current = publicAuthRoute;

    if (publicAuthRoute) {
      if (!user) {
        setStatus((current) => (current === 'loading' ? 'unauthenticated' : current));
      }

      return;
    }

    /*
     * Auth screens intentionally skip the initial session request. If the
     * user later navigates to a protected route without signing in, restore
     * the session at that point. A successful sign-in already restored it,
     * so do not issue the same request a second time.
     */
    if (enteredFromPublicAuthRoute && user) {
      return;
    }

    if (initialized.current) {
      return;
    }

    initialized.current = true;
    void refreshSession();
  }, [pathname, refreshSession, user]);

  const grants = useMemo(() => user?.grants ?? EMPTY_GRANTS, [user]);

  const availableWorkspaces = useMemo(() => deriveAvailableWorkspaces(grants), [grants]);

  useEffect(() => {
    if (!user) {
      setActiveWorkspaceKey(null);

      return;
    }

    if (availableWorkspaces.length === 0) {
      setActiveWorkspaceKey(null);

      return;
    }

    const storageKey = getWorkspaceStorageKey(user);

    const storedWorkspaceKey = window.localStorage.getItem(storageKey);

    if (!storedWorkspaceKey) {
      setActiveWorkspaceKey(null);

      return;
    }

    const stillAuthorized = availableWorkspaces.some(
      (workspace) => workspace.key === storedWorkspaceKey,
    );

    if (stillAuthorized) {
      setActiveWorkspaceKey(storedWorkspaceKey);

      return;
    }

    window.localStorage.removeItem(storageKey);

    setActiveWorkspaceKey(null);
  }, [user, availableWorkspaces]);

  const activeWorkspace = useMemo(() => {
    if (activeWorkspaceKey) {
      const selected = availableWorkspaces.find(
        (workspace) => workspace.key === activeWorkspaceKey,
      );

      if (selected) {
        return selected;
      }
    }

    return availableWorkspaces[0] ?? null;
  }, [activeWorkspaceKey, availableWorkspaces]);

  const selectWorkspace = useCallback(
    (workspaceKey: string): boolean => {
      const selected = availableWorkspaces.find((workspace) => workspace.key === workspaceKey);

      if (!selected) {
        return false;
      }

      setActiveWorkspaceKey(selected.key);

      if (user) {
        window.localStorage.setItem(getWorkspaceStorageKey(user), selected.key);
      }

      return true;
    },
    [availableWorkspaces, user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      grants,
      availableWorkspaces,
      activeWorkspace,
      status,
      sessionError,
      refreshSession,
      updateUser,
      selectWorkspace,
    }),
    [
      user,
      grants,
      availableWorkspaces,
      activeWorkspace,
      status,
      sessionError,
      refreshSession,
      updateUser,
      selectWorkspace,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
