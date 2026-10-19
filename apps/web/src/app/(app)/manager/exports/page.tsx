'use client';

import { useLiveRefresh } from '@/lib/live/use-live-refresh';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, FileDown, Plus } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Drawer } from '@/components/ui/drawer';
import { PageHeader } from '@/components/ui/page-header';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { ApiError } from '@/lib/api/api-error';
import {
  cancelExport,
  createExport,
  listExports,
  previewExport,
  requestExportDownload,
} from '@/lib/api/export-client';
import {
  canCancel,
  canDownload,
  describeFailure,
  exportStatusTone,
  exportTypeLabel,
  isExportRunning,
  type ExportFormat,
  type ExportJob,
  type ExportPreview,
  type ExportRequest,
  type ExportType,
} from '@/lib/api/export-types';
import { useAuth } from '@/lib/auth/auth-context';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { text } from '@/lib/workspace/copy';
import { notify } from '@/lib/notifications/notify';

/* Long enough not to hammer the API, short enough to feel live. */
const POLL_MS = 4000;

export default function ExportsPage() {
  const { language } = useTranslation();
  const l = (en: string, fr: string) => text(en, fr, language);
  const [jobs, setJobs] = useState<ExportJob[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    (signal?: AbortSignal): Promise<void> =>
      listExports({ limit: 50 }, signal)
        .then((page) => {
          if (!signal?.aborted) {
            setJobs(page.items);
            setError(null);
          }
        })
        .catch((caught: unknown) => {
          if (!signal?.aborted) {
            setJobs([]);
            setError(describeExportError(caught, language));
          }
        }),
    [language],
  );

  useLiveRefresh(load);

  useEffect(() => {
    const controller = new AbortController();

    void load(controller.signal);

    return () => controller.abort();
  }, [load]);

  /*
   * An export is produced asynchronously, so the list polls — but only while
   * something is actually moving. A settled list stops requesting.
   */
  const running = (jobs ?? []).some(isExportRunning);

  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!running) {
      return;
    }

    timer.current = setTimeout(() => void load(), POLL_MS);

    return () => clearTimeout(timer.current);
  }, [jobs, load, running]);

  async function download(job: ExportJob): Promise<void> {
    setBusy(`download-${job.id}`);
    setError(null);

    try {
      const issued = await requestExportDownload(job.id);

      /* The link is single-use and short-lived, so it is followed straight
       * away rather than rendered for the operator to click later. */
      window.location.assign(issued.url);
    } catch (caught) {
      setError(describeExportError(caught, language));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={l('Exports', 'Exports')}
        subtitle={l(
          'Take a controlled copy of assignments, activity or follow-ups',
          'Créez une copie contrôlée des attributions, activités ou relances',
        )}
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" className="mr-2 size-4" />
            {l('New export', 'Nouvel export')}
          </Button>
        }
      />

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <Card>
        <CardHeader
          title={l('Recent exports', 'Exports récents')}
          action={
            running ? (
              <span aria-live="polite" className="text-[13px] text-ink-muted">
                {l(
                  'Refreshing while an export is running…',
                  'Actualisation pendant la préparation d’un export…',
                )}
              </span>
            ) : undefined
          }
        />

        {jobs === null ? (
          <div className="flex flex-col gap-2" aria-busy="true">
            {[0, 1, 2].map((row) => (
              <div key={row} className="h-16 animate-pulse rounded-lg bg-line-soft" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="py-12 text-center">
            <FileDown aria-hidden="true" className="mx-auto size-8 text-line" />

            <p className="mt-3 text-[16px] font-semibold text-navy">
              {l('No exports yet', 'Aucun export pour le moment')}
            </p>

            <p className="mx-auto mt-2 max-w-md text-[15px] text-ink-muted">
              {l(
                'An export takes a snapshot of what you are authorised to see, and the file is released only while that authority still holds.',
                'Un export capture ce que vous êtes autorisé à voir et le fichier n’est libéré que tant que cette autorisation reste valide.',
              )}
            </p>

            <Button className="mt-5" onClick={() => setCreating(true)}>
              {l('Create an export', 'Créer un export')}
            </Button>
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-line-soft">
            {jobs.map((job) => (
              <li key={job.id} className="flex flex-wrap items-center gap-x-4 gap-y-2.5 py-3.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-navy">
                    {job.filename ?? exportTypeLabel(readType(job))}
                  </span>

                  <span className="block truncate text-[13px] text-ink-muted">
                    {formatTimestamp(job.createdAt)}
                    {job.rowCount !== null
                      ? ` · ${job.rowCount.toLocaleString()} ${l('rows', 'lignes')}`
                      : ''}
                    {job.expiresAt
                      ? ` · ${l('available until', 'disponible jusqu’au')} ${formatDate(job.expiresAt, language)}`
                      : ''}
                  </span>

                  {job.status === 'failed' ? (
                    <span className="mt-1 block text-[13px] text-danger">
                      {describeFailure(job)}
                    </span>
                  ) : null}
                </span>

                <Badge tone={exportStatusTone(job.status)} dot>
                  {job.status}
                </Badge>

                {canDownload(job) ? (
                  <Button
                    loading={busy === `download-${job.id}`}
                    disabled={busy !== null}
                    onClick={() => void download(job)}
                  >
                    <Download aria-hidden="true" className="mr-1.5 size-4" />
                    {l('Download', 'Télécharger')}
                  </Button>
                ) : null}

                {canCancel(job) ? (
                  <Button
                    variant="secondary"
                    loading={busy === `cancel-${job.id}`}
                    disabled={busy !== null}
                    onClick={() => {
                      setBusy(`cancel-${job.id}`);
                      setError(null);

                      cancelExport(job.id)
                        .then(() => load())
                        .catch((caught: unknown) => setError(describeExportError(caught, language)))
                        .finally(() => setBusy(null));
                    }}
                  >
                    {l('Cancel', 'Annuler')}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <Alert
          tone="info"
          className="mt-5"
          title={l(
            'Authority is re-checked at download.',
            'L’autorisation est vérifiée au téléchargement.',
          )}
        >
          {l(
            'The export records the access you had when you asked for it. If your access narrows before you download, the file is withheld rather than released.',
            'L’export enregistre vos accès au moment de la demande. S’ils sont réduits avant le téléchargement, le fichier reste bloqué.',
          )}
        </Alert>
      </Card>

      <CreateExportDrawer
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => {
          setCreating(false);
          notify.success(
            l(
              'Export queued. It will appear below as it is produced.',
              'Export ajouté à la file. Il apparaîtra ci-dessous une fois produit.',
            ),
            {
              id: 'export-queued',
            },
          );
          void load();
        }}
      />
    </div>
  );
}

function CreateExportDrawer({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { activeWorkspace } = useAuth();
  const { language } = useTranslation();
  const l = (en: string, fr: string) => text(en, fr, language);

  const [type, setType] = useState<ExportType>('activities');
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [preview, setPreview] = useState<ExportPreview | null>(null);
  const [busy, setBusy] = useState<'preview' | 'create' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setType('activities');
    setFormat('csv');
    setFrom('');
    setTo('');
    setPreview(null);
    setError(null);
    /* One key per opened form, so a retry cannot queue two exports. */
    setIdempotencyKey(crypto.randomUUID());
  }, [open]);

  const rangeInvalid = from !== '' && to !== '' && new Date(to) < new Date(from);

  function buildRequest(): ExportRequest {
    return {
      type,
      format,
      ...(from ? { from: new Date(from).toISOString() } : {}),
      ...(to ? { to: new Date(to).toISOString() } : {}),
      /* Scope to the active team so an export never quietly reaches wider
       * than the workspace the operator is looking at. */
      ...(activeWorkspace?.teamId ? { teamId: activeWorkspace.teamId } : {}),
    };
  }

  return (
    <Drawer open={open} title={l('New export', 'Nouvel export')} onClose={onClose}>
      <div className="flex flex-col gap-5">
        <SelectField
          label={l('What to export', 'Éléments à exporter')}
          value={type}
          disabled={busy !== null}
          onChange={(event) => {
            setType(event.target.value as ExportType);
            setPreview(null);
          }}
          options={[
            { value: 'activities', label: l('Activities', 'Activités') },
            { value: 'assignments', label: l('Assignments', 'Attributions') },
            { value: 'follow_ups', label: l('Follow-ups', 'Relances') },
          ]}
        />

        <SelectField
          label={l('Format', 'Format')}
          value={format}
          disabled={busy !== null}
          onChange={(event) => setFormat(event.target.value as ExportFormat)}
          options={[
            { value: 'csv', label: 'CSV' },
            { value: 'xlsx', label: 'Excel (xlsx)' },
          ]}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={l('From (optional)', 'Du (facultatif)')}
            type="date"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              setPreview(null);
            }}
            disabled={busy !== null}
          />

          <TextField
            label={l('To (optional)', 'Au (facultatif)')}
            type="date"
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              setPreview(null);
            }}
            error={
              rangeInvalid
                ? l('End date is before the start date', 'La date de fin précède la date de début')
                : null
            }
            disabled={busy !== null}
          />
        </div>

        {preview ? (
          <Alert
            tone={preview.rowCount === 0 ? 'warning' : 'info'}
            title={
              preview.rowCount === undefined
                ? l('Preview ready.', 'Aperçu prêt.')
                : preview.rowCount === 0
                  ? l('Nothing matches this request.', 'Aucun résultat pour cette demande.')
                  : `${preview.rowCount.toLocaleString()} ${l('rows would be exported.', 'lignes seraient exportées.')}`
            }
          >
            {preview.columns?.length
              ? `Columns: ${preview.columns.slice(0, 8).join(', ')}${preview.columns.length > 8 ? '…' : ''}`
              : l(
                  'Run the export to produce the file.',
                  'Lancez l’export pour produire le fichier.',
                )}
          </Alert>
        ) : null}

        {error ? <Alert tone="danger">{error}</Alert> : null}

        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            loading={busy === 'preview'}
            disabled={busy !== null || rangeInvalid}
            onClick={() => {
              setBusy('preview');
              setError(null);

              previewExport(buildRequest())
                .then(setPreview)
                .catch((caught: unknown) => setError(describeExportError(caught, language)))
                .finally(() => setBusy(null));
            }}
          >
            {l('Preview', 'Aperçu')}
          </Button>

          <Button
            loading={busy === 'create'}
            disabled={busy !== null || rangeInvalid || preview?.rowCount === 0}
            onClick={() => {
              setBusy('create');
              setError(null);

              createExport(buildRequest(), idempotencyKey ?? crypto.randomUUID())
                .then(() => {
                  setIdempotencyKey(null);
                  onCreated();
                })
                .catch((caught: unknown) => setError(describeExportError(caught, language)))
                .finally(() => setBusy(null));
            }}
          >
            {l('Queue export', 'Mettre en file')}
          </Button>
        </div>

        <p className="text-[13px] text-ink-muted">
          {l(
            'Preview is a dry run and creates nothing. Both are limited to what your workspace authorises.',
            'L’aperçu est une simulation et ne crée rien. Les deux opérations sont limitées à ce que votre espace autorise.',
          )}
        </p>
      </div>
    </Drawer>
  );
}

/** The request is stored as JSON; read the type back for a title. */
function readType(job: ExportJob): ExportType {
  const type = job.request?.type;

  return type === 'assignments' || type === 'follow_ups' ? type : 'activities';
}

function formatTimestamp(value: string): string {
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

function formatDate(value: string, language = 'en'): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString(language === 'fr' ? 'fr-FR' : 'en-GB', {
        day: 'numeric',
        month: 'short',
      });
}

function describeExportError(error: unknown, language = 'en'): string {
  const l = (en: string, fr: string) => text(en, fr, language);
  if (!(error instanceof ApiError)) {
    return l('Something went wrong. Please try again.', 'Une erreur est survenue. Réessayez.');
  }

  if (error.statusCode === 403) {
    return l(
      'Your access does not cover this export. It was not released.',
      'Votre accès ne couvre pas cet export. Il n’a pas été libéré.',
    );
  }

  if (error.statusCode === 404 || error.statusCode === 410) {
    return l(
      'This export is no longer available. Exports are kept for a limited time.',
      'Cet export n’est plus disponible. Les exports sont conservés pendant une durée limitée.',
    );
  }

  if (error.statusCode === 409) {
    return l(
      'This export changed while you were looking at it. Refresh and try again.',
      'Cet export a changé. Actualisez et réessayez.',
    );
  }

  if (error.statusCode === 400) {
    return error.messages.join(' ');
  }

  return l(
    'We could not reach the export service. Please try again.',
    'Impossible de joindre le service d’export. Réessayez.',
  );
}
