'use client';

import Link from 'next/link';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Drawer } from '@/components/ui/drawer';
import { PageHeader } from '@/components/ui/page-header';
import { ApiError } from '@/lib/api/api-error';
import { useAuth } from '@/lib/auth/auth-context';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { useLiveRefresh } from '@/lib/live/use-live-refresh';
import {
  isRecord,
  pathKeys,
  readOperation,
  recordName,
  rowsOf,
  valueAt,
  serializeFields,
} from '@/lib/workspace/client';
import { getOperation } from '@/lib/workspace/client';
import { copy, fieldLabel, text } from '@/lib/workspace/copy';
import type { Action, DataRecord, Field, WorkspaceModule as Module } from '@/lib/workspace/types';
import { validateFields } from '@/lib/workspace/validation';
import { ActionEditor } from './action-editor';
import { SchemaFields } from './schema-fields';
import { ValueView } from './record-view';

export function recordContext(
  module: Module,
  record: DataRecord | undefined,
  context: DataRecord,
): DataRecord {
  const result = { ...context, ...(record ?? {}) };
  // Parent path parameters remain the selected scope, even when a child also has an id.
  for (const key of pathKeys(getOperation(module.read).path)) {
    if (context[key]) result[key] = context[key];
  }
  if (record) {
    const id = record[module.idField ?? 'id'] ?? record.resourceId;
    if (module.idParam && !result[module.idParam] && id) result[module.idParam] = id;
  }
  return result;
}

