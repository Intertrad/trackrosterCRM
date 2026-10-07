'use client';

import { useCallback, useMemo, useState } from 'react';
import { ArrowUpRight, ChevronDown, Plus, Search, Users } from 'lucide-react';
import { AdminGuard } from '@/components/admin/admin-guard';
import { ActionEditor } from '@/components/workspace/action-editor';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Drawer } from '@/components/ui/drawer';
import { PageHeader } from '@/components/ui/page-header';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { useLivePages } from '@/lib/live/use-live-pages';
import { isRecord, readOperation, rowsOf } from '@/lib/workspace/client';
import { text } from '@/lib/workspace/copy';
import { WORKSPACE_MODULES } from '@/lib/workspace/modules';
import type { Action, DataRecord } from '@/lib/workspace/types';

const definition = WORKSPACE_MODULES.find((module) => module.id === 'organizations')!;
const PROFILE_FIELDS = [
  'shortName',
  'name',
  'phone',
  'email',
  'website',
  'address',
  'currency',
  'prospectedSectors',
  'argumentaire',
] as const;

function valuePresent(value: unknown) {
  return (
    value !== null &&
    value !== undefined &&
    value !== '' &&
    (!Array.isArray(value) || value.length > 0)
  );
}

function profileProgress(record: DataRecord) {
  const complete = PROFILE_FIELDS.filter((field) => valuePresent(record[field])).length;
  return { complete, total: PROFILE_FIELDS.length };
}

function sectorLabels(value: unknown, language: 'en' | 'fr') {
  if (!Array.isArray(value) || value.length === 0)
    return [text('All sectors', 'Tous les secteurs', language)];
  const labels: Record<string, string> = {
    police_gendarmerie: text('Police & gendarmerie', 'Police et gendarmerie', language),
    justice_enquetes: text('Justice', 'Justice', language),
    retention_administrative: text(
      'Administrative retention',
      'Rétention administrative',
      language,
    ),
    douanes_onaf: text('Customs', 'Douanes', language),
    asile_social: text('Asylum & social', 'Asile et social', language),
    sante: text('Healthcare', 'Santé', language),
    prescripteurs: text('Referrers', 'Prescripteurs', language),
  };
  return value.map((item) => labels[String(item)] ?? String(item));
}

