'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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
        title="Imports"
        subtitle="Upload, validate and commit prospect records"
        action={
          <Button loading={creating} onClick={() => void startImport()}>
            New import
          </Button>
        }
      />

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <Card>
        {jobs === null ? (
          <div className="flex flex-col gap-2" aria-busy="true">
            {[0, 1, 2].map((row) => (
              <div key={row} className="h-14 animate-pulse rounded-lg bg-line-soft" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-[16px] font-semibold text-navy">No imports yet</p>

            <p className="mx-auto mt-2 max-w-md text-[15px] text-ink-muted">
              An import takes a CSV of establishments and contacts through mapping, validation and
              de-duplication before anything reaches the active portfolio.
            </p>

            <Button className="mt-5" loading={creating} onClick={() => void startImport()}>
              Start an import
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
                      {job.filename ?? 'No file uploaded yet'}
                    </span>

                    <span className="block text-[13px] text-ink-muted">
                      {job.rowCount > 0 ? `${job.rowCount.toLocaleString()} rows · ` : ''}
                      Updated {formatDate(job.updatedAt)}
                    </span>
                  </span>

                  <ImportStatusBadge status={job.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="text-[17px] font-bold tracking-[-0.015em] text-navy">
          What an import accepts
        </h2>

        <p className="mt-2 text-[15px] text-ink-muted">
          A CSV of up to {MAX_IMPORT_ROWS.toLocaleString()} rows and{' '}
          {Math.round(MAX_IMPORT_FILE_BYTES / (1024 * 1024))} MB. Every row needs at least a name
          and a country code; everything else, including contact details, is optional. Rows that
          match an existing establishment are held back until you decide whether to reuse or skip
          them.
        </p>
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
