import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { WorkspaceModulePage } from '@/components/workspace/workspace-module';
import { WORKSPACE_MODULES } from '@/lib/workspace/modules';

export default async function WorkspacePage({ params }: { params: Promise<{ module: string }> }) {
  const { module: id } = await params;
  const definition = WORKSPACE_MODULES.find((entry) => entry.id === id);
  if (!definition) notFound();
  return (
    <Suspense>
      <WorkspaceModulePage module={definition} />
    </Suspense>
  );
}
