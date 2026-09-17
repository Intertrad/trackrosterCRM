'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  ACCESS_SCOPES,
  USER_ROLES,
  type AccessGrant,
  type AuthenticatedUser,
  type AuthStatus,
  type SelfAccessResponse,
  type WorkspaceOption,
} from '@/lib/auth-types';

import { deriveAvailableWorkspaces, getWorkspacePreferenceKey } from '@/lib/workspaces';

interface AuthContextValue {
  user: AuthenticatedUser | null;
  grants: AccessGrant[];

  availableWorkspaces: WorkspaceOption[];
  activeWorkspace: WorkspaceOption | null;

  status: AuthStatus;
  sessionError: string | null;

  refreshSession: () => Promise<void>;
  selectWorkspace: (workspaceKey: string) => void;

  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function isAccessGrant(value: unknown): value is AccessGrant {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const grant = value as Record<string, unknown>;

  const hasValidRole = USER_ROLES.some((role) => role === grant.role);

  const hasValidScope = ACCESS_SCOPES.some((scope) => scope === grant.scopeType);

  return (
    hasValidRole &&
    hasValidScope &&
    (grant.organizationId === null || typeof grant.organizationId === 'string') &&
    (grant.teamId === null || typeof grant.teamId === 'string')
  );
}

function isSelfAccessResponse(value: unknown): value is SelfAccessResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const data = value as Record<string, unknown>;

  return (
    typeof data.userId === 'string' &&
    typeof data.tenantId === 'string' &&
    Array.isArray(data.grants) &&
    data.grants.every(isAccessGrant)
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);

  const [grants, setGrants] = useState<AccessGrant[]>([]);

  const [availableWorkspaces, setAvailableWorkspaces] = useState<WorkspaceOption[]>([]);

  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceOption | null>(null);

  const [status, setStatus] = useState<AuthStatus>('loading');

  const [sessionError, setSessionError] = useState<string | null>(null);

  const refreshSession = useCallback(async () => {
    setStatus('loading');
    setSessionError(null);

    try {
      const response = await fetch('/api/auth/me/access-grants', {
        method: 'GET',
        cache: 'no-store',
      });

      if (response.status === 401) {
        setUser(null);
        setGrants([]);
        setAvailableWorkspaces([]);
        setActiveWorkspace(null);
        setStatus('unauthenticated');

        return;
      }

      if (!response.ok) {
        setUser(null);
        setGrants([]);
        setAvailableWorkspaces([]);
        setActiveWorkspace(null);

        setStatus('error');

        setSessionError('Unable to restore your TrackRoster session.');

        return;
      }

      const data: unknown = await response.json();

      if (!isSelfAccessResponse(data)) {
        setUser(null);
        setGrants([]);
        setAvailableWorkspaces([]);
        setActiveWorkspace(null);

        setStatus('error');

        setSessionError('TrackRoster returned an invalid session response.');

        return;
      }

      const nextUser: AuthenticatedUser = {
        userId: data.userId,
        tenantId: data.tenantId,
      };

      const workspaces = deriveAvailableWorkspaces(data.grants);

      let nextActiveWorkspace = workspaces[0] ?? null;

      const preferenceKey = getWorkspacePreferenceKey(nextUser.userId, nextUser.tenantId);

      const storedWorkspaceKey = window.localStorage.getItem(preferenceKey);

      if (storedWorkspaceKey) {
        const storedWorkspace = workspaces.find(
          (workspace) => workspace.key === storedWorkspaceKey,
        );

        if (storedWorkspace) {
          nextActiveWorkspace = storedWorkspace;
        } else {
          window.localStorage.removeItem(preferenceKey);
        }
      }

      setUser(nextUser);
      setGrants(data.grants);
      setAvailableWorkspaces(workspaces);
      setActiveWorkspace(nextActiveWorkspace);

      setStatus('authenticated');
    } catch {
      setUser(null);
      setGrants([]);
      setAvailableWorkspaces([]);
      setActiveWorkspace(null);

      setStatus('error');

      setSessionError('Unable to connect to TrackRoster.');
    }
  }, []);

  const selectWorkspace = useCallback(
    (workspaceKey: string) => {
      if (!user) {
        return;
      }

      const workspace = availableWorkspaces.find((candidate) => candidate.key === workspaceKey);

      if (!workspace) {
        return;
      }

      setActiveWorkspace(workspace);

      const preferenceKey = getWorkspacePreferenceKey(user.userId, user.tenantId);

      window.localStorage.setItem(preferenceKey, workspace.key);
    },
    [availableWorkspaces, user],
  );

  const signOut = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
      });
    } finally {
      setUser(null);
      setGrants([]);
      setAvailableWorkspaces([]);
      setActiveWorkspace(null);
      setStatus('unauthenticated');
      setSessionError(null);
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      grants,
      availableWorkspaces,
      activeWorkspace,
      status,
      sessionError,
      refreshSession,
      selectWorkspace,
      signOut,
    }),
    [
      user,
      grants,
      availableWorkspaces,
      activeWorkspace,
      status,
      sessionError,
      refreshSession,
      selectWorkspace,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}
