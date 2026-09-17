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

import type { AuthenticatedUser, AuthStatus } from '@/lib/auth-types';

interface AuthContextValue {
  user: AuthenticatedUser | null;
  status: AuthStatus;
  sessionError: string | null;
  refreshSession: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function isAuthenticatedUser(value: unknown): value is AuthenticatedUser {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const user = value as Record<string, unknown>;

  return typeof user.userId === 'string' && typeof user.tenantId === 'string';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);

  const [status, setStatus] = useState<AuthStatus>('loading');

  const [sessionError, setSessionError] = useState<string | null>(null);

  const refreshSession = useCallback(async () => {
    setStatus('loading');
    setSessionError(null);

    try {
      const response = await fetch('/api/auth/me', {
        method: 'GET',
        cache: 'no-store',
      });

      if (response.status === 401) {
        setUser(null);
        setStatus('unauthenticated');
        return;
      }

      if (!response.ok) {
        setUser(null);
        setStatus('error');
        setSessionError('Unable to restore your TrackRoster session.');
        return;
      }

      const data: unknown = await response.json();

      if (!isAuthenticatedUser(data)) {
        setUser(null);
        setStatus('error');
        setSessionError('TrackRoster returned an invalid session response.');
        return;
      }

      setUser(data);
      setStatus('authenticated');
    } catch {
      setUser(null);
      setStatus('error');
      setSessionError('Unable to connect to TrackRoster.');
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
      });
    } finally {
      setUser(null);
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
      status,
      sessionError,
      refreshSession,
      signOut,
    }),
    [user, status, sessionError, refreshSession, signOut],
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
