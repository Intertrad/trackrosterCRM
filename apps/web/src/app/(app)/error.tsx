'use client';

import Link from 'next/link';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { text } from '@/lib/workspace/copy';

export default function WorkspaceError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { language } = useTranslation();
  return (
    <div className="space-y-6">
      <PageHeader
        title={text('This page could not load', 'Cette page n’a pas pu être chargée', language)}
      />
      <Alert tone="danger">
        {text(
          'Your last saved changes are safe. Retry loading the page.',
          'Vos dernières modifications enregistrées sont conservées. Réessayez de charger la page.',
          language,
        )}
      </Alert>
      <div className="flex flex-wrap items-center gap-4">
        <Button onClick={reset}>{text('Try again', 'Réessayer', language)}</Button>
        <Link href="/workspace" className="font-semibold text-brand">
          {text('Workspace tools', 'Outils de l’espace', language)}
        </Link>
      </div>
    </div>
  );
}
