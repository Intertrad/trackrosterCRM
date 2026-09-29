'use client';

import { useLiveRefresh } from '@/lib/live/use-live-refresh';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { text } from '@/lib/workspace/copy';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Upload } from 'lucide-react';

import { AdminGuard } from '@/components/admin/admin-guard';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ApiError } from '@/lib/api/api-error';
import { createImport, listImports } from '@/lib/api/import-client';
import {
  MAX_IMPORT_FILE_BYTES,
  MAX_IMPORT_ROWS,
  type ImportJob,
  type ImportStatus,
} from '@/lib/api/import-types';

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
        title={l('Imports', 'Import de données')}
        subtitle={l(
          'Upload, validate and commit prospect records',
          'Ajoutez des établissements, vérifiez les données puis confirmez l’import.',
        )}
      />
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
              : l('Import a CSV file', 'Importer un fichier CSV')}
          </span>
          <span className="text-sm text-ink-muted">
            {l(
              'Choose your file, map columns, then review before importing.',
              'Choisissez votre fichier, associez les colonnes puis vérifiez avant d’importer.',
            )}
          </span>
        </button>
        <p className="mt-3 rounded-[9px] bg-brand-tint px-3 py-2.5 text-sm text-brand">
          {l('CSV files up to', 'Fichiers CSV jusqu’à')} {MAX_IMPORT_ROWS.toLocaleString()}{' '}
          {l('rows and', 'lignes et')} {Math.round(MAX_IMPORT_FILE_BYTES / (1024 * 1024))} Mo.{' '}
          {l(
            'Nothing is added to the base before your confirmation.',
            'Aucune donnée n’est ajoutée à la base avant votre confirmation.',
          )}
        </p>
      </Card>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <Card>
        <h2 className="mb-3 text-base font-extrabold">
          {l('Previous imports', 'Imports précédents')}
        </h2>
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
                'CSV rows are mapped, validated and checked for duplicates before confirmation.',
                'Les lignes du CSV sont associées, validées et contrôlées pour détecter les doublons avant confirmation.',
              )}
            </p>

            <Button className="mt-5" loading={creating} onClick={() => void startImport()}>
              {l('Start an import', 'Préparer un import')}
            </Button>
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-line-soft">
            {jobs.map((job) => (
              <li key={job.id}>
                <Link
                  href={`/admin/imports/${job.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5 hover:opacity-80"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-navy">
                      {job.filename ?? l('No file uploaded yet', 'Aucun fichier déposé')}
                    </span>

                    <span className="block text-[13px] text-ink-muted">
                      {job.rowCount > 0 ? `${job.rowCount.toLocaleString()} rows · ` : ''}
                      {l('Updated', 'Modifié le')} {formatDate(job.updatedAt)}
                    </span>
                  </span>

                  <ImportStatusBadge status={job.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export function ImportStatusBadge({ status }: { status: ImportStatus }) {
  switch (status) {
    case 'committed':
      return <Badge tone="success">Committed</Badge>;
    case 'validated':
      return <Badge tone="warning">Awaiting commit</Badge>;
    case 'uploaded':
      return <Badge tone="brand">Needs validation</Badge>;
    case 'cancelled':
      return <Badge tone="neutral">Cancelled</Badge>;
    default:
      return <Badge tone="neutral">Draft</Badge>;
  }
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

export function describeImportError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return 'Something went wrong. Please try again.';
  }

  if (error.statusCode === 403) {
    return 'Imports require tenant administrator access.';
  }

  if (error.statusCode === 413) {
    return 'That file is larger than the 5 MB limit.';
  }

  if (error.statusCode === 409 || error.statusCode === 412) {
    return 'This import changed elsewhere. Reload the page before continuing.';
  }

  if (error.statusCode === 400) {
    return error.messages.join(' ');
  }

  return 'We could not reach TrackRoster. Please try again.';
}
