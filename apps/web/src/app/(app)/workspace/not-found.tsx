'use client';

import Link from 'next/link';
import { PageHeader } from '@/components/ui/page-header';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { text } from '@/lib/workspace/copy';

export default function ToolNotFound() {
  const { language } = useTranslation();
  return (
    <div className="space-y-6">
      <PageHeader
        title={text('Tool not found', 'Outil introuvable', language)}
        subtitle={text(
          'This address does not match a workspace tool.',
          'Cette adresse ne correspond à aucun outil de l’espace.',
          language,
        )}
      />
      <Link className="font-semibold text-brand" href="/workspace">
        {text('Browse workspace tools', 'Parcourir les outils', language)}
      </Link>
    </div>
  );
}
