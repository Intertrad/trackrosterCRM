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
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editor, setEditor] = useState<{
    action: Action;
    record?: DataRecord;
    etag?: string | null;
  } | null>(null);
  const read = useCallback(
    async (cursor: string | undefined, signal: AbortSignal) => {
      const { resource } = await readOperation(
        definition.read,
        {},
        { limit: 100, cursor, status: showInactive ? 'inactive' : 'active' },
        signal,
      );
      return {
        items: rowsOf(resource),
        nextCursor: (resource as { nextCursor?: string }).nextCursor ?? null,
      };
    },
    [showInactive],
  );
  const { rows, cursor, error, busy, load, loadMore } = useLivePages(read);
  async function edit(row: DataRecord) {
    setEditing(true);
    setEditError(false);
    try {
      const { resource, etag } = await readOperation(definition.detail!, {
        organizationId: row.id,
      });
      setEditor({
        action: definition.actions[1]!,
        record: resource as DataRecord,
        etag,
      });
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
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={showInactive}
          onChange={(event) => setShowInactive(event.target.checked)}
        />
        {l('Show inactive companies', 'Afficher les entreprises inactives')}
      </label>
      <div className="space-y-4">
        {rows
          ?.filter((row) => row.status === (showInactive ? 'inactive' : 'active'))
          .map((r) => (
            <Card
              key={String(r.id)}
              className="border-l-[3px]"
              style={{
                borderLeft: `4px solid ${typeof r.color === 'string' && /^#[0-9a-f]{6}$/i.test(r.color) ? r.color : '#05124a'}`,
              }}
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-extrabold">
                  {String(r.name)}{' '}
                  <span className="text-xs font-semibold text-ink-muted">
                    ({String(r.slug ?? '')})
                  </span>
                </h2>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold ${r.status === 'active' ? 'bg-success-bg text-success' : 'bg-danger-bg text-danger'}`}
                >
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
              <div className="mt-4 flex flex-wrap justify-end gap-3">
                <Button variant="primary" disabled={editing} onClick={() => void edit(r)}>
                  {l('Edit company', 'Modifier l’entreprise')}
                  <ArrowUpRight className="size-4" />
                </Button>
              </div>
            </Card>
          ))}
      </div>
      {rows !== null &&
        rows.filter((row) => row.status === (showInactive ? 'inactive' : 'active')).length ===
          0 && (
          <Card>
            <p className="py-8 text-center text-ink-muted">
              {showInactive
                ? l('No inactive companies.', 'Aucune entreprise inactive.')
                : l('No active companies.', 'Aucune entreprise active.')}
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
          key={`${editor.action.operation}:${editor.record?.id ?? 'new'}`}
          onPermanentDelete={
            editor.action.operation === 'PATCH /organizations/:organizationId'
              ? () =>
                  setEditor({
                    ...editor,
                    action: {
                      operation: 'DELETE /organizations/:organizationId/permanent',
                      scope: 'record',
                      danger: true,
                      label: { en: 'Permanently delete', fr: 'Supprimer définitivement' },
                      description: {
                        en: 'This permanently deletes the company and cannot be undone. Unsaved edits will be discarded. Deletion is refused if other records still reference it.',
                        fr: 'Cette suppression est définitive et irréversible. Les modifications non enregistrées seront abandonnées. La suppression sera refusée si des données sont encore liées à cette entreprise.',
                      },
                    },
                  })
              : undefined
          }
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
