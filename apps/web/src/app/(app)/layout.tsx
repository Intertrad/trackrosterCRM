import type { ReactNode } from 'react';

import { ProtectedShell } from '@/components/layout/protected-shell';

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  return <ProtectedShell>{children}</ProtectedShell>;
}
