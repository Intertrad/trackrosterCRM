'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Building2, List, MapPin, Plus, RefreshCw, Users, Download } from 'lucide-react';
import { AdminGuard } from '@/components/admin/admin-guard';
import { ProspectAssignmentDrawer } from '@/components/admin/prospect-base/assignment-drawer';
import { ProspectMap, toMapPoint } from '@/components/prospector/prospect-map';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Drawer } from '@/components/ui/drawer';
import { LinkButton } from '@/components/ui/link-button';
import { PageHeader } from '@/components/ui/page-header';
import { SearchInput } from '@/components/ui/search-input';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { ApiError } from '@/lib/api/api-error';
import { CATEGORY_LABELS, MAX_BATCH_SIZE } from '@/lib/api/assignment-types';
import { ESTABLISHMENT_CATEGORIES, type EstablishmentCategory } from '@/lib/api/import-types';
import { listProspects } from '@/lib/api/prospect-client';
import {
  DEPARTMENT_SHAPE,
  PROSPECT_PAGE_SIZE,
  type Prospect,
  type ProspectQuery,
} from '@/lib/api/prospect-types';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { useLiveRefresh } from '@/lib/live/use-live-refresh';
import { ActionEditor } from '@/components/workspace/action-editor';
import { WORKSPACE_MODULES } from '@/lib/workspace/modules';
import { text } from '@/lib/workspace/copy';
import { togglePage, toggleRecord } from '@/lib/ui/record-selection';

export default function ReferentialPage() {
  const { language } = useTranslation();
  const title = text('Prospects', 'Prospects', language);
  return (
    <AdminGuard
      title={title}
      subtitle={text(
        'The shared establishment base',
        'La base commune des établissements',
        language,
      )}
    >
      <Suspense fallback={<Loading />}>
        <Referential />
      </Suspense>
    </AdminGuard>
  );
}
function Loading() {
  return <div className="h-64 animate-pulse rounded-xl bg-surface-muted" aria-busy="true" />;
}

