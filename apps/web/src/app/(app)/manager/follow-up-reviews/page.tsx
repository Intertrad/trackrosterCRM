'use client';

import { useLiveRefresh } from '@/lib/live/use-live-refresh';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Clock3, XCircle } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ApiError } from '@/lib/api/api-error';
import { decideFollowUpReview, listFollowUpReviews } from '@/lib/api/follow-up-review-client';
import type {
  FollowUpReviewDecision,
  FollowUpReviewSummary,
} from '@/lib/api/follow-up-review-types';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { text } from '@/lib/workspace/copy';

export default function FollowUpReviewsPage() {
  const { language, locale } = useTranslation();
  const l = (en: string, fr: string) => text(en, fr, language);
  const [items, setItems] = useState<FollowUpReviewSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      try {
        const next = await listFollowUpReviews(signal);

        if (signal?.aborted) return;

        setItems(next);
        setError(null);
      } catch (caught) {
        if (signal?.aborted) return;

        setError(describeLoadError(caught, language));
      }
    },
    [language],
  );

  useLiveRefresh(load);

  useEffect(() => {
    const controller = new AbortController();
    setItems(null);
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function decide(item: FollowUpReviewSummary, decision: FollowUpReviewDecision) {
    const reason = reasons[item.id]?.trim() ?? '';

    if (reason.length < 3) {
      setError(
        l(
          'Add a decision reason before approving, completing, or rejecting a request.',
          'Ajoutez un motif avant d’approuver, de terminer ou de refuser une demande.',
        ),
      );
      return;
    }

    setBusy(`${item.id}:${decision}`);
    setError(null);
    setNotice(null);

    try {
      await decideFollowUpReview({ reviewId: item.id, decision, reason });
      setNotice(
        decision === 'approved'
          ? l('Follow-up rescheduled.', 'Relance reprogrammée.')
          : decision === 'completed'
            ? l(
                'Follow-up marked late completed and added to performance.',
                'Relance marquée comme terminée en retard et ajoutée aux performances.',
              )
            : l('Reschedule request rejected.', 'Demande de reprogrammation refusée.'),
      );
      await load();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : l('The decision could not be saved.', 'Impossible d’enregistrer la décision.'),
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={l('Follow-up reviews', 'Validation des relances')}
        subtitle={l(
          'Review overdue follow-ups before rescheduling or recording a late completion',
          'Examinez les relances en retard avant de les reprogrammer ou d’enregistrer un retard',
        )}
      />

      {error ? (
        <Alert tone="danger">
          {error}
          <Button variant="secondary" size="md" className="mt-3" onClick={() => void load()}>
            {l('Try again', 'Réessayer')}
          </Button>
        </Alert>
      ) : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      {items === null && !error ? (
        <Card>
          <div className="flex flex-col gap-3" aria-busy="true">
            {[0, 1, 2].map((row) => (
              <div key={row} className="h-28 animate-pulse rounded-lg bg-line-soft" />
            ))}
          </div>
        </Card>
      ) : items === null ? (
        <Card>
          <div className="py-12 text-center">
            <Clock3 aria-hidden="true" className="mx-auto size-9 text-warning" />
            <p className="mt-3 text-[17px] font-bold text-navy">
              {l('Review queue unavailable', 'File de validation indisponible')}
            </p>
            <p className="mt-1 text-[14px] text-ink-muted">
              {l(
                'The review list could not be loaded. Retry after the backend service is available.',
                'La liste des validations n’a pas pu être chargée. Réessayez lorsque le service est disponible.',
              )}
            </p>
          </div>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <div className="py-12 text-center">
            <CheckCircle2 aria-hidden="true" className="mx-auto size-9 text-success" />
            <p className="mt-3 text-[17px] font-bold text-navy">
              {l('No follow-up reviews pending', 'Aucune validation de relance en attente')}
            </p>
            <p className="mt-1 text-[14px] text-ink-muted">
              {l(
                'Overdue follow-ups will appear here when a prospector requests a new date.',
                'Les relances en retard apparaîtront ici lorsqu’un prospecteur demandera une nouvelle date.',
              )}
            </p>
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <Card key={item.id} className="flex flex-col gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[17px] font-bold text-navy">{item.establishmentName}</h2>
                    <Badge tone="warning" dot>
                      {l('Overdue', 'En retard')}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[13px] text-ink-muted">
                    {item.campaignName} · {l('requested', 'demandée le')}{' '}
                    {formatDate(item.createdAt, locale)}
                  </p>
                </div>
                <Link
                  href={`/work-queue/${item.campaignId}/${item.prospectId}`}
                  className="text-[13px] font-semibold text-brand hover:underline"
                >
                  {l('Open prospect', 'Ouvrir le prospect')}
                </Link>
              </div>

              <div className="grid gap-3 rounded-lg border border-line-soft bg-surface-muted p-3 text-[14px] sm:grid-cols-2">
                <div>
                  <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-ink-muted">
                    {l('Missed reason', 'Motif du retard')}
                  </p>
                  <p className="mt-1 text-ink">{item.reason}</p>
                </div>
                <div className="flex items-start gap-2 text-ink-soft">
                  <Clock3 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
                  <p>
                    {l('Was due', 'Échéance')} {formatDate(item.previousDueAt, locale)}
                    <br />
                    {l('Requested for', 'Demandée pour')} {formatDate(item.requestedDueAt, locale)}
                  </p>
                </div>
              </div>

              <label className="flex flex-col gap-1.5 text-[13px] font-bold text-ink">
                {l('Decision reason', 'Motif de la décision')}
                <textarea
                  value={reasons[item.id] ?? ''}
                  onChange={(event) =>
                    setReasons((current) => ({ ...current, [item.id]: event.target.value }))
                  }
                  rows={2}
                  maxLength={1000}
                  placeholder={l(
                    'Explain the approval or rejection for the performance record.',
                    'Expliquez l’approbation ou le refus pour l’historique des performances.',
                  )}
                  className="w-full resize-none rounded-[9px] border border-line bg-surface px-3.5 py-3 text-[14px] font-normal text-ink placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-brand/30"
                />
              </label>

              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  variant="secondary"
                  disabled={busy !== null}
                  loading={busy === `${item.id}:rejected`}
                  leadingIcon={<XCircle aria-hidden="true" className="size-4" />}
                  onClick={() => void decide(item, 'rejected')}
                >
                  {l('Reject', 'Refuser')}
                </Button>
                <Button
                  disabled={busy !== null}
                  loading={busy === `${item.id}:approved`}
                  leadingIcon={<CheckCircle2 aria-hidden="true" className="size-4" />}
                  onClick={() => void decide(item, 'approved')}
                >
                  {l('Approve and reschedule', 'Approuver et reprogrammer')}
                </Button>
                <Button
                  disabled={busy !== null}
                  loading={busy === `${item.id}:completed`}
                  leadingIcon={<Clock3 aria-hidden="true" className="size-4" />}
                  onClick={() => void decide(item, 'completed')}
                >
                  {l('Complete as late', 'Terminer en retard')}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function describeLoadError(error: unknown, language: string): string {
  const l = (en: string, fr: string) => text(en, fr, language);
  if (error instanceof ApiError) {
    if (error.statusCode === 403) {
      return l(
        'You do not have manager approval authority for these follow-ups.',
        'Vous n’avez pas l’autorité de validation des managers pour ces relances.',
      );
    }
    if (error.statusCode === 0) {
      return l(
        'TrackRoster could not reach the API. Confirm the backend is running and try again.',
        'TrackRoster ne peut pas joindre l’API. Vérifiez que le backend fonctionne puis réessayez.',
      );
    }
    if (error.statusCode === 502 || error.statusCode === 503) {
      return l(
        'The backend service is unavailable. Start the API service and try again.',
        'Le service backend est indisponible. Démarrez l’API puis réessayez.',
      );
    }

    return error.requestId ? `${error.message} (request ${error.requestId})` : error.message;
  }

  return l(
    'We could not load follow-up reviews. Please try again.',
    'Impossible de charger les validations de relance. Réessayez.',
  );
}

function formatDate(value: string, locale?: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
