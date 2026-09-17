'use client';

import { LogOut, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import Sidebar from '@/components/sidebar/Sidebar';

import { useAuth } from './AuthProvider';

export default function ProtectedShell({ children }: { children: ReactNode }) {
  const router = useRouter();

  const {
    user,
    status,
    sessionError,
    availableWorkspaces,
    activeWorkspace,
    refreshSession,
    selectWorkspace,
    signOut,
  } = useAuth();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [router, status]);

  async function handleLogout() {
    await signOut();
    router.replace('/login');
    router.refresh();
  }

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <main className="session-screen">
        <div className="session-card">
          <RefreshCw className="session-spinner" size={28} />

          <p>Restoring your TrackRoster session…</p>
        </div>
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main className="session-screen">
        <div className="session-card">
          <h1>Connection problem</h1>

          <p>{sessionError ?? 'TrackRoster could not restore your session.'}</p>

          <button
            type="button"
            className="session-retry-button"
            onClick={() => void refreshSession()}
          >
            <RefreshCw size={17} />
            Try Again
          </button>
        </div>
      </main>
    );
  }

  if (status === 'authenticated' && availableWorkspaces.length === 0) {
    return (
      <main className="session-screen">
        <div className="session-card">
          <h1>Access Required</h1>

          <p>
            Your account is authenticated, but you do not currently have access to a TrackRoster
            workspace.
          </p>

          <button
            type="button"
            className="session-retry-button"
            onClick={() => void handleLogout()}
          >
            <LogOut size={17} />
            Log out
          </button>
        </div>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="trackroster-layout">
      <Sidebar
        user={user}
        availableWorkspaces={availableWorkspaces}
        activeWorkspace={activeWorkspace}
        onSelectWorkspace={selectWorkspace}
        onLogout={handleLogout}
      />

      <div className="trackroster-content">{children}</div>
    </div>
  );
}
