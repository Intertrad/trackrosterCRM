'use client';

import { useCallback, useEffect, useState } from 'react';
import { MapPin, Phone, Search, X } from 'lucide-react';

import { AdminGuard } from '@/components/admin/admin-guard';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FilterSelect } from '@/components/ui/filter-select';
import { LinkButton } from '@/components/ui/link-button';
import { PageHeader } from '@/components/ui/page-header';
import { SearchInput } from '@/components/ui/search-input';
import { ApiError } from '@/lib/api/api-error';
import { CATEGORY_LABELS } from '@/lib/api/assignment-types';
import { ESTABLISHMENT_CATEGORIES, type EstablishmentCategory } from '@/lib/api/import-types';
import { listProspects } from '@/lib/api/prospect-client';
import {
  DEPARTMENT_SHAPE,
  PROSPECT_PAGE_SIZE,
  prospectDepartment,
  type Prospect,
  type ProspectQuery,
  type ProspectStatus,
} from '@/lib/api/prospect-types';
import { cn } from '@/lib/ui/cn';

/*
 * The shared établissement référentiel.
 *
 * Administration only, and that is the API's rule rather than a layout choice: an
 * establishment outside every campaign is visible to a tenant-scoped grant alone,
 * so organization- and team-scoped users reach prospects through campaign
 * membership instead. AdminGuard mirrors the guard upstream.
 *
 * Every filter is a query parameter. The base is 14,649 rows and a page is 50, so
 * a filter applied in the browser would search the page and report nothing for the
 * other 14,599 — the failure this screen exists to avoid.
 */
export default function ReferentialPage() {
  return (
    <AdminGuard
      title="Base de prospects"
      subtitle="The shared establishment référentiel, visible to administration only"
    >
      <Referential />
    </AdminGuard>
  );
}

const STATUS_OPTIONS: { value: ProspectStatus | 'all'; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'archived', label: 'Archived' },
  { value: 'all', label: 'Any status' },
];

