'use client';

import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/sidebar/Sidebar';
import { useEffect, type ReactNode } from 'react';

import { useAuth } from './AuthProvider';

export default function ProtectedShell({ children }: { children: ReactNode }) {
  const router = useRouter();

  const { user, status, sessionError, refreshSession, signOut } = useAuth();

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

  return (
    <div className="trackroster-layout">
      <Sidebar user={user!} onLogout={handleLogout} />

      <div className="trackroster-content">{children}</div>
    </div>
  );
}
