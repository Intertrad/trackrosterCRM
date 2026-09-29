import type { Metadata } from 'next';

import { AuthShell } from '@/components/auth/auth-shell';
import { WorkspaceSelector } from '@/components/auth/workspace-selector';

export const metadata: Metadata = {
  title: 'Choose a workspace',
  description: 'Select the workspace you want to sign in to.',

  robots: { index: false, follow: false },
};

export default function SelectWorkspacePage() {
  return (
    <AuthShell>
      <WorkspaceSelector />
    </AuthShell>
  );
}