function Referential() {
  const [search, setSearch] = useState('');
  /* What is actually sent — the server is asked once the typing settles. */
  const [appliedSearch, setAppliedSearch] = useState('');
  const [category, setCategory] = useState<EstablishmentCategory | ''>('');
  const [department, setDepartment] = useState('');
  const [city, setCity] = useState('');
  const [status, setStatus] = useState<ProspectStatus | 'all'>('active');
  const [sort, setSort] = useState<'name' | 'createdAt'>('name');

  /* Cursor pages, because the API pages by keyset and not by offset. */
  const [pages, setPages] = useState<string[]>([]);
  const [items, setItems] = useState<Prospect[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState<Prospect | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setAppliedSearch(search.trim()), 300);

    return () => clearTimeout(timer);
  }, [search]);

  const query: ProspectQuery = {
    ...(appliedSearch ? { search: appliedSearch } : {}),
    ...(category ? { category } : {}),
    /* A half-typed department is not a filter; `9` would be a 400 on its shape. */
    ...(DEPARTMENT_SHAPE.test(department) ? { department } : {}),
    ...(city.trim() ? { city: city.trim() } : {}),
    status,
    sort,
    limit: PROSPECT_PAGE_SIZE,
  };

  const cursor = pages.at(-1);

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      try {
        const page = await listProspects({ ...query, ...(cursor ? { cursor } : {}) }, signal);

        if (signal?.aborted) {
          return;
        }

        setItems(page.items);
        setNextCursor(page.nextCursor);
        setError(null);
      } catch (caught) {
        if (signal?.aborted) {
          return;
        }

        setItems([]);
        setNextCursor(null);
        setError(describeError(caught));
      }
    },
    [appliedSearch, category, department, city, status, sort, cursor],
  );

  useEffect(() => {
    const controller = new AbortController();

    setItems(null);
    void load(controller.signal);

    return () => controller.abort();
  }, [load]);

  /* Any filter change invalidates the cursor trail: it is keyed to the old query. */
  function narrow(change: () => void): void {
    change();
    setPages([]);
    setSelected(null);
  }

  const filtered = Boolean(appliedSearch || category || department.trim() || city.trim());

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Base de prospects"
        subtitle="The shared establishment référentiel, visible to administration only"
        action={
          <LinkButton href="/admin/campaigns" variant="secondary">
            Add to a campaign
          </LinkButton>
        }
      />

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <div className="flex flex-wrap items-center gap-2.5">
        <SearchInput
          label="Search the référentiel"
          placeholder="Name, address, postcode or commune…"
          value={search}
          onChange={(event) => narrow(() => setSearch(event.target.value))}
          className="min-w-[240px] flex-1"
        />

        <FilterSelect
          label="Section"
          value={category}
          onChange={(value) => narrow(() => setCategory(value as EstablishmentCategory | ''))}
          options={[
            { value: '', label: 'All sections' },
            ...ESTABLISHMENT_CATEGORIES.map((value) => ({
              value,
              label: CATEGORY_LABELS[value],
            })),
          ]}
        />

        <div className="relative">
          <label htmlFor="referential-department" className="sr-only">
            Department
          </label>

          <input
            id="referential-department"
            inputMode="numeric"
            maxLength={3}
            placeholder="Dept."
            value={department}
            onChange={(event) => narrow(() => setDepartment(event.target.value.replace(/\D/g, '')))}
            className="h-11 w-24 rounded-full border border-line bg-surface px-4 text-[14px] font-semibold text-ink transition-colors duration-150 hover:border-brand-pale"
          />
        </div>

        <div className="relative">
          <label htmlFor="referential-city" className="sr-only">
            Commune
          </label>

          <input
            id="referential-city"
            placeholder="Commune"
            value={city}
            onChange={(event) => narrow(() => setCity(event.target.value))}
            className="h-11 w-40 rounded-full border border-line bg-surface px-4 text-[14px] font-semibold text-ink transition-colors duration-150 hover:border-brand-pale"
          />
        </div>

        <FilterSelect
          label="Status"
          value={status}
          onChange={(value) => narrow(() => setStatus(value as ProspectStatus | 'all'))}
          options={STATUS_OPTIONS}
        />

        <FilterSelect
          label="Sort"
          value={sort}
          onChange={(value) => narrow(() => setSort(value as 'name' | 'createdAt'))}
          options={[
            { value: 'name', label: 'Name' },
            { value: 'createdAt', label: 'Newest' },
          ]}
        />
      </div>

      <div
        className={cn(
          'grid items-start gap-5',
          selected ? 'xl:grid-cols-[minmax(0,1fr)_minmax(0,380px)]' : 'grid-cols-1',
        )}
      >
        <Card className="p-0 sm:p-0">
          {items === null ? (
            <TableSkeleton />
          ) : items.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <Search aria-hidden="true" className="mx-auto mb-3 size-6 text-ink-muted" />

              <p className="text-[15px] text-ink-muted">
                {filtered
                  ? 'No establishment matches these filters.'
                  : 'The référentiel is empty. Import the prospect base to fill it.'}
              </p>
            </div>
          ) : (
            <>
              {/*
               * A table on a wide screen and stacked rows on a narrow one. Both
               * render the same row component so the two cannot drift.
               */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead className="hidden border-b border-line-soft sm:table-header-group">
                    <tr className="text-[13px] font-semibold text-ink-muted">
                      <th scope="col" className="px-5 py-3 sm:px-6">
                        Establishment
                      </th>
                      <th scope="col" className="px-3 py-3">
                        Section
                      </th>
                      <th scope="col" className="px-3 py-3">
                        Dept.
                      </th>
                      <th scope="col" className="px-3 py-3">
                        Commune
                      </th>
                      <th scope="col" className="px-3 py-3">
                        Contact
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-line-soft">
                    {items.map((prospect) => (
                      <tr
                        key={prospect.id}
                        onClick={() => setSelected(prospect)}
                        aria-selected={selected?.id === prospect.id}
                        className={cn(
                          'cursor-pointer align-middle transition-colors',
                          selected?.id === prospect.id ? 'bg-brand-wash' : 'hover:bg-surface-muted',
                        )}
                      >
                        <td className="px-5 py-3 sm:px-6">
                          <button
                            type="button"
                            className="text-left text-[15px] font-semibold text-navy"
                          >
                            {prospect.name}
                          </button>

                          {/* The narrow layout carries what the columns would. */}
                          <span className="block text-[13px] text-ink-muted sm:hidden">
                            {[
                              prospect.category ? CATEGORY_LABELS[prospect.category] : null,
                              [prospect.postalCode, prospect.city].filter(Boolean).join(' ') ||
                                null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </td>

                        <td className="hidden px-3 py-3 sm:table-cell">
                          {prospect.category ? (
                            <Badge tone="neutral">{CATEGORY_LABELS[prospect.category]}</Badge>
                          ) : (
                            <span className="text-[14px] text-ink-muted">—</span>
                          )}
                        </td>

                        <td className="hidden px-3 py-3 text-[14px] text-ink tabular-nums sm:table-cell">
                          {prospectDepartment(prospect.postalCode) ?? '—'}
                        </td>

                        <td className="hidden px-3 py-3 text-[14px] text-ink sm:table-cell">
                          {prospect.city ?? '—'}
                        </td>

                        <td className="hidden px-3 py-3 sm:table-cell">
                          <span className="flex items-center gap-2 text-[13px] text-ink-muted">
                            {prospect.phone ? (
                              <Phone aria-label="Has a phone number" className="size-4" />
                            ) : null}

                            {prospect.latitude !== null ? (
                              <MapPin aria-label="Has coordinates" className="size-4" />
                            ) : null}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/*
               * Keyset pages, so there is a next and a previous but no page
               * numbers: the API has no offset and a total over 14,649 rows would
               * be a second full scan on every request.
               */}
              <div className="flex items-center gap-3 border-t border-line-soft px-5 py-3 sm:px-6">
                <span className="text-[14px] text-ink-muted">
                  {items.length} shown{pages.length > 0 ? ` · page ${pages.length + 1}` : ''}
                </span>

                <div className="ml-auto flex gap-2">
                  <Button
                    variant="secondary"
                    disabled={pages.length === 0}
                    onClick={() => setPages((current) => current.slice(0, -1))}
                  >
                    Previous
                  </Button>

                  <Button
                    variant="secondary"
                    disabled={nextCursor === null}
                    onClick={() =>
                      setPages((current) => (nextCursor ? [...current, nextCursor] : current))
                    }
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>

        {selected ? <ProspectPanel prospect={selected} onClose={() => setSelected(null)} /> : null}
      </div>
    </div>
  );
}

/*
 * A quick view, not the record.
 *
 * It reads the row the listing already returned, so opening it costs no request
 * and browsing stays fast. Anything that needs another read — contacts, the
 * consent state, tags, custom fields — is on the full fiche, which this links to.
 * Two full detail implementations would be one too many.
 */
function ProspectPanel({ prospect, onClose }: { prospect: Prospect; onClose: () => void }) {
  const department = prospectDepartment(prospect.postalCode);

  return (
    <Card>
      <div className="mb-4 flex items-start gap-3">
        <h2 className="min-w-0 flex-1 text-[19px] font-bold tracking-[-0.015em] text-navy">
          {prospect.name}
        </h2>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close the detail panel"
          className="text-ink-muted hover:text-ink"
        >
          <X aria-hidden="true" className="size-5" />
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {prospect.category ? (
          <Badge tone="brand">{CATEGORY_LABELS[prospect.category]}</Badge>
        ) : null}

        <Badge tone={prospect.status === 'active' ? 'success' : 'neutral'}>{prospect.status}</Badge>

        {prospect.source === 'import' ? <Badge tone="neutral">Imported</Badge> : null}
      </div>

      <dl className="flex flex-col gap-2 text-[14px]">
        <Field label="Address">{prospect.addressLine1}</Field>
        <Field label="Commune">
          {[prospect.postalCode, prospect.city].filter(Boolean).join(' ') || null}
        </Field>
        <Field label="Department">{department}</Field>
        <Field label="Phone">{prospect.phone}</Field>
        <Field label="Website">{prospect.website}</Field>
        <Field label="Coordinates">
          {prospect.latitude !== null && prospect.longitude !== null
            ? `${prospect.latitude.toFixed(5)}, ${prospect.longitude.toFixed(5)}`
            : null}
        </Field>
        <Field label="Reference">{prospect.externalReference}</Field>
      </dl>

      {prospect.latitude === null ? (
        <Alert tone="info" className="mt-4">
          No coordinates, so this establishment cannot be placed on a map or routed to.
        </Alert>
      ) : null}

      <LinkButton
        href={`/admin/prospects/${prospect.id}`}
        variant="secondary"
        className="mt-4 w-full"
      >
        Open full record
      </LinkButton>
    </Card>
  );
}

/* A missing value is stated, not hidden: blank rows read as a loading failure. */
function Field({ label, children }: { label: string; children: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line-soft pb-2 last:border-0">
      <dt className="shrink-0 text-ink-muted">{label}</dt>
      <dd className="min-w-0 truncate text-right font-medium text-ink">{children ?? '—'}</dd>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="animate-pulse divide-y divide-line-soft" aria-hidden="true">
      {Array.from({ length: 8 }, (_, row) => (
        <div key={row} className="px-5 py-4 sm:px-6">
          <div className="h-4 w-1/3 rounded bg-surface-muted" />
        </div>
      ))}
    </div>
  );
}

function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.statusCode) {
      case 400:
        /* The API's message names the field it rejected. */
        return error.message || 'One of the filters is not valid.';

      case 401:
        return 'Your session has expired. Sign in again to continue.';

      case 403:
        return 'You do not have administrator access for this tenant.';

      default:
        return error.message || 'We could not load the référentiel.';
    }
  }

  return 'We could not load the référentiel.';
}
