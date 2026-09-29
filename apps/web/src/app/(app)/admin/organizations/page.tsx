'use client';
import { useCallback, useState } from 'react';
import { Plus, ArrowUpRight } from 'lucide-react';
import { AdminGuard } from '@/components/admin/admin-guard';
import { ActionEditor } from '@/components/workspace/action-editor';
import { Alert } from '@/components/ui/alert';
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
const tones: Record<string, string> = {
  gftij: 'border-l-navy',
  intertrad: 'border-l-brand',
  ofti: 'border-l-company-teal',
  sdi: 'border-l-company-purple',
  aftij: 'border-l-company-orange',
};
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
            className={`border-l-[3px] ${tones[String(r.slug).toLowerCase()] ?? 'border-l-brand'}`}
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-extrabold">
                {String(r.name)}{' '}
                <span className="text-xs font-semibold text-ink-muted">
                  ({String(r.slug ?? '')})
                </span>
              </h2>
              <span className="rounded-full bg-success-bg px-2.5 py-1 text-xs font-bold text-success">
                {r.status === 'active' ? l('Active', 'Active') : l('Inactive', 'Inactive')}
              </span>
            </div>
            <dl className="grid gap-4 sm:grid-cols-3">
              {[
                [l('Name', 'Nom'), r.name],
                [l('Identifier', 'Identifiant'), r.slug],
                [
                  l('Status', 'État'),
                  r.status === 'active' ? l('Active', 'Active') : l('Inactive', 'Inactive'),
                ],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <dt className="mb-1.5 text-[13px] font-bold">{String(label)}</dt>
                  <dd className="rounded-[9px] border border-line px-3 py-2 text-sm">
                    {String(value ?? '—')}
                  </dd>
                </div>
              ))}
            </dl>
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