export function WorkspaceModulePage({
  module,
  headerAddon,
  backLink = true,
}: {
  module: Module;
  headerAddon?: ReactNode;
  backLink?: boolean;
}) {
  const { language, locale } = useTranslation();
  const { activeWorkspace, user } = useAuth();
  const mode = activeWorkspace?.mode;
  const permitted =
    (!!mode && module.roles.includes(mode)) ||
    (module.roles.includes('platform') && user?.platformAdmin === true);
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const paramString = params.toString();
  const context: DataRecord = Object.fromEntries(params.entries());
  const read = getOperation(module.read);
  const pathFields: Field[] = pathKeys(read.path).map((name) => ({
    name,
    type: 'string',
    format: /Id$/.test(name) ? 'uuid' : undefined,
  }));
  const filters: Field[] = [
    ...pathFields,
    // Suggestions need campaign context for rule/roster pickers; it is not sent as an API query.
    ...(module.id === 'assignment-suggestions'
      ? [{ name: 'campaignId', type: 'string' as const, format: 'uuid' as const }]
      : []),
    ...read.query.filter((field) => !['cursor', 'limit'].includes(field.name)),
  ];
  const defaults = Object.fromEntries(
    filters.filter((f) => f.default !== undefined).map((f) => [f.name, f.default]),
  );
  const requestValues = { ...defaults, ...context };
  const ready =
    permitted &&
    filters
      .filter((field) => !field.optional && field.default === undefined)
      .every(
        (field) => requestValues[field.name] !== undefined && requestValues[field.name] !== '',
      );
  const [resource, setResource] = useState<unknown>();
  const [etag, setEtag] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterDraft, setFilterDraft] = useState<DataRecord>({});
  const [filterErrors, setFilterErrors] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<DataRecord | null>(null);
  const [selectedEtag, setSelectedEtag] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<Error | null>(null);
  const [related, setRelated] = useState<{ label: string; data?: unknown; error?: string } | null>(
    null,
  );
  const [editor, setEditor] = useState<{
    action: Action;
    record?: DataRecord;
    etag?: string | null;
  } | null>(null);
  const generation = useRef(0);
  const detailGeneration = useRef(0);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!ready) return;
      const turn = ++generation.current;
      try {
        const result = await readOperation(
          module.read,
          Object.fromEntries(new URLSearchParams(paramString)),
          { ...defaults, ...Object.fromEntries(new URLSearchParams(paramString)) },
          signal,
        );
        if (signal?.aborted || generation.current !== turn) return;
        setResource(result.resource);
        setEtag(result.etag);
        setError(null);
        setUpdatedAt(new Date());
      } catch (caught) {
        if (!signal?.aborted && generation.current === turn)
          setError(caught instanceof Error ? caught : new Error('Request failed'));
      }
      // Defaults and module contracts are static; paramString identifies the complete selection.
    },
    [module.id, module.read, paramString, ready],
  );
  useEffect(() => {
    const controller = new AbortController();
    setResource(undefined);
    setError(null);
    setSelected(null);
    setRelated(null);
    void load(controller.signal);
    return () => {
      controller.abort();
      generation.current++;
      detailGeneration.current++;
    };
  }, [load]);
  useLiveRefresh(
    async (signal) => {
      await load(signal);
      if (selected && !editor && module.detail && !signal.aborted) {
        const turn = ++detailGeneration.current;
        try {
          const latest = await readOperation(
            module.detail,
            recordContext(module, selected, context),
            {},
            signal,
          );
          if (!signal.aborted && turn === detailGeneration.current) {
            if (isRecord(latest.resource)) setSelected(latest.resource);
            setSelectedEtag(latest.etag);
            setDetailError(null);
          }
        } catch (caught) {
          if (!signal.aborted && turn === detailGeneration.current)
            setDetailError(caught instanceof Error ? caught : new Error('Request failed'));
        }
      }
    },
    { enabled: ready, scope: module.id + paramString },
  );
  const objectiveLocked =
    module.id === 'objectives' &&
    !!selected?.startsAt &&
    new Date(String(selected.startsAt)).getTime() <= Date.now();
  const canAct = (action: Action) =>
    (!!mode && (action.roles ?? module.roles).includes(mode)) ||
    (module.roles.includes('platform') && user?.platformAdmin === true);
  async function select(record: DataRecord) {
    const turn = ++detailGeneration.current;
    setSelected(record);
    setSelectedEtag(typeof record.etag === 'string' ? record.etag : null);
    setDetailError(null);
    setRelated(null);
    if (!module.detail) return;
    setDetailLoading(true);
    try {
      const result = await readOperation(module.detail, recordContext(module, record, context));
      if (turn !== detailGeneration.current) return;
      if (isRecord(result.resource)) setSelected(result.resource);
      setSelectedEtag(result.etag);
    } catch (caught) {
      if (turn === detailGeneration.current)
        setDetailError(caught instanceof Error ? caught : new Error('Request failed'));
    } finally {
      if (turn === detailGeneration.current) setDetailLoading(false);
    }
  }
  function applyFilters() {
    const found = validateFields(filters, filterDraft, language);
    setFilterErrors(found);
    if (Object.keys(found).length) return;
    const next = new URLSearchParams();
    // Keep the selected audit section while replacing data filters and pagination.
    if (pathname === '/observer/audit' && params.has('section'))
      next.set('section', params.get('section')!);
    for (const [key, value] of Object.entries(serializeFields(filters, filterDraft)))
      if (value !== undefined && value !== '') next.set(key, String(value));
    router.push(`${pathname}${next.size ? `?${next}` : ''}`);
    setFiltersOpen(false);
  }
  const rows = rowsOf(resource);
  const isList = Array.isArray(resource) || (isRecord(resource) && Array.isArray(resource.items));
  const nextOffset =
    isRecord(resource) && typeof resource.nextOffset === 'number' ? resource.nextOffset : null;
  const nextCursor =
    isRecord(resource) && typeof resource.nextCursor === 'string' ? resource.nextCursor : null;
  const columns = module.columns.length
    ? module.columns
    : rows[0]
      ? Object.keys(rows[0])
          .filter((key) => !['id', 'tenantId', 'etag'].includes(key))
          .slice(0, 5)
      : [];
  const openFilters = () => {
    setFilterDraft(requestValues);
    setFilterErrors({});
    setFiltersOpen(true);
  };
  if (!permitted)
    return (
      <div className="space-y-6">
        <PageHeader title={copy(module.title, language)} />
        <Alert tone="warning">
          {text(
            'This workspace does not have access to this area. Choose an authorized workspace.',
            'Cet espace n’a pas accès à cette rubrique. Choisissez un espace autorisé.',
            language,
          )}
        </Alert>
        <Link className="text-brand" href="/workspace">
          {text('Back to workspace tools', 'Retour aux outils', language)}
        </Link>
      </div>
    );
  return (
    <div className="space-y-6">
      {backLink && (
        <Link
          href="/workspace"
          className="inline-flex items-center gap-2 text-sm font-semibold text-ink-muted"
        >
          <ArrowLeft size={16} />
          {text('Workspace tools', 'Outils de l’espace', language)}
        </Link>
      )}
      <PageHeader
        title={copy(module.title, language)}
        subtitle={copy(module.description, language)}
        action={
          <div className="flex flex-wrap gap-2">
            {module.actions
              .filter((a) => a.scope === 'collection' && canAct(a))
              .map((action) => (
                <Button
                  key={action.operation}
                  variant={action.danger ? 'danger' : 'primary'}
                  onClick={() =>
                    setEditor({
                      action,
                      record: !isList && isRecord(resource) ? resource : undefined,
                      etag: !isList ? etag : null,
                    })
                  }
                >
                  {copy(action.label, language)}
                </Button>
              ))}
          </div>
        }
      />
      {headerAddon}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
        <p className="flex items-center gap-2 text-sm text-ink-muted">
          <span
            aria-hidden="true"
            className={`size-2 rounded-full ${error ? 'bg-warning' : 'bg-success'}`}
          />
          {updatedAt
            ? text(
                `Updated ${new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(updatedAt)} · refreshes every 10 seconds`,
                `Actualisé à ${new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(updatedAt)} · actualisation toutes les 10 secondes`,
                language,
              )
            : text(
                'Changes sync automatically while this page is open.',
                'Les changements s’actualisent automatiquement sur cette page.',
                language,
              )}
        </p>
        <div className="flex flex-wrap gap-2">
          {filters.length > 0 && (
            <Button
              variant="secondary"
              size="md"
              leadingIcon={<SlidersHorizontal size={16} />}
              onClick={openFilters}
            >
              {text('Filters & scope', 'Filtres et périmètre', language)}
            </Button>
          )}
          <Button
            variant="ghost"
            size="md"
            loading={refreshing}
            disabled={!ready}
            leadingIcon={<RefreshCw size={16} />}
            onClick={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          >
            {text('Refresh', 'Actualiser', language)}
          </Button>
        </div>
      </div>
      {error && (
        <Alert
          tone="danger"
          title={text('Could not refresh this view', 'Impossible d’actualiser cette vue', language)}
        >
          <p>{error.message}</p>
          {error instanceof ApiError && error.statusCode === 401 && (
            <Link className="mt-2 inline-block font-semibold underline" href="/login">
              {text('Sign in again', 'Se reconnecter', language)}
            </Link>
          )}
          {resource !== undefined && (
            <p>
              {text(
                'Previously loaded data remains visible.',
                'Les données précédemment chargées restent visibles.',
                language,
              )}
            </p>
          )}
          {error instanceof ApiError && error.requestId && (
            <p className="mt-2 text-xs">
              {text('Reference', 'Référence', language)}: {error.requestId}
            </p>
          )}
        </Alert>
      )}
      {!ready ? (
        <Card className="space-y-4 p-8">
          <h2 className="text-lg font-semibold">
            {text(
              'Choose the scope to continue',
              'Choisissez le périmètre pour continuer',
              language,
            )}
          </h2>
          <p className="text-sm text-ink-soft">
            {text(
              'Select the campaign, team or record you want to manage.',
              'Sélectionnez la campagne, l’équipe ou l’enregistrement à gérer.',
              language,
            )}
          </p>
          <Button onClick={openFilters}>
            {text('Choose scope', 'Choisir le périmètre', language)}
          </Button>
        </Card>
      ) : resource === undefined && !error ? (
        <div role="status" className="rounded-xl border border-line bg-surface p-10 text-ink-muted">
          {text('Loading your workspace…', 'Chargement de votre espace…', language)}
        </div>
      ) : isList ? (
        <Card padding="none" className="min-w-0 overflow-hidden">
          {rows.length ? (
            <div className="relative overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">{copy(module.title, language)}</caption>
                <thead className="border-b border-line bg-surface-muted">
                  <tr>
                    {columns.map((column) => (
                      <th
                        key={column}
                        scope="col"
                        className="px-5 py-3 font-semibold text-ink-muted"
                      >
                        {fieldLabel(column, language)}
                      </th>
                    ))}
                    <th scope="col" className="px-5 py-3">
                      <span className="sr-only">{text('Details', 'Détails', language)}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((record, index) => (
                    <tr
                      key={String(record.id ?? record[module.idField ?? 'id'] ?? index)}
                      className="border-b border-line-soft last:border-0 hover:bg-brand-wash"
                    >
                      {columns.map((column, i) => (
                        <td key={column} className="max-w-xs px-5 py-4 align-top">
                          {i === 0 ? (
                            <button
                              className="text-left font-semibold text-brand hover:underline"
                              onClick={() => void select(record)}
                            >
                              <ValueView value={valueAt(record, column) ?? recordName(record)} />
                            </button>
                          ) : (
                            <ValueView value={valueAt(record, column)} />
                          )}
                        </td>
                      ))}
                      <td className="px-3 py-2">
                        <Button
                          size="md"
                          variant="ghost"
                          aria-label={`${text('Open', 'Ouvrir', language)} ${recordName(record)}`}
                          onClick={() => void select(record)}
                        >
                          <ArrowRight size={17} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-10 text-center">
              <h2 className="text-lg font-semibold">
                {text('No records in this view', 'Aucun enregistrement dans cette vue', language)}
              </h2>
              <p className="mt-2 text-sm text-ink-muted">
                {text(
                  'Adjust your filters or create the first record when available.',
                  'Modifiez les filtres ou créez le premier enregistrement si cette action est disponible.',
                  language,
                )}
              </p>
            </div>
          )}
          <div className="flex items-center justify-between gap-3 border-t border-line-soft px-5 py-3 text-sm text-ink-muted">
            <span>
              {rows.length}{' '}
              {text('records on this page', 'enregistrements sur cette page', language)}
            </span>
            <div className="flex flex-wrap gap-2">
              {(params.has('cursor') || params.has('offset')) && (
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => {
                    const next = new URLSearchParams(paramString);
                    next.delete('cursor');
                    next.delete('offset');
                    router.push(`${pathname}?${next}`);
                  }}
                >
                  {text('First page', 'Première page', language)}
                </Button>
              )}
              {(nextCursor || nextOffset !== null) && (
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => {
                    const next = new URLSearchParams(paramString);
                    if (nextCursor) next.set('cursor', nextCursor);
                    if (nextOffset !== null) next.set('offset', String(nextOffset));
                    router.push(`${pathname}?${next}`);
                  }}
                >
                  {text('Next page', 'Page suivante', language)}
                </Button>
              )}
            </div>
          </div>
        </Card>
      ) : (
        resource !== undefined && (
          <Card className="p-6">
            <ValueView value={resource} />
          </Card>
        )
      )}
      <Drawer
        open={filtersOpen}
        title={text('Filters & scope', 'Filtres et périmètre', language)}
        onClose={() => setFiltersOpen(false)}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setFilterDraft(defaults)}>
              {text('Clear filters', 'Effacer les filtres', language)}
            </Button>
            <Button onClick={applyFilters}>{text('Apply', 'Appliquer', language)}</Button>
          </div>
        }
      >
        <SchemaFields
          fields={filters}
          values={filterDraft}
          onChange={setFilterDraft}
          errors={filterErrors}
        />
      </Drawer>
      <Drawer
        open={!!selected && !editor}
        title={selected ? recordName(selected) : ''}
        onClose={() => {
          detailGeneration.current++;
          setSelected(null);
        }}
        footer={
          <div className="flex flex-wrap gap-2">
            {module.actions
              .filter((a) => a.scope === 'record' && canAct(a))
              .map((action) => (
                <Button
                  key={action.operation}
                  size="md"
                  variant={action.danger ? 'danger' : 'secondary'}
                  disabled={detailLoading || !!detailError || !!objectiveLocked}
                  onClick={() =>
                    setEditor({ action, record: selected ?? undefined, etag: selectedEtag })
                  }
                >
                  {copy(action.label, language)}
                </Button>
              ))}
          </div>
        }
      >
        <div className="space-y-6">
          {detailLoading && (
            <p role="status">{text('Loading details…', 'Chargement des détails…', language)}</p>
          )}
          {detailError && (
            <Alert tone="danger">
              {detailError.message}
              <Button variant="ghost" onClick={() => selected && void select(selected)}>
                {text('Retry', 'Réessayer', language)}
              </Button>
            </Alert>
          )}
          {objectiveLocked && (
            <Alert tone="info">
              {text(
                'This objective has started. Its definition is locked; progress continues to update.',
                'Cet objectif a démarré. Sa définition est verrouillée ; sa progression continue de s’actualiser.',
                language,
              )}
            </Alert>
          )}
          {selected && <ValueView value={selected} />}
          {module.related?.length ? (
            <div className="flex flex-wrap gap-2">
              {module.related.map((entry) => (
                <Button
                  key={entry.operation}
                  variant="secondary"
                  size="md"
                  onClick={async () => {
                    setRelated({ label: copy(entry.label, language) });
                    try {
                      const result = await readOperation(
                        entry.operation,
                        recordContext(module, selected ?? undefined, context),
                      );
                      setRelated({ label: copy(entry.label, language), data: result.resource });
                    } catch (caught) {
                      setRelated({
                        label: copy(entry.label, language),
                        error: caught instanceof Error ? caught.message : 'Request failed',
                      });
                    }
                  }}
                >
                  {copy(entry.label, language)}
                </Button>
              ))}
            </div>
          ) : null}
          {related && (
            <section className="space-y-4 border-t border-line pt-5">
              <h3 className="font-semibold">{related.label}</h3>
              {related.error ? (
                <Alert tone="danger">{related.error}</Alert>
              ) : related.data === undefined ? (
                <p role="status">{text('Loading…', 'Chargement…', language)}</p>
              ) : isRecord(related.data) &&
                typeof related.data.downloadUrl === 'string' &&
                /^https?:\/\//.test(related.data.downloadUrl) ? (
                <a
                  href={related.data.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex rounded-lg bg-brand px-4 py-3 font-semibold text-white"
                >
                  {text('Download', 'Télécharger', language)}
                </a>
              ) : (
                <ValueView value={related.data} />
              )}
            </section>
          )}
        </div>
      </Drawer>
      {editor && (
        <ActionEditor
          key={editor.action.operation}
          action={editor.action}
          record={editor.record}
          context={recordContext(module, editor.record, context)}
          etag={editor.etag}
          reloadKey={
            editor.action.scope === 'record' ? module.detail : !isList ? module.read : undefined
          }
          onClose={() => setEditor(null)}
          onSaved={() => {
            void load();
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}
