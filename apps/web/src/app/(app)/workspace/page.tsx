'use client';

import Link from 'next/link';
import { ArrowUpRight, Settings2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { useAuth } from '@/lib/auth/auth-context';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { WORKSPACE_MODULES } from '@/lib/workspace/modules';
import { copy, text } from '@/lib/workspace/copy';

export default function WorkspaceToolsPage() {
  const { activeWorkspace, user } = useAuth();
  const { language } = useTranslation();
  const modules = WORKSPACE_MODULES.filter(
    (module) =>
      (!!activeWorkspace && module.roles.includes(activeWorkspace.mode)) ||
      (module.roles.includes('platform') && user?.platformAdmin),
  );
  const sections = [...new Set(modules.map((module) => copy(module.section, language)))];
  return (
    <div className="space-y-9">
      <PageHeader
        title={text('Workspace tools', 'Outils de l’espace', language)}
        subtitle={text(
          'Your people, coverage, data and controls — connected to the workspace.',
          'Vos équipes, territoires, données et paramètres — connectés à votre espace.',
          language,
        )}
      />
      <div className="flex items-center gap-4 rounded-xl bg-navy p-5 text-white">
        <Settings2 className="size-6 shrink-0 text-lime" />
        <p className="text-sm leading-relaxed">
          {text(
            'Choose a tool to work with current data. Your permissions determine what you can view and change.',
            'Choisissez un outil pour accéder aux données actuelles. Vos autorisations déterminent ce que vous pouvez consulter et modifier.',
            language,
          )}
        </p>
      </div>
      {sections.map((section) => (
        <section key={section} className="space-y-4">
          <h2 className="text-lg font-bold text-navy">{section}</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {modules
              .filter((module) => copy(module.section, language) === section)
              .map((module) => (
                <Link
                  key={module.id}
                  href={`/workspace/${module.id}`}
                  className="group flex min-w-0 items-start justify-between gap-4 rounded-xl border border-line bg-surface p-5 shadow-card transition-colors hover:border-brand-pale hover:bg-brand-wash"
                >
                  <div>
                    <h3 className="font-semibold text-navy">{copy(module.title, language)}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                      {copy(module.description, language)}
                    </p>
                  </div>
                  <ArrowUpRight aria-hidden="true" className="size-5 shrink-0 text-brand" />
                </Link>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
