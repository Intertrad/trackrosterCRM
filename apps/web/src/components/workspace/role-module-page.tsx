'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Tabs } from '@/components/ui/tabs';
import { WorkspaceModulePage } from './workspace-module';
import { WORKSPACE_MODULES } from '@/lib/workspace/modules';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { text } from '@/lib/workspace/copy';

export const AUDIT_SECTIONS = [
  ['audit-events', 'All events', 'Tous les événements'],
  ['audit-data-changes', 'Data changes', 'Modifications'],
  ['audit-security', 'Security', 'Sécurité'],
  ['audit-assignments', 'Assignments', 'Attributions'],
  ['audit-overrides', 'Exceptions', 'Dérogations'],
  ['audit-collisions', 'Collisions', 'Collisions'],
  ['audit-exports', 'Exports', 'Exports'],
  ['audit-retention', 'Retention', 'Conservation'],
] as const;

/** Dedicated role destinations reuse the same permission, editing and conflict owners. */
export function RoleModulePage({ moduleId }: { moduleId: string }) {
  return (
    <Suspense>
      <ModuleContent moduleId={moduleId} />
    </Suspense>
  );
}
function ModuleContent({ moduleId }: { moduleId: string }) {
  const { language } = useTranslation();
  const params = useSearchParams();
  const audit = moduleId === 'observer-audit';
  const selected = audit
    ? (AUDIT_SECTIONS.find((row) => row[0] === params.get('section'))?.[0] ?? 'audit-events')
    : moduleId;
  const definition = WORKSPACE_MODULES.find((module) => module.id === selected);
  if (!definition) return null;
  return (
    <WorkspaceModulePage
      key={selected}
      module={definition}
      backLink={false}
      headerAddon={
        audit ? (
          <Tabs
            label={text('Audit sections', 'Rubriques d’audit', language)}
            activeId={selected}
            items={AUDIT_SECTIONS.map(([id, en, fr]) => ({
              id,
              label: text(en, fr, language),
              href: `/observer/audit?section=${id}`,
            }))}
          />
        ) : undefined
      }
    />
  );
}
