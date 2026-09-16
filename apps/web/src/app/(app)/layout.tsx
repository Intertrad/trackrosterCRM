import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { AppShell } from '@/components/layout/app-shell';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '@/lib/auth/session-cookies';

type AppLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default async function AppLayout({ children }: AppLayoutProps) {
  const cookieStore = await cookies();

  const hasAccessToken = cookieStore.has(ACCESS_TOKEN_COOKIE);
  const hasRefreshToken = cookieStore.has(REFRESH_TOKEN_COOKIE);

  if (!hasAccessToken && !hasRefreshToken) {
    redirect('/login');
  }

  return <AppShell>{children}</AppShell>;
}
