'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CircleAlert, CircleCheck, Copy, FileText, TriangleAlert, Users } from 'lucide-react';

import { AdminGuard } from '@/components/admin/admin-guard';
import { ImportStatusBadge, describeImportError } from '../page';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { FilterSelect } from '@/components/ui/filter-select';
import { PageHeader } from '@/components/ui/page-header';
import { SearchInput } from '@/components/ui/search-input';
import { SelectField } from '@/components/ui/select-field';
import { StatTile } from '@/components/ui/stat-tile';
import {
  cancelImport,
  commitImport,
  getImport,
  importReportUrl,
  listImportRows,
  resolveImportIssue,
  saveImportMapping,
  uploadImportFile,
  validateImport,
} from '@/lib/api/import-client';
import {
  IMPORT_HEADERS,
  MAX_IMPORT_FILE_BYTES,
  REQUIRED_IMPORT_HEADERS,
  commitBlockers,
  importSteps,
  type ImportHeader,
  type ImportIssueRecord,
  type ImportJob,
  type ImportRow,
} from '@/lib/api/import-types';
import { listImportIssues } from '@/lib/api/import-client';

type RowFilter = 'all' | 'ready' | 'warnings' | 'errors' | 'duplicates';

/* The rows endpoint is keyset by row number, so paging is exact here. */
const ROW_PAGE_SIZE = 25;

export default function ImportWizardPage({ params }: { params: Promise<{ importId: string }> }) {
  const { importId } = use(params);

  return (
    <AdminGuard title="Import" subtitle="Validate records before they enter the portfolio">
      <ImportWizard importId={importId} />
    </AdminGuard>
  );
}

