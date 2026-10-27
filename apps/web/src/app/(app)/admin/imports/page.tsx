'use client';

import { useLiveRefresh } from '@/lib/live/use-live-refresh';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { text } from '@/lib/workspace/copy';

import { createElement, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  GitMerge,
  Rows3,
  Upload,
  XCircle,
} from 'lucide-react';

import { AdminGuard } from '@/components/admin/admin-guard';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ImportStatusBadge, describeImportError } from '@/lib/api/import-ui';
import { createImport, listImports } from '@/lib/api/import-client';
import {
  MAX_IMPORT_FILE_BYTES,
  MAX_IMPORT_ROWS,
  type ImportJob,
  type ImportSummary,
} from '@/lib/api/import-types';

const IMPORT_HISTORY_PAGE_SIZE = 3;

export default function ImportsPage() {
  return (
    <AdminGuard title="Imports" subtitle="Bring prospect records into this workspace">
      <Imports />
    </AdminGuard>
  );
}

function Imports() {
  const { language } = useTranslation();
  const l = (en: string, fr: string) => text(en, fr, language);
  const router = useRouter();

  const [jobs, setJobs] = useState<ImportJob[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [historyPage, setHistoryPage] = useState(0);
  const historyPageCount = jobs
    ? Math.max(1, Math.ceil(jobs.length / IMPORT_HISTORY_PAGE_SIZE))
    : 1;
  const safeHistoryPage = Math.min(historyPage, historyPageCount - 1);

  const load = useCallback((signal?: AbortSignal): Promise<void> => {
    return listImports({ limit: 50 }, signal)
      .then((page) => {
        if (!signal?.aborted) {
          setJobs(page.items);
          setError(null);
        }
      })
      .catch((caught: unknown) => {
        if (!signal?.aborted) {
          setJobs([]);
          setError(describeImportError(caught));
        }
      });
  }, []);

  useLiveRefresh(load);

  useEffect(() => {
    const controller = new AbortController();

    void load(controller.signal);

    return () => controller.abort();
  }, [load]);

  async function startImport(): Promise<void> {
    /* Held across retries: a failed create must not leave two empty jobs. */
    const key = idempotencyKey ?? crypto.randomUUID();

    setIdempotencyKey(key);
    setCreating(true);
    setError(null);

    try {
      const job = await createImport(key);

      setIdempotencyKey(null);
      router.push(`/admin/imports/${job.id}`);
    } catch (caught) {
      setError(describeImportError(caught));
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={l('Imports', 'Imports')}
        subtitle={l(
          'Upload a CSV or Excel file, confirm its columns, then import prospect records',
          'Ajoutez un fichier CSV ou Excel, confirmez ses colonnes puis importez les établissements.',
        )}
      />

      <ImportFlowGuide language={language} />

      <Card>
        <h2 className="mb-3 text-base font-extrabold">
          {l('1. Prepare an import', '1. Préparer un import')}
        </h2>
        <button
          type="button"
          disabled={creating}
          onClick={() => void startImport()}
          className="flex min-h-32 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-pale bg-canvas px-5 py-6 hover:border-brand disabled:opacity-55"
        >
          <Upload className="size-5 text-brand" aria-hidden="true" />
          <span className="text-base font-bold">
            {creating
              ? l('Preparing…', 'Préparation…')
              : l('Import a CSV or Excel file', 'Importer un fichier CSV ou Excel')}
          </span>
          <span className="text-sm text-ink-muted">
            {l(
              'Choose a .csv or .xlsx file, confirm the column mapping, then review before importing.',
              'Choisissez un fichier .csv ou .xlsx, confirmez les colonnes puis vérifiez avant d’importer.',
            )}
          </span>
        </button>
        <p className="mt-3 rounded-[9px] bg-brand-tint px-3 py-2.5 text-sm text-brand">
          {l('CSV or Excel files up to', 'Fichiers CSV ou Excel jusqu’à')}{' '}
          {MAX_IMPORT_ROWS.toLocaleString()} {l('rows and', 'lignes et')}{' '}
          {Math.round(MAX_IMPORT_FILE_BYTES / (1024 * 1024))} Mo.{' '}
          {l(
            'Nothing is added to the base before your confirmation.',
            'Aucune donnée n’est ajoutée à la base avant votre confirmation.',
          )}
        </p>
      </Card>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <Card>
        <CardHeader
          title={l('Import history', 'Historique des imports')}
          action={
            jobs && jobs.length > 0 ? (
              <span className="rounded-full bg-brand-tint px-2.5 py-1 text-xs font-bold text-brand">
                {jobs.length} {l('runs', 'exécutions')}
              </span>
            ) : null
          }
        />
        {jobs === null ? (
          <div className="flex flex-col gap-2" aria-busy="true">
            {[0, 1, 2].map((row) => (
              <div key={row} className="h-14 animate-pulse rounded-lg bg-line-soft" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-[16px] font-semibold text-navy">
              {l('No imports yet', 'Aucun import pour le moment')}
            </p>

            <p className="mx-auto mt-2 max-w-md text-[15px] text-ink-muted">
              {l(
                'Rows are mapped, checked and reviewed for duplicates before confirmation.',
                'Les lignes sont associées, contrôlées et vérifiées pour détecter les doublons avant confirmation.',
              )}
            </p>

            <Button className="mt-5" loading={creating} onClick={() => void startImport()}>
              {l('Start an import', 'Préparer un import')}
            </Button>
          </div>
        ) : (
          <>
            <ImportHistoryTable
              jobs={jobs.slice(
                safeHistoryPage * IMPORT_HISTORY_PAGE_SIZE,
                safeHistoryPage * IMPORT_HISTORY_PAGE_SIZE + IMPORT_HISTORY_PAGE_SIZE,
              )}
              language={language}
            />
            <ImportHistoryPagination
              currentPage={safeHistoryPage}
              pageCount={historyPageCount}
              language={language}
              onPageChange={setHistoryPage}
            />
            <ImportQualitySummary jobs={jobs} language={language} />
          </>
        )}
      </Card>
    </div>
  );
}

function ImportFlowGuide({ language }: { language: Parameters<typeof text>[2] }) {
  const l = (en: string, fr: string) => text(en, fr, language);
  const steps = [
    {
      number: '1',
      title: l('Upload', 'Importer'),
      body: l(
        'Choose a CSV or Excel file and select the worksheet to use.',
        'Choisissez un fichier CSV ou Excel puis la feuille à utiliser.',
      ),
      icon: Upload,
    },
    {
      number: '2',
      title: l('Confirm columns', 'Confirmer les colonnes'),
      body: l(
        'We suggest matches from your headers and show sample values before you continue.',
        'Nous proposons les correspondances et affichons des exemples avant de continuer.',
      ),
      icon: FileSpreadsheet,
    },
    {
      number: '3',
      title: l('Review exceptions', 'Vérifier les exceptions'),
      body: l(
        'Missing optional fields stay visible. You only decide rows with a real conflict.',
        'Les champs optionnels manquants restent visibles. Vous décidez seulement pour les conflits.',
      ),
      icon: AlertTriangle,
    },
    {
      number: '4',
      title: l('Import once', 'Importer une fois'),
      body: l(
        'Nothing is written until you click Import. A report is available afterwards.',
        'Rien n’est écrit avant votre clic sur Importer. Un rapport est disponible ensuite.',
      ),
      icon: CheckCircle2,
    },
  ];

  return (
    <Card className="border-brand-pale bg-brand-tint/25">
      <div className="flex flex-col gap-1">
        <h2 className="text-[16px] font-extrabold text-navy">
          {l('A simple, safe import', 'Un import simple et sûr')}
        </h2>
        <p className="text-[14px] text-ink-muted">
          {l(
            'Four short steps. Optional information can be completed later.',
            'Quatre étapes courtes. Les informations optionnelles peuvent être complétées plus tard.',
          )}
        </p>
      </div>

      <ol className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {steps.map(({ number, title, body, icon }) => (
          <li key={number} className="rounded-xl border border-line-soft bg-surface px-3.5 py-3">
            <div className="flex items-center gap-2.5">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand text-[13px] font-bold text-white">
                {number}
              </span>
              {createElement(icon, { className: 'size-4 text-brand', 'aria-hidden': true })}
              <span className="text-[14px] font-bold text-navy">{title}</span>
            </div>
            <p className="mt-2 text-[13px] leading-5 text-ink-muted">{body}</p>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function ImportHistoryTable({
  jobs,
  language,
}: {
  jobs: ImportJob[];
  language: Parameters<typeof text>[2];
}) {
  const l = (en: string, fr: string) => text(en, fr, language);

  return (
    <div className="max-h-[15rem] overflow-auto overscroll-contain rounded-xl border border-line-soft">
      <table className="w-full min-w-[680px] table-fixed border-collapse text-left">
        <caption className="sr-only">{l('Import history', 'Historique des imports')}</caption>
        <colgroup>
          <col className="w-[29%]" />
          <col className="w-[17%]" />
          <col className="w-[10%]" />
          <col className="w-[21%]" />
          <col className="w-[11%]" />
          <col className="w-[12%]" />
        </colgroup>
        <thead className="sticky top-0 z-10 bg-canvas text-[11px] font-bold tracking-[0.08em] text-ink-muted uppercase">
          <tr>
            <th className="px-3 py-3">{l('File', 'Fichier')}</th>
            <th className="px-3 py-3">{l('Run', 'Exécution')}</th>
            <th className="px-3 py-3 text-right">{l('Rows', 'Lignes')}</th>
            <th className="px-3 py-3 text-right">
              {l('Merged / reused', 'Fusionnées / réutilisées')}
            </th>
            <th className="px-3 py-3 text-right">{l('Rejected', 'Rejetées')}</th>
            <th className="px-3 py-3">{l('State', 'État')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft bg-surface">
          {jobs.map((job) => {
            const summary = getSummary(job);
            const filename = job.filename ?? l('No file uploaded yet', 'Aucun fichier déposé');

            return (
              <tr key={job.id} className="align-middle transition-colors hover:bg-canvas">
                <td className="max-w-[280px] px-3 py-4">
                  <Link
                    href={`/admin/imports/${job.id}`}
                    className="group flex min-w-0 items-center gap-3"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-tint text-brand">
                      {isSpreadsheet(filename) ? (
                        <FileSpreadsheet className="size-4" aria-hidden="true" />
                      ) : (
                        <FileText className="size-4" aria-hidden="true" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-bold text-navy group-hover:text-brand">
                        {filename}
                      </span>
                      <span className="block truncate text-xs text-ink-muted">
                        {job.status === 'committed'
                          ? l('Import finished', 'Import terminé')
                          : l('Open to continue', 'Ouvrir pour continuer')}
                      </span>
                    </span>
                  </Link>
                </td>
                <td className="whitespace-nowrap px-3 py-4 text-[13px] text-ink-muted">
                  {formatDate(job.updatedAt)}
                </td>
                <td className="px-3 py-4 text-right text-[15px] font-bold tabular-nums text-navy">
                  {formatCount(summary.rows)}
                </td>
                <td className="px-3 py-4 text-right text-[15px] font-bold tabular-nums text-navy">
                  {formatCount(summary.reused)}
                </td>
                <td className="px-3 py-4 text-right text-[15px] font-bold tabular-nums text-navy">
                  <span className={summary.rejected > 0 ? 'text-warning' : undefined}>
                    {formatCount(summary.rejected)}
                  </span>
                </td>
                <td className="px-3 py-4">
                  <ImportStatusBadge status={job.status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ImportHistoryPagination({
  currentPage,
  pageCount,
  language,
  onPageChange,
}: {
  currentPage: number;
  pageCount: number;
  language: Parameters<typeof text>[2];
  onPageChange: (page: number) => void;
}) {
  const l = (en: string, fr: string) => text(en, fr, language);

  if (pageCount <= 1) return null;

  return (
    <nav
      className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-line-soft bg-canvas px-3 py-2"
      aria-label={l('Import history pages', 'Pages de l’historique des imports')}
    >
      <button
        type="button"
        onClick={() => onPageChange(Math.max(0, currentPage - 1))}
        disabled={currentPage === 0}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-bold text-brand hover:bg-brand-tint disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        {l('Previous', 'Précédent')}
      </button>
      <span className="text-xs font-semibold tabular-nums text-ink-muted">
        {l('Page', 'Page')} {currentPage + 1} {l('of', 'sur')} {pageCount}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(Math.min(pageCount - 1, currentPage + 1))}
        disabled={currentPage >= pageCount - 1}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-bold text-brand hover:bg-brand-tint disabled:cursor-not-allowed disabled:opacity-40"
      >
        {l('Next', 'Suivant')}
        <ChevronRight className="size-4" aria-hidden="true" />
      </button>
    </nav>
  );
}

function ImportQualitySummary({
  jobs,
  language,
}: {
  jobs: ImportJob[];
  language: Parameters<typeof text>[2];
}) {
  const l = (en: string, fr: string) => text(en, fr, language);
  /* Quality numbers describe completed imports only. Draft and validated runs
   * still need review and must not make the completed data look unhealthy. */
  const completedJobs = jobs.filter((job) => job.status === 'committed');
  const qualityJobs = completedJobs.length > 0 ? completedJobs : jobs;
  const aggregate = qualityJobs.reduce(
    (totals, job) => {
      const summary = getSummary(job);
      totals.rows += summary.rows;
      totals.reused += summary.reused;
      totals.rejected += summary.rejected;
      totals.contacts += numeric(summary.data.createdContacts);
      totals.issueCount += numeric(summary.data.issueCount);
      return totals;
    },
    { rows: 0, reused: 0, rejected: 0, contacts: 0, issueCount: 0 },
  );
  const accepted = Math.max(0, aggregate.rows - aggregate.rejected);
  const needsAttention = aggregate.rejected + aggregate.issueCount;

  const reasons = [
    {
      label: l('Rows skipped during confirmation', 'Lignes ignorées lors de la confirmation'),
      value: aggregate.rejected,
      icon: XCircle,
    },
    {
      label: l('Validation issues found', 'Anomalies détectées à la validation'),
      value: aggregate.issueCount,
      icon: AlertTriangle,
    },
    {
      label: l('Rows reused from the workspace', 'Lignes réutilisées dans l’espace'),
      value: aggregate.reused,
      icon: GitMerge,
    },
  ];

  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="rounded-xl border border-line-soft bg-canvas p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[15px] font-extrabold text-navy">
              {l('Why rows need attention', 'Pourquoi certaines lignes demandent une attention')}
            </h3>
            <p className="mt-1 text-xs text-ink-muted">
              {l(
                'Counts come from the import decisions already recorded by the API.',
                'Les compteurs proviennent des décisions déjà enregistrées par l’API.',
              )}
            </p>
          </div>
          <AlertTriangle className="size-5 shrink-0 text-warning" aria-hidden="true" />
        </div>
        <div className="divide-y divide-line-soft rounded-lg border border-line-soft bg-surface">
          {reasons.map(({ label, value, icon: iconComponent }) => {
            const ReasonIcon = iconComponent;

            return (
              <div key={label} className="flex items-center justify-between gap-4 px-3 py-3">
                <span className="flex min-w-0 items-center gap-2 text-[13px] text-ink">
                  <ReasonIcon className="size-4 shrink-0 text-ink-muted" aria-hidden="true" />
                  <span className="truncate">{label}</span>
                </span>
                <span className="text-[14px] font-bold tabular-nums text-navy">
                  {formatCount(value)}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-line-soft bg-canvas p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-[15px] font-extrabold text-navy">
              {l('Data quality after import', 'Qualité des données après import')}
            </h3>
            <p className="mt-1 text-xs text-ink-muted">
              {l(
                'A quick view across completed imports shown above.',
                'Une vue rapide des imports terminés affichés ci-dessus.',
              )}
            </p>
          </div>
          <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden="true" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <QualityMetric
            icon={Rows3}
            label={l('Rows processed', 'Lignes traitées')}
            value={aggregate.rows}
          />
          <QualityMetric
            icon={CheckCircle2}
            label={l('Rows accepted', 'Lignes acceptées')}
            value={accepted}
          />
          <QualityMetric
            icon={GitMerge}
            label={l('Reused', 'Réutilisées')}
            value={aggregate.reused}
          />
          <QualityMetric
            icon={FileText}
            label={l('New contacts', 'Nouveaux contacts')}
            value={aggregate.contacts}
          />
        </div>
        {needsAttention > 0 ? (
          <p className="mt-3 rounded-lg border border-warning-border bg-warning-bg px-3 py-2.5 text-[13px] leading-5 text-warning">
            {l(
              `${formatCount(needsAttention)} review item${needsAttention === 1 ? '' : 's'} recorded. Open an import to inspect the affected rows.`,
              `${formatCount(needsAttention)} élément${needsAttention === 1 ? '' : 's'} à examiner. Ouvrez un import pour inspecter les lignes concernées.`,
            )}
          </p>
        ) : (
          <p className="mt-3 rounded-lg border border-success-border bg-success-bg px-3 py-2.5 text-[13px] text-success">
            {l(
              'No skipped rows or validation issues are recorded.',
              'Aucune ligne ignorée ni anomalie de validation enregistrée.',
            )}
          </p>
        )}
      </section>
    </div>
  );
}

function QualityMetric({
  icon: iconComponent,
  label,
  value,
}: {
  icon: typeof Rows3;
  label: string;
  value: number;
}) {
  const MetricIcon = iconComponent;

  return (
    <div className="rounded-lg border border-line-soft bg-surface px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-xs text-ink-muted">
        <MetricIcon className="size-3.5" aria-hidden="true" />
        <span>{label}</span>
      </div>
      <p className="mt-1 text-lg font-extrabold tabular-nums text-navy">{formatCount(value)}</p>
    </div>
  );
}

function getSummary(job: ImportJob): {
  data: ImportSummary;
  rows: number;
  reused: number;
  rejected: number;
} {
  const data = job.summary ?? {};

  return {
    data,
    rows: numeric(data.totalRows) || job.rowCount,
    reused: numeric(data.reusedEstablishments),
    rejected: numeric(data.skippedRows),
  };
}

function numeric(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0;
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

function isSpreadsheet(filename: string): boolean {
  return /\.(csv|xlsx?|xlsm)$/i.test(filename);
}

function formatDate(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
}
