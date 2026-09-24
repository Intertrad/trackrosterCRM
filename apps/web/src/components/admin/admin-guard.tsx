'use client';

import type { ReactNode } from 'react';

import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { useAuth } from '@/lib/auth/auth-context';

/**
 * Every administration endpoint is guarded upstream by ClientAdminGuard, which
 * requires a tenant-scoped `client_admin` grant. Rendering the screen for any
 * other workspace would produce a page of 403s, so the workspace mode is
 * checked first and the reason is stated plainly.
 *
 * This is a usability guard, not a security boundary: authorization is always
 * decided by the API.
 */
export function AdminGuard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const { activeWorkspace } = useAuth();

  if (activeWorkspace && activeWorkspace.mode !== 'admin') {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={title} subtitle={subtitle} />

        <Alert tone="info" title="Administration is scoped to workspace administrators.">
          Your current workspace does not hold administrator access. Switch to an administrator
          workspace to manage this tenant.
        </Alert>
      </div>
    );
  }

  return <>{children}</>;
}