function Referential() {
  const { language, locale } = useTranslation();
  const l = (en: string, fr: string) => text(en, fr, language);
  const params = useSearchParams(),
    router = useRouter(),
    pathname = usePathname();
  const paramString = params.toString();
  const query = useMemo<ProspectQuery>(() => {
    const p = new URLSearchParams(paramString);
    const category = p.get('category') as EstablishmentCategory | null;
    const status = p.get('status') ?? 'active';
    return {
      limit: PROSPECT_PAGE_SIZE,
      ...(p.get('search') ? { search: p.get('search')!.slice(0, 200) } : {}),
      ...(category && ESTABLISHMENT_CATEGORIES.includes(category) ? { category } : {}),
      ...(DEPARTMENT_SHAPE.test(p.get('department') ?? '')
        ? { department: p.get('department')! }
        : {}),
      ...(p.get('postalCode') ? { postalCode: p.get('postalCode')! } : {}),
      ...(p.get('city') ? { city: p.get('city')! } : {}),
      ...(p.get('address') ? { address: p.get('address')! } : {}),
      status: ['active', 'inactive', 'archived', 'all'].includes(status)
        ? (status as ProspectQuery['status'])
        : 'active',
      sort: p.get('sort') === 'createdAt' ? 'createdAt' : 'name',
      ...(p.get('cursor') ? { cursor: p.get('cursor')! } : {}),
    };
  }, [paramString]);
  const map = params.get('view') === 'map';
  const [search, setSearch] = useState(query.search ?? '');
  const [composing, setComposing] = useState(false);
  const [departmentError, setDepartmentError] = useState(false);
  const [items, setItems] = useState<Prospect[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [previous, setPrevious] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<Map<string, Prospect>>(new Map());
  const [detail, setDetail] = useState<Prospect | null>(null);
  const [batch, setBatch] = useState<Prospect[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const pageCheckbox = useRef<HTMLInputElement>(null);
  const latestQuery = useRef(paramString);
  latestQuery.current = paramString;
  const requestNumber = useRef(0);
  const queryKey = JSON.stringify(query);
  const scopeKey = JSON.stringify({ ...query, cursor: undefined });
  useEffect(() => {
    setSelected(new Map());
    setDetail(null);
    setPrevious([]);
  }, [scopeKey]);
  useEffect(() => setSearch(query.search ?? ''), [query.search]);
  const update = useCallback(
    (changes: Record<string, string>, page = false) => {
      const p = new URLSearchParams(latestQuery.current);
      if (!page) p.delete('cursor');
      for (const [key, value] of Object.entries(changes)) {
        if (value) p.set(key, value);
        else p.delete(key);
      }
      router.replace(`${pathname}${p.size ? '?' + p : ''}`, { scroll: false });
    },
    [router, pathname],
  );
  useEffect(() => {
    if (composing || search.trim() === (query.search ?? '')) return;
    const timer = setTimeout(() => update({ search: search.trim() }), 300);
    return () => clearTimeout(timer);
  }, [search, composing, query.search, update]);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      const current = ++requestNumber.current;
      try {
        const page = await listProspects(JSON.parse(queryKey) as ProspectQuery, signal);
        if (signal?.aborted || current !== requestNumber.current) return;
        setItems(page.items);
        setNextCursor(page.nextCursor);
        setError(null);
      } catch (caught) {
        if (signal?.aborted || current !== requestNumber.current) return;
        if (caught instanceof ApiError && [401, 403].includes(caught.statusCode)) {
          setItems(null);
          setNextCursor(null);
          setSelected(new Map());
        }
        setError(
          caught instanceof ApiError && caught.statusCode === 400
            ? caught.message
            : caught instanceof ApiError && caught.statusCode === 403
              ? text(
                  'Your access no longer permits viewing this base.',
                  'Vos droits ne permettent plus de consulter cette base.',
                  language,
                )
              : text(
                  'Could not refresh the prospects. Retry to get current data.',
                  'Impossible d’actualiser les prospects. Réessayez pour obtenir les données à jour.',
                  language,
                ),
        );
      }
    },
    [queryKey, language],
  );
  useEffect(() => {
    const controller = new AbortController();
    setItems(null);
    setError(null);
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);
  useLiveRefresh(load, { scope: queryKey });
  const activePage = (items ?? []).filter((r) => r.status === 'active');
  const allChecked = activePage.length > 0 && activePage.every((r) => selected.has(r.id));
  const someChecked = activePage.some((r) => selected.has(r.id));
  useEffect(() => {
    if (pageCheckbox.current) pageCheckbox.current.indeterminate = someChecked && !allChecked;
  }, [allChecked, someChecked]);
  const points = (items ?? []).flatMap((r) =>
    toMapPoint(r.id, r.name, r.latitude, r.longitude, 'to_contact', `/admin/prospects/${r.id}`),
  );
  const filterCount = [
    query.search,
    query.category,
    query.department,
    query.postalCode,
    query.city,
    query.address,
    query.status !== 'active',
  ].filter(Boolean).length;
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={l('Prospects', 'Prospects')}
        subtitle={l(
          'Administration’s shared base. Select establishments to build a prospector’s portfolio.',
          'Base commune de l’administration. Sélectionnez des établissements pour constituer un portefeuille.',
        )}
        action={
          <div className="flex gap-2">
            <LinkButton href="/manager/exports" variant="secondary">
              <Download className="size-4" />
              {l('Export (CSV)', 'Exporter (CSV)')}
            </LinkButton>
            <Button onClick={() => setAdding(true)}>
              <Plus className="size-4" />
              {l('Add', 'Ajouter')}
            </Button>
          </div>
        }
      />
      {adding && (
        <ActionEditor
          action={WORKSPACE_MODULES.find((m) => m.id === 'prospect-records')!.actions[0]!}
          context={{}}
          onClose={() => setAdding(false)}
          onSaved={() => void load()}
        />
      )}
      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}
      <Card className="space-y-3 p-4 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <SearchInput
            className="min-w-0 flex-1"
            label={l('Search prospects', 'Rechercher des établissements')}
            placeholder={l(
              'Name, address, postcode or town…',
              'Nom, adresse, code postal ou commune…',
            )}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => {
              setSearch('');
              update({ search: '' });
            }}
            onCompositionStart={() => setComposing(true)}
            onCompositionEnd={() => setComposing(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                update({ search: search.trim() });
              }
            }}
          />
          <Button onClick={() => update({ search: search.trim() })}>
            {l('Search', 'Rechercher')}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setSearch('');
              setDepartmentError(false);
              update({
                search: '',
                category: '',
                department: '',
                postalCode: '',
                city: '',
                address: '',
                status: '',
                sort: '',
              });
            }}
            disabled={!filterCount}
          >
            {l('Clear filters', 'Effacer les filtres')}
            {filterCount ? ` (${filterCount})` : ''}
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
          <SelectField
            label={l('Section', 'Secteur')}
            value={query.category ?? ''}
            onChange={(e) => update({ category: e.target.value })}
            options={[
              { value: '', label: l('All sections', 'Tous les secteurs') },
              ...ESTABLISHMENT_CATEGORIES.map((value) => ({
                value,
                label: CATEGORY_LABELS[value],
              })),
            ]}
          />
          <TextField
            key={query.department ?? 'department'}
            label={l('Department', 'Département')}
            placeholder="01, 75, 974…"
            defaultValue={query.department ?? ''}
            error={
              departmentError
                ? l(
                    'Use a department such as 01, 75 or 974.',
                    'Utilisez un département comme 01, 75 ou 974.',
                  )
                : null
            }
            maxLength={3}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (!v || DEPARTMENT_SHAPE.test(v)) update({ department: v });
              else setDepartmentError(true);
            }}
            onChange={() => setDepartmentError(false)}
          />
          <TextField
            key={query.postalCode ?? 'postalCode'}
            label={l('Postcode', 'Code postal')}
            placeholder="75001"
            defaultValue={query.postalCode ?? ''}
            onBlur={(e) => update({ postalCode: e.target.value.trim() })}
          />
          <TextField
            key={query.city ?? 'city'}
            label={l('Town', 'Commune')}
            defaultValue={query.city ?? ''}
            onBlur={(e) => update({ city: e.target.value.trim() })}
          />
          <TextField
            key={query.address ?? 'address'}
            label={l('Address', 'Adresse')}
            placeholder={l('Street or number', 'Rue ou numéro')}
            defaultValue={query.address ?? ''}
            onBlur={(e) => update({ address: e.target.value.trim() })}
          />
          <SelectField
            label={l('Status', 'Statut')}
            value={query.status ?? 'active'}
            onChange={(e) => update({ status: e.target.value })}
            options={[
              { value: 'active', label: l('Active', 'Actifs') },
              { value: 'inactive', label: l('Inactive', 'Inactifs') },
              { value: 'archived', label: l('Archived', 'Archivés') },
              { value: 'all', label: l('All', 'Tous') },
            ]}
          />
          <SelectField
            label={l('Sort', 'Tri')}
            value={query.sort ?? 'name'}
            onChange={(e) => update({ sort: e.target.value })}
            options={[
              { value: 'name', label: l('Name', 'Nom') },
              { value: 'createdAt', label: l('Newest', 'Plus récents') },
            ]}
          />
        </div>
      </Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            leadingIcon={<Users className="size-4" aria-hidden="true" />}
            disabled={!selected.size || !!error}
            onClick={() => setBatch([...selected.values()])}
          >
            {l(`Assign selection (${selected.size})`, `Attribuer la sélection (${selected.size})`)}
          </Button>
          {selected.size > 0 && (
            <Button variant="ghost" onClick={() => setSelected(new Map())}>
              {l('Clear selection', 'Effacer la sélection')}
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            loading={refreshing}
            aria-label={l('Refresh prospects', 'Actualiser les prospects')}
            onClick={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          >
            <RefreshCw aria-hidden="true" className="size-4" />
          </Button>
          <Button
            variant={!map ? 'primary' : 'secondary'}
            aria-pressed={!map}
            onClick={() => update({ view: '' }, true)}
          >
            <List aria-hidden="true" className="size-4" />
            {l('List', 'Liste')}
          </Button>
          <Button
            variant={map ? 'primary' : 'secondary'}
            aria-pressed={map}
            onClick={() => update({ view: 'map' }, true)}
          >
            <MapPin aria-hidden="true" className="size-4" />
            {l('Map', 'Carte')}
          </Button>
        </div>
      </div>
      <p className="text-xs text-ink-muted">
        {l(
          `Select up to ${MAX_BATCH_SIZE} active records across pages. Changing filters clears the selection.`,
          `Sélectionnez jusqu’à ${MAX_BATCH_SIZE} établissements actifs sur plusieurs pages. Changer les filtres efface la sélection.`,
        )}
      </p>
      <Card className="p-0 sm:p-0">
        {items === null ? (
          error ? (
            <div className="p-6">
              <Button onClick={() => void load()}>{l('Retry', 'Réessayer')}</Button>
            </div>
          ) : (
            <Loading />
          )
        ) : !items.length ? (
          <div className="py-14 text-center">
            <Building2 aria-hidden="true" className="mx-auto mb-3 size-8 text-ink-muted" />
            <p>
              {filterCount
                ? l(
                    'No establishments match these filters.',
                    'Aucun établissement ne correspond à ces filtres.',
                  )
                : l(
                    'The prospect base is empty. Import records to get started.',
                    'La base est vide. Importez des établissements pour commencer.',
                  )}
            </p>
          </div>
        ) : map ? (
          <div>
            <div className="border-b border-line-soft px-5 py-4 text-sm text-ink-muted">
              {l(
                `${points.length} of ${items.length} records on this page have coordinates. Locations do not indicate contact availability.`,
                `${points.length} établissements sur les ${items.length} de cette page sont géolocalisés. Les positions n’indiquent pas les droits de contact.`,
              )}
            </div>
            <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.7fr)]">
              {points.length ? (
                <ProspectMap
                  points={points}
                  selectedId={detail?.id}
                  onSelect={(p) => setDetail(items.find((r) => r.id === p.id) ?? null)}
                  className="h-[520px]"
                />
              ) : (
                <Alert tone="info" className="flex min-h-[260px] items-center">
                  {l(
                    'No coordinates on this page. The filtered records remain available in the results panel; add coordinates to place them on the map.',
                    'Aucune coordonnée sur cette page. Les établissements filtrés restent disponibles dans la liste ; ajoutez des coordonnées pour les placer sur la carte.',
                  )}
                </Alert>
              )}
              <aside className="max-h-[520px] overflow-y-auto rounded-xl border border-line-soft bg-surface-muted/50">
                <div className="sticky top-0 z-10 border-b border-line-soft bg-surface px-4 py-3">
                  <p className="text-sm font-bold text-navy">
                    {l('Filtered prospects', 'Résultats filtrés')}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {l('Select records or open a location.', 'Sélectionnez ou ouvrez une fiche.')}
                  </p>
                </div>
                <div className="divide-y divide-line-soft">
                  {items.map((r) => (
                    <div key={r.id} className="flex gap-3 p-3 hover:bg-brand-wash">
                      <input
                        type="checkbox"
                        className="mt-1 size-4 shrink-0 accent-brand"
                        checked={selected.has(r.id)}
                        disabled={
                          r.status !== 'active' ||
                          (!selected.has(r.id) && selected.size >= MAX_BATCH_SIZE)
                        }
                        aria-label={`${l('Select', 'Sélectionner')} ${r.name}`}
                        onChange={() => setSelected((s) => toggleRecord(s, r, MAX_BATCH_SIZE))}
                      />
                      <button
                        type="button"
                        className="min-w-0 text-left"
                        onClick={() => setDetail(r)}
                      >
                        <span className="block truncate text-sm font-bold text-navy hover:text-brand">
                          {r.name}
                        </span>
                        <span className="mt-0.5 block text-xs text-ink-muted">
                          {[r.postalCode, r.city].filter(Boolean).join(' ') || '—'}
                        </span>
                        {r.latitude === null || r.longitude === null ? (
                          <span className="mt-1 block text-[11px] text-warning">
                            {l('Missing map coordinates', 'Coordonnées manquantes')}
                          </span>
                        ) : null}
                      </button>
                    </div>
                  ))}
                </div>
              </aside>
            </div>
          </div>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-surface-muted text-sm text-ink-muted">
                <tr>
                  <th className="w-12 p-4">
                    <input
                      ref={pageCheckbox}
                      type="checkbox"
                      className="size-4 accent-brand"
                      checked={allChecked}
                      disabled={!activePage.length || !!error}
                      aria-label={l(
                        'Select active prospects on this page',
                        'Sélectionner les établissements actifs de cette page',
                      )}
                      onChange={() => setSelected((s) => togglePage(s, activePage, MAX_BATCH_SIZE))}
                    />
                  </th>
                  <th className="px-4 py-3">{l('Establishment', 'Établissement')}</th>
                  <th className="hidden px-4 py-3 md:table-cell">
                    {l('Location', 'Localisation')}
                  </th>
                  <th className="hidden px-4 py-3 lg:table-cell">{l('Phone', 'Téléphone')}</th>
                  <th className="px-4 py-3">{l('Status', 'Statut')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {items.map((r) => (
                  <tr
                    key={r.id}
                    className={selected.has(r.id) ? 'bg-brand-tint' : 'hover:bg-surface-muted'}
                  >
                    <td className="p-4">
                      <input
                        type="checkbox"
                        className="size-4 accent-brand"
                        checked={selected.has(r.id)}
                        disabled={
                          !!error ||
                          r.status !== 'active' ||
                          (!selected.has(r.id) && selected.size >= MAX_BATCH_SIZE)
                        }
                        aria-label={`${l('Select', 'Sélectionner')} ${r.name}`}
                        onChange={() => setSelected((s) => toggleRecord(s, r, MAX_BATCH_SIZE))}
                      />
                    </td>
                    <td className="max-w-[240px] px-4 py-4 sm:max-w-none">
                      <button
                        type="button"
                        className="text-left text-[14px] font-bold text-navy hover:text-brand"
                        onClick={() => setDetail(r)}
                      >
                        {r.name}
                      </button>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {r.category ? CATEGORY_LABELS[r.category] : '—'}
                      </p>
                      <p className="mt-1 text-sm text-ink-muted md:hidden">
                        {[r.postalCode, r.city].filter(Boolean).join(' ')}
                      </p>
                    </td>
                    <td className="hidden px-4 py-4 text-sm md:table-cell">
                      <p>{r.city ?? '—'}</p>
                      <p className="text-ink-muted">{r.postalCode ?? '—'}</p>
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-4 text-sm lg:table-cell">
                      {r.phone ?? '—'}
                    </td>
                    <td className="px-4 py-4">
                      <Badge tone={r.status === 'active' ? 'success' : 'neutral'}>
                        {r.status === 'active'
                          ? l('Active', 'Actif')
                          : r.status === 'inactive'
                            ? l('Inactive', 'Inactif')
                            : l('Archived', 'Archivé')}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {items && items.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft px-5 py-4">
            <span className="text-sm text-ink-muted">
              {l(
                `${items.length.toLocaleString(locale)} shown`,
                `${items.length.toLocaleString(locale)} affichés`,
              )}
            </span>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={!query.cursor}
                onClick={() => {
                  const old = [...previous];
                  const cursor = old.pop() ?? '';
                  setPrevious(old);
                  update({ cursor }, true);
                }}
              >
                {previous.length ? l('Previous', 'Précédent') : l('First page', 'Première page')}
              </Button>
              <Button
                variant="secondary"
                disabled={!nextCursor || !!error}
                onClick={() => {
                  setPrevious((p) => [...p, query.cursor ?? '']);
                  update({ cursor: nextCursor ?? '' }, true);
                }}
              >
                {l('Next', 'Suivant')}
              </Button>
            </div>
          </div>
        )}
      </Card>
      {detail && (
        <Drawer
          open
          title={detail.name}
          onClose={() => setDetail(null)}
          footer={
            <LinkButton href={`/admin/prospects/${detail.id}`}>
              {l('Open full record', 'Ouvrir la fiche complète')}
            </LinkButton>
          }
        >
          <div className="space-y-4">
            <Badge tone="brand">{detail.category ? CATEGORY_LABELS[detail.category] : '—'}</Badge>
            <dl className="space-y-3">
              {[
                [l('Address', 'Adresse'), detail.addressLine1],
                [l('Town', 'Commune'), [detail.postalCode, detail.city].filter(Boolean).join(' ')],
                [l('Phone', 'Téléphone'), detail.phone],
                [l('Website', 'Site internet'), detail.website],
                [l('Source ID', 'Identifiant source'), detail.externalReference],
              ].map(([label, value]) => (
                <div key={label} className="border-b border-line-soft pb-3">
                  <dt className="text-sm text-ink-muted">{label}</dt>
                  <dd className="break-words font-medium">{value || '—'}</dd>
                </div>
              ))}
            </dl>
            {detail.latitude === null && (
              <Alert tone="info">
                {l(
                  'No coordinates are available for this establishment.',
                  'Cet établissement ne dispose pas de coordonnées géographiques.',
                )}
              </Alert>
            )}
          </div>
        </Drawer>
      )}
      {batch && (
        <ProspectAssignmentDrawer
          records={batch}
          onClose={() => setBatch(null)}
          onAssigned={(count) => {
            setSelected(new Map());
            setNotice(l(`${count} prospects assigned.`, `${count} établissements attribués.`));
            void load();
          }}
        />
      )}
    </div>
  );
}