function ImportWizard({ importId }: { importId: string }) {
  const router = useRouter();

  const [job, setJob] = useState<ImportJob | null>(null);
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [issues, setIssues] = useState<ImportIssueRecord[]>([]);
  const [afterRow, setAfterRow] = useState(0);
  const [nextAfterRow, setNextAfterRow] = useState<number | null>(null);

  const [readError, setReadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [filter, setFilter] = useState<RowFilter>('all');
  const [search, setSearch] = useState('');

  /* One key per logical write, retired only once the API confirms success. */
  const [keys] = useState(() => new Map<string, string>());

  function keyFor(action: string): string {
    const existing = keys.get(action);

    if (existing) {
      return existing;
    }

    const key = crypto.randomUUID();

    keys.set(action, key);

    return key;
  }

  const loadJob = useCallback(
    async (signal?: AbortSignal): Promise<ImportJob | null> => {
      try {
        const result = await getImport(importId, signal);

        if (signal?.aborted) {
          return null;
        }

        setJob(result.resource);
        setReadError(null);

        return result.resource;
      } catch (caught) {
        if (!signal?.aborted) {
          setReadError(describeImportError(caught));
        }

        return null;
      }
    },
    [importId],
  );

  const loadRows = useCallback(
    async (start: number, signal?: AbortSignal): Promise<void> => {
      try {
        const page = await listImportRows(
          importId,
          { afterRow: start, limit: ROW_PAGE_SIZE },
          signal,
        );

        if (signal?.aborted) {
          return;
        }

        setRows(page.items);
        setNextAfterRow(page.nextAfterRow);
      } catch {
        if (!signal?.aborted) {
          setRows([]);
        }
      }
    },
    [importId],
  );

  const loadIssues = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      try {
        const page = await listImportIssues(importId, { limit: 100 }, signal);

        if (!signal?.aborted) {
          setIssues(page.items);
        }
      } catch {
        if (!signal?.aborted) {
          setIssues([]);
        }
      }
    },
    [importId],
  );

  useEffect(() => {
    const controller = new AbortController();

    void loadJob(controller.signal).then((loaded) => {
      if (!loaded || controller.signal.aborted) {
        return;
      }

      if (loaded.status === 'validated' || loaded.status === 'committed') {
        void loadRows(0, controller.signal);
        void loadIssues(controller.signal);
      } else {
        setRows([]);
      }
    });

    return () => controller.abort();
  }, [loadIssues, loadJob, loadRows]);

  /* After any transition the parsed rows may have been discarded upstream, so
   * the job and its rows are always re-read together. */
  const refresh = useCallback(
    async (updated: ImportJob): Promise<void> => {
      setJob(updated);
      setAfterRow(0);

      if (updated.status === 'validated' || updated.status === 'committed') {
        await Promise.all([loadRows(0), loadIssues()]);
      } else {
        setRows([]);
        setIssues([]);
      }
    },
    [loadIssues, loadRows],
  );

  async function run(
    action: string,
    operation: () => Promise<ImportJob>,
    success: string,
  ): Promise<void> {
    setBusy(action);
    setActionError(null);
    setNotice(null);

    try {
      const updated = await operation();

      keys.delete(action);
      await refresh(updated);
      setNotice(success);
    } catch (caught) {
      setActionError(describeImportError(caught));
    } finally {
      setBusy(null);
    }
  }

  const steps = useMemo(() => importSteps(job), [job]);

  const issuesByRow = useMemo(() => {
    const map = new Map<string, ImportIssueRecord[]>();

    for (const issue of issues) {
      map.set(issue.rowId, [...(map.get(issue.rowId) ?? []), issue]);
    }

    return map;
  }, [issues]);

  const visibleRows = useMemo(() => {
    if (!rows) {
      return [];
    }

    const query = search.trim().toLowerCase();

    return rows.filter((row) => {
      if (filter === 'ready' && row.data.status !== 'valid') {
        return false;
      }

      if (filter === 'warnings' && row.data.status !== 'warning') {
        return false;
      }

      if (filter === 'errors' && row.data.status !== 'invalid') {
        return false;
      }

      if (filter === 'duplicates' && row.existingId === null) {
        return false;
      }

      if (query === '') {
        return true;
      }

      return [
        row.data.establishment?.name,
        row.data.establishment?.city,
        row.data.contact?.email,
        String(row.rowNumber),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [filter, rows, search]);

  const blockers = useMemo(() => (rows ? commitBlockers(rows) : []), [rows]);

  if (readError && !job) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Import" />

        <Alert tone="danger" title="We could not load this import.">
          {readError}
        </Alert>

        <div>
          <Link href="/admin/imports" className="text-[14px] font-semibold text-brand">
            Back to imports
          </Link>
        </div>
      </div>
    );
  }

  const summary = job?.summary ?? {};

  return (
    <div className="flex flex-col gap-6">
      <div>
        <nav aria-label="Breadcrumb" className="mb-2 text-[13px] text-ink-muted">
          <Link href="/admin/imports" className="font-semibold text-brand hover:underline">
            Imports
          </Link>{' '}
          / {job?.filename ?? 'New import'}
        </nav>

        <PageHeader
          title="Validate & import"
          subtitle="Review anomalies before prospects enter the active portfolio"
          action={job ? <ImportStatusBadge status={job.status} /> : undefined}
        />
      </div>

      <Stepper steps={steps} />

      {notice ? <Alert tone="success">{notice}</Alert> : null}

      {actionError ? <Alert tone="danger">{actionError}</Alert> : null}

      {job === null ? (
        <Card>
          <div className="flex flex-col gap-2" aria-busy="true">
            {[0, 1, 2].map((row) => (
              <div key={row} className="h-14 animate-pulse rounded-lg bg-line-soft" />
            ))}
          </div>
        </Card>
      ) : job.status === 'cancelled' ? (
        <Card>
          <Alert tone="info" title="This import was cancelled.">
            Its parsed rows were discarded. Start a new import to try again.
          </Alert>
        </Card>
      ) : job.status === 'committed' ? (
        <CommittedSummary job={job} />
      ) : !job.fileHash ? (
        <UploadStep
          busy={busy === 'upload'}
          onUpload={(file) =>
            run(
              'upload',
              () =>
                uploadImportFile(job.id, file, {
                  etag: job.etag,
                  idempotencyKey: keyFor('upload'),
                }),
              'File uploaded. Confirm the column mapping next.',
            )
          }
        />
      ) : job.status === 'uploaded' ? (
        <MappingStep
          job={job}
          busy={busy}
          onSave={(mapping) =>
            run(
              'mapping',
              () =>
                saveImportMapping(job.id, mapping, {
                  etag: job.etag,
                  idempotencyKey: keyFor('mapping'),
                }),
              'Mapping saved.',
            )
          }
          onValidate={() =>
            run(
              'validate',
              () =>
                validateImport(job.id, {
                  etag: job.etag,
                  idempotencyKey: keyFor('validate'),
                }),
              'File validated. Review the anomalies below.',
            )
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatTile
              icon={<FileText aria-hidden="true" className="size-5" />}
              tone="brand"
              value={summary.totalRows ?? job.rowCount}
              label="Total rows"
            />

            <StatTile
              icon={<CircleCheck aria-hidden="true" className="size-5" />}
              tone="success"
              value={summary.validRows ?? 0}
              label="Ready"
            />

            <StatTile
              icon={<TriangleAlert aria-hidden="true" className="size-5" />}
              tone="warning"
              value={summary.warningRows ?? 0}
              label="Warnings"
            />

            <StatTile
              icon={<CircleAlert aria-hidden="true" className="size-5" />}
              tone="danger"
              value={summary.invalidRows ?? 0}
              label="Errors"
            />

            <StatTile
              icon={<Copy aria-hidden="true" className="size-5" />}
              tone="neutral"
              value={summary.existingDuplicates ?? 0}
              label="Existing matches"
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] xl:items-start">
            <Card>
              <CardHeader title="Validation preview" />

              <div className="flex flex-col gap-4">
                <SearchInput
                  label="Search rows"
                  placeholder="Search rows, emails, establishments…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />

                <FilterSelect
                  label="Show"
                  value={filter}
                  options={[
                    { value: 'all', label: 'All rows' },
                    { value: 'ready', label: 'Ready' },
                    { value: 'warnings', label: 'Warnings' },
                    { value: 'errors', label: 'Errors' },
                    { value: 'duplicates', label: 'Existing matches' },
                  ]}
                  onChange={(value) => setFilter(value as RowFilter)}
                />
              </div>

              {rows === null ? (
                <div className="mt-5 flex flex-col gap-2" aria-busy="true">
                  {[0, 1, 2, 3].map((row) => (
                    <div key={row} className="h-12 animate-pulse rounded-lg bg-line-soft" />
                  ))}
                </div>
              ) : visibleRows.length === 0 ? (
                <p className="py-10 text-center text-[15px] text-ink-muted">
                  No rows match this filter on the current page.
                </p>
              ) : (
                <ul className="mt-5 flex flex-col gap-2.5">
                  {visibleRows.map((row) => (
                    <RowCard
                      key={row.id}
                      row={row}
                      issues={issuesByRow.get(row.id) ?? []}
                      busy={busy}
                      job={job}
                      onResolve={(issueId, resolution, action) =>
                        run(
                          action,
                          () =>
                            resolveImportIssue(issueId, resolution, {
                              etag: job.etag,
                              idempotencyKey: keyFor(action),
                            }),
                          resolution === 'skip'
                            ? 'Row skipped.'
                            : 'Existing establishment will be reused.',
                        )
                      }
                    />
                  ))}
                </ul>
              )}

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <p className="text-[13px] text-ink-muted">
                  Rows {afterRow + 1}–{afterRow + (rows?.length ?? 0)} of{' '}
                  {(summary.totalRows ?? job.rowCount).toLocaleString()}
                </p>

                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    disabled={afterRow === 0}
                    onClick={() => {
                      const previous = Math.max(0, afterRow - ROW_PAGE_SIZE);

                      setAfterRow(previous);
                      void loadRows(previous);
                    }}
                  >
                    Previous
                  </Button>

                  <Button
                    variant="secondary"
                    disabled={nextAfterRow === null}
                    onClick={() => {
                      if (nextAfterRow === null) {
                        return;
                      }

                      setAfterRow(nextAfterRow);
                      void loadRows(nextAfterRow);
                    }}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader title="Import readiness" />

              {blockers.length === 0 ? (
                <Alert tone="success" title="Every row on this page is ready.">
                  Commit applies the whole file in one transaction.
                </Alert>
              ) : (
                <Alert tone="danger" title="Resolve these before importing.">
                  <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5">
                    {blockers.map((blocker) => (
                      <li key={blocker}>{blocker}</li>
                    ))}
                  </ul>
                </Alert>
              )}

              <p className="mt-4 text-[13px] text-ink-muted">
                Blockers are counted from the {rows?.length ?? 0} rows loaded on this page. The API
                re-checks the whole file when you commit.
              </p>

              <Button
                fullWidth
                className="mt-5"
                loading={busy === 'commit'}
                disabled={busy !== null}
                onClick={() =>
                  void run(
                    'commit',
                    () =>
                      commitImport(job.id, {
                        etag: job.etag,
                        idempotencyKey: keyFor('commit'),
                      }),
                    'Import committed.',
                  )
                }
              >
                Import valid rows
              </Button>

              <Button
                variant="secondary"
                fullWidth
                className="mt-3"
                loading={busy === 'revalidate'}
                disabled={busy !== null}
                onClick={() =>
                  void run(
                    'revalidate',
                    () =>
                      validateImport(job.id, {
                        etag: job.etag,
                        idempotencyKey: keyFor('revalidate'),
                      }),
                    'File re-validated.',
                  )
                }
              >
                Re-validate
              </Button>

              <Button
                variant="secondary"
                fullWidth
                className="mt-3"
                loading={busy === 'cancel'}
                disabled={busy !== null}
                onClick={() =>
                  void run(
                    'cancel',
                    () =>
                      cancelImport(job.id, {
                        etag: job.etag,
                        idempotencyKey: keyFor('cancel'),
                      }),
                    'Import cancelled.',
                  ).then(() => router.refresh())
                }
              >
                Cancel import
              </Button>

              <Alert tone="info" className="mt-5" title="Commit is all or nothing.">
                The API applies the file in one transaction and refuses while any row has an error,
                duplicates another row in the file, or matches an existing establishment without a
                decision.
              </Alert>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Stepper({ steps }: { steps: ReturnType<typeof importSteps> }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-3 gap-y-3">
      {steps.map((step, index) => (
        <li key={step.id} className="flex items-center gap-3">
          <span className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className={
                step.state === 'complete'
                  ? 'flex size-8 items-center justify-center rounded-full border-2 border-success text-[13px] font-bold text-success'
                  : step.state === 'active'
                    ? 'flex size-8 items-center justify-center rounded-full bg-brand text-[13px] font-bold text-white'
                    : 'flex size-8 items-center justify-center rounded-full border-2 border-line text-[13px] font-bold text-ink-muted'
              }
            >
              {index + 1}
            </span>

            <span className="flex flex-col">
              <span className="text-[14px] font-bold text-navy">{step.label}</span>

              <span className="text-[12px] text-ink-muted">
                {step.state === 'complete'
                  ? 'Complete'
                  : step.state === 'active'
                    ? 'Active'
                    : 'Pending'}
              </span>
            </span>
          </span>

          {index < steps.length - 1 ? (
            <span aria-hidden="true" className="hidden h-px w-8 bg-line-soft sm:block" />
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function UploadStep({
  busy,
  onUpload,
}: {
  busy: boolean;
  onUpload: (file: File) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <Card>
      <CardHeader title="Upload a CSV" />

      <p className="-mt-3 mb-4 text-[15px] text-ink-muted">
        Up to 10,000 rows and 5 MB. Each row needs at least a name and a country code.
      </p>

      <input
        type="file"
        accept=".csv,text/csv"
        disabled={busy}
        onChange={(event) => {
          const chosen = event.target.files?.[0] ?? null;

          setError(null);

          if (chosen && chosen.size > MAX_IMPORT_FILE_BYTES) {
            setError('That file is larger than the 5 MB limit.');
            setFile(null);

            return;
          }

          setFile(chosen);
        }}
        className="block w-full cursor-pointer rounded-lg border border-line bg-surface px-3.5 py-3 text-[15px] text-ink file:mr-4 file:rounded-md file:border-0 file:bg-brand-tint file:px-3 file:py-1.5 file:text-[14px] file:font-semibold file:text-brand"
      />

      {error ? (
        <Alert tone="danger" className="mt-4">
          {error}
        </Alert>
      ) : null}

      <Button
        className="mt-5"
        loading={busy}
        disabled={!file}
        onClick={() => {
          if (file) {
            void onUpload(file);
          }
        }}
      >
        Upload file
      </Button>
    </Card>
  );
}

function MappingStep({
  job,
  busy,
  onSave,
  onValidate,
}: {
  job: ImportJob;
  busy: string | null;
  onSave: (mapping: Record<string, string>) => Promise<void>;
  onValidate: () => Promise<void>;
}) {
  const [mapping, setMapping] = useState<Record<string, string>>(job.mapping);

  useEffect(() => setMapping(job.mapping), [job.mapping]);

  const missingRequired = REQUIRED_IMPORT_HEADERS.filter((header) => !mapping[header]);

  /* The API rejects a mapping that points two fields at one source column. */
  const duplicated = useMemo(() => {
    const used = new Map<string, number>();

    for (const value of Object.values(mapping)) {
      if (value) {
        used.set(value, (used.get(value) ?? 0) + 1);
      }
    }

    return [...used.entries()].filter(([, count]) => count > 1).map(([column]) => column);
  }, [mapping]);

  const mappingChanged = useMemo(
    () => JSON.stringify(mapping) !== JSON.stringify(job.mapping),
    [job.mapping, mapping],
  );

  return (
    <Card>
      <CardHeader title="Map columns" />

      <p className="-mt-3 mb-4 text-[15px] text-ink-muted">
        {job.filename} · {job.rowCount.toLocaleString()} rows. Columns whose name already matches a
        TrackRoster field were mapped for you.
      </p>

      {missingRequired.length > 0 ? (
        <Alert tone="warning" className="mb-4" title="Two fields are required.">
          Map a source column to {missingRequired.map(labelForHeader).join(' and ')} before
          validating.
        </Alert>
      ) : null}

      {duplicated.length > 0 ? (
        <Alert tone="danger" className="mb-4" title="A source column can only be used once.">
          {duplicated.join(', ')} {duplicated.length === 1 ? 'is' : 'are'} mapped more than once.
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {IMPORT_HEADERS.map((header) => (
          <SelectField
            key={header}
            label={`${labelForHeader(header)}${
              REQUIRED_IMPORT_HEADERS.includes(header) ? ' *' : ''
            }`}
            value={mapping[header] ?? ''}
            disabled={busy !== null}
            onChange={(event) => {
              const value = event.target.value;

              setMapping((current) => {
                const next = { ...current };

                if (value === '') {
                  delete next[header];
                } else {
                  next[header] = value;
                }

                return next;
              });
            }}
            options={[
              { value: '', label: 'Not imported' },
              ...job.headers.map((column) => ({ value: column, label: column })),
            ]}
          />
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button
          variant="secondary"
          loading={busy === 'mapping'}
          disabled={
            busy !== null || !mappingChanged || missingRequired.length > 0 || duplicated.length > 0
          }
          onClick={() => void onSave(mapping)}
        >
          Save mapping
        </Button>

        <Button
          loading={busy === 'validate'}
          disabled={busy !== null || mappingChanged || missingRequired.length > 0}
          title={mappingChanged ? 'Save the mapping first' : undefined}
          onClick={() => void onValidate()}
        >
          Validate file
        </Button>
      </div>
    </Card>
  );
}

function RowCard({
  row,
  issues,
  busy,
  job,
  onResolve,
}: {
  row: ImportRow;
  issues: ImportIssueRecord[];
  busy: string | null;
  job: ImportJob;
  onResolve: (issueId: string, resolution: 'skip' | 'reuse', action: string) => Promise<void>;
}) {
  const unresolved = issues.filter((issue) => issue.resolvedAt === null);

  /* Reuse is only accepted for a valid row that matches an existing record and
   * is not also a duplicate of another row in the same file. */
  const canReuse =
    row.existingId !== null &&
    row.data.status !== 'invalid' &&
    !row.data.issues.some((issue) => issue.code === 'duplicate_in_file');

  const target = unresolved[0];

  const editable = job.status === 'validated' && row.resolution === null && target !== undefined;

  return (
    <li
      className={
        row.data.status === 'invalid'
          ? 'rounded-xl border border-danger-border bg-danger-bg/40 px-3.5 py-3'
          : row.data.status === 'warning'
            ? 'rounded-xl border border-warning-border bg-warning-bg/40 px-3.5 py-3'
            : 'rounded-xl border border-line-soft px-3.5 py-3'
      }
    >
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <span className="w-12 shrink-0 text-[13px] tabular-nums text-ink-muted">
          #{row.rowNumber}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold text-navy">
            {row.data.establishment?.name ?? 'No establishment parsed'}
          </span>

          <span className="block truncate text-[13px] text-ink-muted">
            {[row.data.establishment?.city, row.data.contact?.email, row.data.establishment?.phone]
              .filter(Boolean)
              .join(' · ') || '—'}
          </span>
        </span>

        <RowStatusBadge row={row} />
      </div>

      {row.data.issues.length > 0 ? (
        <ul className="mt-2.5 flex flex-wrap gap-1.5 pl-16">
          {row.data.issues.map((issue) => (
            <li key={`${issue.code}-${issue.field ?? ''}`}>
              <Badge tone={issue.severity === 'error' ? 'danger' : 'warning'}>
                {issue.message}
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}

      {editable ? (
        <div className="mt-3 flex flex-wrap gap-2 pl-16">
          {canReuse ? (
            <Button
              variant="secondary"
              loading={busy === `reuse-${target.id}`}
              disabled={busy !== null}
              onClick={() => void onResolve(target.id, 'reuse', `reuse-${target.id}`)}
            >
              Reuse existing
            </Button>
          ) : null}

          <Button
            variant="secondary"
            loading={busy === `skip-${target.id}`}
            disabled={busy !== null}
            onClick={() => void onResolve(target.id, 'skip', `skip-${target.id}`)}
          >
            Skip row
          </Button>
        </div>
      ) : null}
    </li>
  );
}

function RowStatusBadge({ row }: { row: ImportRow }) {
  if (row.result) {
    return <Badge tone={row.result === 'skipped' ? 'neutral' : 'success'}>{row.result}</Badge>;
  }

  if (row.resolution === 'skip') {
    return <Badge tone="neutral">Will skip</Badge>;
  }

  if (row.resolution === 'reuse') {
    return <Badge tone="brand">Will reuse</Badge>;
  }

  if (row.data.status === 'invalid') {
    return (
      <Badge tone="danger" dot>
        Error
      </Badge>
    );
  }

  if (row.existingId !== null) {
    return (
      <Badge tone="warning" dot>
        Existing match
      </Badge>
    );
  }

  if (row.data.status === 'warning') {
    return (
      <Badge tone="warning" dot>
        Warning
      </Badge>
    );
  }

  return (
    <Badge tone="success" dot>
      Ready
    </Badge>
  );
}

function CommittedSummary({ job }: { job: ImportJob }) {
  const summary = job.summary;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={<CircleCheck aria-hidden="true" className="size-5" />}
          tone="success"
          value={summary.createdEstablishments ?? 0}
          label="Establishments created"
        />

        <StatTile
          icon={<Copy aria-hidden="true" className="size-5" />}
          tone="brand"
          value={summary.reusedEstablishments ?? 0}
          label="Establishments reused"
        />

        <StatTile
          icon={<Users aria-hidden="true" className="size-5" />}
          tone="brand"
          value={summary.createdContacts ?? 0}
          label="Contacts created"
        />

        <StatTile
          icon={<FileText aria-hidden="true" className="size-5" />}
          tone="neutral"
          value={summary.skippedRows ?? 0}
          label="Rows skipped"
        />
      </div>

      <Card>
        <CardHeader title="Import complete" />

        <p className="-mt-3 text-[15px] text-ink-muted">
          {job.filename} was applied to this workspace. The per-row report lists what each row
          produced.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <a
            href={importReportUrl(job.id)}
            className="inline-flex h-12 items-center rounded-lg bg-brand px-5 text-[15px] font-semibold text-white hover:bg-brand-hover"
          >
            Download report
          </a>

          <Link
            href="/admin/imports"
            className="inline-flex h-12 items-center rounded-lg border border-line px-5 text-[15px] font-semibold text-ink hover:border-brand"
          >
            Back to imports
          </Link>
        </div>
      </Card>
    </div>
  );
}

function labelForHeader(header: ImportHeader): string {
  const words = header.replace(/_/g, ' ');

  return words.charAt(0).toUpperCase() + words.slice(1);
}
