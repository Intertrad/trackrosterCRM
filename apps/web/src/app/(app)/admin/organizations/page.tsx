'use client';
import { useCallback, useState } from 'react';
import { Plus, ArrowUpRight } from 'lucide-react';
import { AdminGuard } from '@/components/admin/admin-guard';
import { ActionEditor } from '@/components/workspace/action-editor';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { useLivePages } from '@/lib/live/use-live-pages';
import { readOperation, rowsOf } from '@/lib/workspace/client';
import { text } from '@/lib/workspace/copy';
import { WORKSPACE_MODULES } from '@/lib/workspace/modules';
import type { DataRecord, Action } from '@/lib/workspace/types';
const definition = WORKSPACE_MODULES.find((m) => m.id === 'organizations')!;
export default function Page() {
  return (
    <AdminGuard title="Entreprises">
      <Companies />
    </AdminGuard>
  );
}
function Companies() {
  const { language } = useTranslation();
  const l = (en: string, fr: string) => text(en, fr, language);
  const [editError, setEditError] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editor, setEditor] = useState<{
    action: Action;
    record?: DataRecord;
    etag?: string | null;
  } | null>(null);
  const read = useCallback(async (cursor: string | undefined, signal: AbortSignal) => {
    const { resource } = await readOperation(definition.read, {}, { limit: 100, cursor }, signal);
    return {
      items: rowsOf(resource),
      nextCursor: (resource as { nextCursor?: string }).nextCursor ?? null,
    };
  }, []);
  const { rows, cursor, error, busy, load, loadMore } = useLivePages(read);
  async function edit(row: DataRecord) {
    setEditing(true);
    setEditError(false);
    try {
      const { resource, etag } = await readOperation(definition.detail!, {
        organizationId: row.id,
      });
      setEditor({ action: definition.actions[1]!, record: resource as DataRecord, etag });
    } catch {
      setEditError(true);
    } finally {
      setEditing(false);
    }
  }
  return (
    <div className="space-y-5">
      <PageHeader
        title={l('Companies', 'Entreprises')}
        subtitle={l(
          'The organizations that share your prospecting workspace.',
          'Les entreprises qui partagent votre espace de prospection.',
        )}
        action={
          <Button onClick={() => setEditor({ action: definition.actions[0]! })}>
            <Plus className="size-4" />
            {l('Add a company', 'Ajouter une entreprise')}
          </Button>
        }
      />
      {(error || editError) && (
        <Alert tone="danger">
          {l('Unable to load company data.', 'Impossible de charger les données de l’entreprise.')}{' '}
          <button className="underline" onClick={() => void load()}>
            {l('Retry', 'Réessayer')}
          </button>
        </Alert>
      )}
      <div className="space-y-4">
        {rows?.map((r) => (
          <Card
            key={String(r.id)}
            className="overflow-hidden border border-line bg-surface text-ink shadow-card"
            style={{ borderLeftColor: String(r.color ?? '#2F61E6'), borderLeftWidth: 4 }}
          >
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-line-soft pb-4">
              <h2 className="min-w-0 text-lg font-extrabold text-navy">
                {String(r.shortName ?? r.name)}{' '}
                <span className="text-xs font-semibold text-ink-muted">
                  {r.shortName ? `(${String(r.name)})` : `(${String(r.slug ?? '')})`}
                </span>
              </h2>
              <Badge tone={r.status === 'active' ? 'success' : 'neutral'} dot>
                {r.status === 'active' ? l('Active', 'Active') : l('Inactive', 'Inactive')}
              </Badge>
            </div>
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                [l('Short name', 'Nom court'), r.shortName ?? r.slug],
                [l('Full name', 'Nom complet'), r.name],
                [l('Color', 'Couleur'), r.color],
                [l('Phone', 'Téléphone'), r.phone],
                [l('Email', 'E-mail'), r.email],
                [l('Website', 'Site internet'), r.website],
                [l('Address', 'Adresse'), r.address],
                [l('Currency', 'Devise'), r.currency],
                [
                  l('Prospected sectors', 'Secteurs prospectés'),
                  Array.isArray(r.prospectedSectors) && r.prospectedSectors.length
                    ? r.prospectedSectors.join(', ')
                    : l('All sectors', 'Tous les secteurs'),
                ],
              ].map(([label, value]) => (
                <div key={String(label)} className="min-w-0">
                  <dt className="mb-1.5 text-[13px] font-bold text-ink-muted">{String(label)}</dt>
                  <dd className="min-h-10 truncate rounded-[9px] border border-line-soft bg-surface-muted px-3 py-2 text-sm font-medium text-ink">
                    {typeof value === 'string' && /^#[0-9A-F]{6}$/i.test(value) ? (
                      <span
                        aria-hidden="true"
                        className="mr-2 inline-block size-3 rounded-full align-[-1px] ring-1 ring-black/10"
                        style={{ backgroundColor: String(value) }}
                      />
                    ) : null}
                    {String(value ?? '—')}
                  </dd>
                </div>
              ))}
            </dl>
            {r.argumentaire ? (
              <div className="mt-4">
                <p className="mb-1.5 text-[13px] font-bold text-ink-muted">
                  {l('Company argumentaire', 'Argumentaire propre à l’entreprise')}
                </p>
                <p className="rounded-[9px] border border-line-soft bg-surface-muted px-3 py-2 text-sm whitespace-pre-wrap text-ink">
                  {String(r.argumentaire)}
                </p>
              </div>
            ) : null}
            <div className="mt-4 flex justify-end">
              <Button variant="primary" disabled={editing} onClick={() => void edit(r)}>
                {l('Edit company', 'Modifier l’entreprise')}
                <ArrowUpRight className="size-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
      {rows?.length === 0 && (
        <Card>
          <p className="py-8 text-center text-ink-muted">
            {l(
              'Add your first company to organize your teams.',
              'Ajoutez votre première entreprise pour organiser vos équipes.',
            )}
          </p>
        </Card>
      )}
      {rows === null && !error && (
        <div className="h-60 animate-pulse rounded-2xl bg-line-soft" aria-busy="true" />
      )}
      {cursor && (
        <Button variant="secondary" onClick={loadMore} disabled={busy}>
          {l('Load more companies', 'Charger les entreprises suivantes')}
        </Button>
      )}
      {editor && (
        <ActionEditor
          action={editor.action}
          context={editor.record ? { organizationId: editor.record.id } : {}}
          record={editor.record}
          etag={editor.etag}
          reloadKey={editor.record ? definition.detail : undefined}
          onClose={() => setEditor(null)}
          onSaved={() => {
            void load();
          }}
        />
      )}
    </div>
  );
}