function initials(record: DataRecord) {
  const value = String(record.shortName ?? record.name ?? 'CO');
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

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
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive' | 'incomplete'>('all');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [detailError, setDetailError] = useState(false);
  const [selected, setSelected] = useState<DataRecord | null>(null);
  const [detail, setDetail] = useState<DataRecord | null>(null);
  const [detailEtag, setDetailEtag] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<'profile' | 'coordination' | 'teams'>('profile');
  const [editor, setEditor] = useState<{
    action: Action;
    record?: DataRecord;
    etag?: string | null;
  } | null>(null);
  const [editorLoading, setEditorLoading] = useState(false);
  const read = useCallback(async (cursor: string | undefined, signal: AbortSignal) => {
    const { resource } = await readOperation(definition.read, {}, { limit: 100, cursor }, signal);
    return {
      items: rowsOf(resource),
      nextCursor: (resource as { nextCursor?: string }).nextCursor ?? null,
    };
  }, []);
  const { rows, cursor, error, busy, load, loadMore } = useLivePages(read);

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = (rows ?? []).filter((row) => {
      const progress = profileProgress(row);
      const matchesFilter =
        filter === 'all' ||
        (filter === 'active' && row.status === 'active') ||
        (filter === 'inactive' && row.status !== 'active') ||
        (filter === 'incomplete' && progress.complete < progress.total);
      const matchesSearch =
        !query ||
        [row.name, row.shortName, row.slug, row.email].some((value) =>
          String(value ?? '')
            .toLowerCase()
            .includes(query),
        );
      return matchesFilter && matchesSearch;
    });
    const collator = new Intl.Collator(language, { numeric: true, sensitivity: 'base' });
    return filtered.sort((left, right) => {
      const leftName = String(left.shortName ?? left.name ?? left.slug ?? '');
      const rightName = String(right.shortName ?? right.name ?? right.slug ?? '');
      const byName = collator.compare(leftName, rightName);
      const byId = String(left.id).localeCompare(String(right.id));
      const result = byName || byId;
      return sortDirection === 'asc' ? result : -result;
    });
  }, [filter, language, rows, search, sortDirection]);

  const counts = useMemo(() => {
    const all = rows ?? [];
    return {
      all: all.length,
      active: all.filter((row) => row.status === 'active').length,
      inactive: all.filter((row) => row.status !== 'active').length,
      incomplete: all.filter((row) => profileProgress(row).complete < PROFILE_FIELDS.length).length,
    };
  }, [rows]);

  async function openDetail(row: DataRecord) {
    setSelected(row);
    setDetail(row);
    setDetailEtag(null);
    setDetailTab('profile');
    setDetailError(false);
    setDetailLoading(true);
    try {
      const result = await readOperation(definition.detail!, { organizationId: row.id });
      setDetail(result.resource as DataRecord);
      setDetailEtag(result.etag);
    } catch {
      setDetailError(true);
    } finally {
      setDetailLoading(false);
    }
  }

  async function openEditor(record?: DataRecord, etag?: string | null) {
    setSelected(null);
    setDetail(null);
    if (!record) {
      setEditor({ action: definition.actions[0]! });
      return;
    }

    // Render can take long enough for a company to change between opening its
    // detail drawer and clicking Edit. Read the mutable record immediately
    // before opening the form so the first save uses the current validator.
    setEditorLoading(true);
    try {
      const latest = await readOperation(definition.detail!, { organizationId: record.id });
      if (isRecord(latest.resource)) {
        setEditor({
          action: definition.actions[1]!,
          record: latest.resource,
          etag: latest.etag ?? etag,
        });
        return;
      }
    } catch {
      // Keep the existing record as a fallback; ActionEditor can still load
      // the latest version through its conflict recovery action.
    } finally {
      setEditorLoading(false);
    }
    setEditor({ action: definition.actions[1]!, record, etag });
  }

  const activeRecord = detail ?? selected;
  const progress = activeRecord ? profileProgress(activeRecord) : null;
  const sectors = activeRecord ? sectorLabels(activeRecord.prospectedSectors, language) : [];
  const summary = activeRecord?.summary as Record<string, unknown> | undefined;

  return (
    <div className="space-y-5">
      <PageHeader
        title={l('Companies', 'Entreprises')}
        subtitle={l(
          'The organizations that share your prospecting workspace. Their coordination rules decide who may contact the same establishment.',
          'Les organisations qui partagent votre espace de prospection. Leurs règles de coordination déterminent qui peut contacter un même établissement.',
        )}
        action={
          <Button onClick={() => openEditor()}>
            <Plus className="size-4" />
            {l('Add a company', 'Ajouter une entreprise')}
          </Button>
        }
      />

      {error && (
        <Alert tone="danger">
          {l('Unable to load company data.', 'Impossible de charger les données de l’entreprise.')}{' '}
          <button className="underline" onClick={() => void load()}>
            {l('Retry', 'Réessayer')}
          </button>
        </Alert>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <label className="relative block min-w-0 flex-1 lg:max-w-[380px]">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-muted"
          />
          <input
            aria-label={l('Search companies', 'Rechercher une entreprise')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={l('Search a company', 'Rechercher une entreprise')}
            className="h-11 w-full rounded-xl border border-line bg-surface px-10 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-brand focus:ring-2 focus:ring-brand/15"
          />
        </label>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {(
            [
              ['all', l('All', 'Toutes'), counts.all],
              ['active', l('Active', 'Actives'), counts.active],
              ['inactive', l('Inactive', 'Inactives'), counts.inactive],
              ['incomplete', l('Incomplete', 'Incomplètes'), counts.incomplete],
            ] as const
          ).map(([value, label, count]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className={`rounded-full border px-4 py-2 text-[13px] font-bold transition-colors ${filter === value ? 'border-navy bg-navy text-white' : 'border-line bg-surface text-ink-soft hover:border-brand hover:text-brand'}`}
            >
              {label}{' '}
              <span className={filter === value ? 'text-white/75' : 'text-ink-muted'}>{count}</span>
            </button>
          ))}
          <button
            type="button"
            aria-label={l('Sort companies by name', 'Trier les entreprises par nom')}
            aria-pressed="true"
            onClick={() => setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))}
            className="ml-auto flex items-center gap-1 text-sm font-semibold text-ink-muted hover:text-brand"
          >
            {sortDirection === 'asc' ? l('Name A–Z', 'Nom A–Z') : l('Name Z–A', 'Nom Z–A')}{' '}
            <ChevronDown
              aria-hidden="true"
              className={`size-4 transition-transform ${sortDirection === 'desc' ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      </div>

      {rows === null && !error ? (
        <div className="h-72 animate-pulse rounded-2xl bg-line-soft" aria-busy="true" />
      ) : visibleRows.length === 0 ? (
        <Card>
          <p className="py-12 text-center text-ink-muted">
            {search || filter !== 'all'
              ? l(
                  'No companies match these filters.',
                  'Aucune entreprise ne correspond à ces filtres.',
                )
              : l(
                  'Add your first company to organize your teams.',
                  'Ajoutez votre première entreprise pour organiser vos équipes.',
                )}
          </p>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left">
              <thead className="bg-surface-muted">
                <tr className="border-b border-line text-[11px] font-extrabold tracking-[0.08em] text-ink-muted uppercase">
                  <th className="px-5 py-3">{l('Company', 'Entreprise')}</th>
                  <th className="px-4 py-3">{l('Prospected sectors', 'Secteurs prospectés')}</th>
                  <th className="px-4 py-3">{l('Coordination with others', 'Coordination')}</th>
                  <th className="px-4 py-3">{l('Profile data', 'Données du profil')}</th>
                  <th className="px-4 py-3">{l('Status', 'Statut')}</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {visibleRows.map((row) => {
                  const rowProgress = profileProgress(row);
                  const rowSectors = sectorLabels(row.prospectedSectors, language);
                  const selectedRow = selected?.id === row.id;
                  return (
                    <tr
                      key={String(row.id)}
                      role="button"
                      tabIndex={0}
                      aria-label={`${l('Open company', 'Ouvrir l’entreprise')} ${String(row.shortName ?? row.name)}`}
                      onClick={() => void openDetail(row)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          void openDetail(row);
                        }
                      }}
                      className={`cursor-pointer transition-colors hover:bg-brand-wash ${selectedRow ? 'bg-brand-wash' : ''}`}
                    >
                      <td className="px-5 py-4 align-middle">
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className="flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold text-white"
                            style={{ backgroundColor: String(row.color ?? '#0B1B52') }}
                          >
                            {initials(row)}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[15px] font-extrabold text-navy">
                              {String(row.shortName ?? row.name)}
                            </span>
                            <span className="block max-w-[250px] truncate text-[13px] text-ink-muted">
                              {String(row.name ?? row.slug ?? '—')}
                            </span>
                            {rowProgress.complete < rowProgress.total ? (
                              <span className="mt-0.5 block text-[12px] font-semibold text-warning">
                                {l('Profile incomplete', 'Profil incomplet')}
                              </span>
                            ) : null}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <div className="flex max-w-[190px] flex-wrap gap-1.5">
                          {rowSectors.slice(0, 2).map((sector) => (
                            <Badge key={sector} tone="brand">
                              {sector}
                            </Badge>
                          ))}
                          {rowSectors.length > 2 ? (
                            <Badge tone="neutral">+{rowSectors.length - 2}</Badge>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-4 align-middle text-[13px] text-ink-soft">
                        {row.coordinationMode
                          ? String(row.coordinationMode)
                          : l('Not configured', 'Non configurée')}
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <div className="w-[150px]">
                          <div className="flex items-center justify-between gap-2 text-[13px] font-bold text-ink">
                            <span>
                              {rowProgress.complete} / {rowProgress.total} {l('fields', 'champs')}
                            </span>
                          </div>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line-soft">
                            <span
                              className={`block h-full rounded-full ${rowProgress.complete < 6 ? 'bg-warning' : rowProgress.complete === rowProgress.total ? 'bg-lime-500' : 'bg-brand'}`}
                              style={{
                                width: `${(rowProgress.complete / rowProgress.total) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-middle">
                        <Badge tone={row.status === 'active' ? 'success' : 'neutral'} dot>
                          {row.status === 'active'
                            ? l('Active', 'Active')
                            : l('Inactive', 'Inactive')}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 text-right align-middle">
                        <Button
                          variant="secondary"
                          size="md"
                          onClick={(event) => {
                            event.stopPropagation();
                            void openDetail(row);
                          }}
                        >
                          {l('Open', 'Ouvrir')} <ArrowUpRight className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-line-soft px-5 py-3 text-[13px] text-ink-muted">
            {l(
              'Select a company to open its profile, contact details and coordination rules.',
              'Sélectionnez une entreprise pour ouvrir son profil, ses coordonnées et ses règles de coordination.',
            )}
          </div>
        </div>
      )}

      {cursor ? (
        <Button variant="secondary" onClick={loadMore} disabled={busy}>
          {l('Load more companies', 'Charger les entreprises suivantes')}
        </Button>
      ) : null}

      {activeRecord ? (
        <Drawer
          open
          title={String(activeRecord.shortName ?? activeRecord.name ?? l('Company', 'Entreprise'))}
          onClose={() => {
            setSelected(null);
            setDetail(null);
          }}
          headerAccessory={
            <Badge tone={activeRecord.status === 'active' ? 'success' : 'neutral'} dot>
              {activeRecord.status === 'active' ? l('Active', 'Active') : l('Inactive', 'Inactive')}
            </Badge>
          }
          footer={
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-semibold text-ink-muted">
                {progress?.complete} / {progress?.total} {l('fields complete', 'champs complétés')}
              </span>
              <Button
                loading={editorLoading}
                onClick={() => void openEditor(activeRecord, detailEtag)}
              >
                {l('Edit company', 'Modifier l’entreprise')} <ArrowUpRight className="size-4" />
              </Button>
            </div>
          }
        >
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <span
                className="flex size-12 shrink-0 items-center justify-center rounded-xl text-base font-extrabold text-white"
                style={{ backgroundColor: String(activeRecord.color ?? '#0B1B52') }}
              >
                {initials(activeRecord)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-bold text-navy">
                  {String(activeRecord.name ?? activeRecord.slug ?? '—')}
                </p>
                <p className="text-[13px] text-ink-muted">
                  {l('Company profile', 'Profil entreprise')}
                </p>
              </div>
            </div>
            {detailError ? (
              <Alert tone="danger">
                {l(
                  'We could not load the latest company details.',
                  'Impossible de charger les détails de l’entreprise.',
                )}{' '}
                <button className="underline" onClick={() => void openDetail(activeRecord)}>
                  {l('Retry', 'Réessayer')}
                </button>
              </Alert>
            ) : detailLoading ? (
              <div className="h-24 animate-pulse rounded-xl bg-line-soft" aria-busy="true" />
            ) : null}
            {progress && progress.complete < progress.total ? (
              <Alert
                tone="warning"
                title={l(
                  `${progress.total - progress.complete} fields are missing`,
                  `${progress.total - progress.complete} champs manquants`,
                )}
              >
                {l(
                  'Complete the legal name and contact details so imports and matching stay reliable.',
                  'Complétez le nom légal et les coordonnées pour fiabiliser les imports et le rapprochement.',
                )}
              </Alert>
            ) : null}
            <div className="flex items-center gap-1 border-b border-line-soft">
              {(['profile', 'coordination', 'teams'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setDetailTab(tab)}
                  className={`border-b-2 px-3 py-3 text-[13px] font-bold ${detailTab === tab ? 'border-brand text-navy' : 'border-transparent text-ink-muted hover:text-ink'}`}
                >
                  {tab === 'profile'
                    ? l('Profile', 'Profil')
                    : tab === 'coordination'
                      ? l('Coordination', 'Coordination')
                      : l('Teams', 'Équipes')}
                </button>
              ))}
            </div>
            {detailTab === 'profile' ? (
              <div className="space-y-6">
                <section>
                  <h3 className="mb-3 text-[11px] font-extrabold tracking-[0.08em] text-ink-muted uppercase">
                    {l('Identity', 'Identité')}
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <DetailField
                      label={l('Short name', 'Nom court')}
                      value={activeRecord.shortName ?? activeRecord.slug}
                    />
                    <DetailField
                      label={l('Brand colour', 'Couleur de marque')}
                      value={activeRecord.color}
                      color={String(activeRecord.color ?? '')}
                    />
                    <DetailField
                      label={l('Full legal name', 'Nom légal complet')}
                      value={activeRecord.name}
                      wide
                    />
                  </div>
                </section>
                <section>
                  <h3 className="mb-3 text-[11px] font-extrabold tracking-[0.08em] text-ink-muted uppercase">
                    {l('Contact', 'Coordonnées')}
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <DetailField label={l('Phone', 'Téléphone')} value={activeRecord.phone} />
                    <DetailField label={l('Email', 'E-mail')} value={activeRecord.email} />
                    <DetailField
                      label={l('Website', 'Site internet')}
                      value={activeRecord.website}
                    />
                    <DetailField label={l('Currency', 'Devise')} value={activeRecord.currency} />
                    <DetailField
                      label={l('Address', 'Adresse')}
                      value={activeRecord.address}
                      wide
                    />
                  </div>
                </section>
                <section>
                  <h3 className="mb-3 text-[11px] font-extrabold tracking-[0.08em] text-ink-muted uppercase">
                    {l('Prospected sectors', 'Secteurs prospectés')}
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {sectors.map((sector) => (
                      <Badge key={sector} tone="brand">
                        {sector}
                      </Badge>
                    ))}
                  </div>
                </section>
              </div>
            ) : detailTab === 'coordination' ? (
              <section className="space-y-4">
                <div className="rounded-xl border border-brand-tint bg-brand-wash p-4 text-sm text-ink-soft">
                  {l(
                    'Coordination rules control how teams share contact windows for the same establishment.',
                    'Les règles de coordination contrôlent la manière dont les équipes partagent les fenêtres de contact d’un même établissement.',
                  )}
                </div>
                <DetailStat
                  label={l('Current mode', 'Mode actuel')}
                  value={String(
                    activeRecord.coordinationMode ?? l('Not configured', 'Non configuré'),
                  )}
                />
                <DetailStat
                  label={l('Active campaigns', 'Campagnes actives')}
                  value={String(summary?.campaignsWithAssignments ?? '—')}
                />
                <DetailStat
                  label={l('Active assignments', 'Affectations actives')}
                  value={String(summary?.activeAssignments ?? '—')}
                />
              </section>
            ) : (
              <section className="space-y-3">
                <DetailStat
                  label={l('Teams with access', 'Équipes autorisées')}
                  value={String(summary?.teamCount ?? '—')}
                />
                <DetailStat
                  label={l('Assigned members', 'Membres affectés')}
                  value={String(summary?.assignedMembers ?? '—')}
                />
                <DetailStat
                  label={l('Paused assignments', 'Affectations en pause')}
                  value={String(summary?.pausedAssignments ?? '—')}
                />
                <div className="flex items-start gap-3 rounded-xl border border-line-soft bg-surface-muted p-4 text-sm text-ink-soft">
                  <Users aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand" />
                  {l(
                    'Team access is shown only for teams in your authorized workspace scope.',
                    'Les accès d’équipe sont affichés uniquement pour les équipes de votre périmètre autorisé.',
                  )}
                </div>
              </section>
            )}
          </div>
        </Drawer>
      ) : null}

      {editor ? (
        <ActionEditor
          action={editor.action}
          context={editor.record ? { organizationId: editor.record.id } : {}}
          record={editor.record}
          etag={editor.etag}
          reloadKey={editor.record ? definition.detail : undefined}
          onClose={() => setEditor(null)}
          onSaved={(response) => {
            if (isRecord(response.resource)) {
              const updated = response.resource as DataRecord;
              setSelected(updated);
              setDetail(updated);
              setDetailEtag(response.etag);
            }
            // Refresh the list and derived summary data in the background;
            // the saved response keeps the visible detail current immediately.
            void load();
          }}
        />
      ) : null}
    </div>
  );
}

function DetailField({
  label,
  value,
  wide = false,
  color,
}: {
  label: string;
  value: unknown;
  wide?: boolean;
  color?: string;
}) {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <p className="mb-1.5 text-[12px] font-bold text-ink-muted">{label}</p>
      <div className="min-h-10 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink">
        {color && /^#[0-9A-F]{6}$/i.test(color) ? (
          <span
            aria-hidden="true"
            className="mr-2 inline-block size-4 rounded-md align-[-3px] ring-1 ring-black/10"
            style={{ backgroundColor: color }}
          />
        ) : null}
        {String(value ?? '—') || '—'}
      </div>
    </div>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line-soft py-3 text-sm">
      <span className="text-ink-muted">{label}</span>
      <span className="font-bold text-navy">{value}</span>
    </div>
  );
}
