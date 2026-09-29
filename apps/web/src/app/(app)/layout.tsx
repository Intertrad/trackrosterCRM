import type { ReactNode } from 'react';

import { AppShell } from '@/components/layout/app-shell';

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  return <AppShell>{children}</AppShell>;
}
