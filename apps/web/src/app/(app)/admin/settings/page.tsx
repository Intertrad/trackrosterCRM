'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AdminGuard } from '@/components/admin/admin-guard';
import { Tabs } from '@/components/ui/tabs';
import { WorkspaceModulePage } from '@/components/workspace/workspace-module';
import { WORKSPACE_MODULES } from '@/lib/workspace/modules';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { text } from '@/lib/workspace/copy';
const sections = [
  ['reservation-rules', 'Contact reservations', 'Réservations de contact'],
  ['objectives', 'Objectives', 'Objectifs'],
  ['workspace-settings', 'Workspace', 'Espace de travail'],
];
export default function Page() {
  return (
    <AdminGuard title="Règles et réglages">
      <Suspense>
        <Settings />
      </Suspense>
    </AdminGuard>
  );
}
function Settings() {
  const { language } = useTranslation();
  const id = useSearchParams().get('section') ?? 'reservation-rules';
  const section = sections.find((s) => s[0] === id) ?? sections[0]!;
  const definition = WORKSPACE_MODULES.find((m) => m.id === section[0])!;
  return (
    <div className="space-y-5">
      <WorkspaceModulePage
        backLink={false}
        headerAddon={
          <Tabs
            label={text('Settings sections', 'Sections des réglages', language)}
            activeId={section[0]!}
            items={sections.map(([key, en, fr]) => ({
              id: key!,
              label: text(en!, fr!, language),
              href: `/admin/settings?section=${key}`,
            }))}
          />
        }
        key={definition.id}
        module={{
          ...definition,
          title: { en: 'Rules and settings', fr: 'Règles et réglages' },
          description: {
            en:
              'Configure ' +
              section[1]!.toLowerCase() +
              '. Changes apply to your authorized scope.',
            fr:
              'Configurez ' +
              section[2]!.toLowerCase() +
              '. Les modifications s’appliquent à votre périmètre autorisé.',
          },
        }}
      />
    </div>
  );
}
