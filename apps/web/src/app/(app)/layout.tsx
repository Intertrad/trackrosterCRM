import type { ReactNode } from 'react';

import { AuthProvider } from '@/components/auth/AuthProvider';
import ProtectedShell from '@/components/auth/ProtectedShell';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ProtectedShell>{children}</ProtectedShell>
    </AuthProvider>
  );
}
