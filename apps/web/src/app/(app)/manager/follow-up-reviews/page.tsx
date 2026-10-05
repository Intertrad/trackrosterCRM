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

export default function FollowUpReviewsPage() {
  const [items, setItems] = useState<FollowUpReviewSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal): Promise<void> => {
    try {
      const next = await listFollowUpReviews(signal);

      if (signal?.aborted) return;

      setItems(next);
      setError(null);
    } catch (caught) {
      if (signal?.aborted) return;

      setError(
        caught instanceof ApiError && caught.statusCode === 403
          ? 'You do not have manager approval authority for these follow-ups.'
          : 'We could not load follow-up reviews. Please try again.',
      );
    }
  }, []);

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
      setError('Add a decision reason before approving, completing, or rejecting a request.');
      return;
    }

    setBusy(`${item.id}:${decision}`);
    setError(null);
    setNotice(null);

    try {
      await decideFollowUpReview({ reviewId: item.id, decision, reason });
      setNotice(
        decision === 'approved'
          ? 'Follow-up rescheduled.'
          : decision === 'completed'
            ? 'Follow-up marked late completed and added to performance.'
            : 'Reschedule request rejected.',
      );
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The decision could not be saved.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Follow-up reviews"
        subtitle="Review overdue follow-ups before rescheduling or recording a late completion"
      />

      {error ? (
        <Alert tone="danger">
          {error}
          <Button variant="secondary" size="md" className="mt-3" onClick={() => void load()}>
            Try again
          </Button>
        </Alert>
      ) : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      {items === null ? (
        <Card>
          <div className="flex flex-col gap-3" aria-busy="true">
            {[0, 1, 2].map((row) => (
              <div key={row} className="h-28 animate-pulse rounded-lg bg-line-soft" />
            ))}
          </div>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <div className="py-12 text-center">
            <CheckCircle2 aria-hidden="true" className="mx-auto size-9 text-success" />
            <p className="mt-3 text-[17px] font-bold text-navy">No follow-up reviews pending</p>
            <p className="mt-1 text-[14px] text-ink-muted">
              Overdue follow-ups will appear here when a prospector requests a new date.
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
                      Overdue
                    </Badge>
                  </div>
                  <p className="mt-1 text-[13px] text-ink-muted">
                    {item.campaignName} · requested {formatDate(item.createdAt)}
                  </p>
                </div>
                <Link
                  href={`/work-queue/${item.campaignId}/${item.prospectId}`}
                  className="text-[13px] font-semibold text-brand hover:underline"
                >
                  Open prospect
                </Link>
              </div>

              <div className="grid gap-3 rounded-lg border border-line-soft bg-surface-muted p-3 text-[14px] sm:grid-cols-2">
                <div>
                  <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-ink-muted">
                    Missed reason
                  </p>
                  <p className="mt-1 text-ink">{item.reason}</p>
                </div>
                <div className="flex items-start gap-2 text-ink-soft">
                  <Clock3 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
                  <p>
                    Was due {formatDate(item.previousDueAt)}
                    <br />
                    Requested for {formatDate(item.requestedDueAt)}
                  </p>
                </div>
              </div>

              <label className="flex flex-col gap-1.5 text-[13px] font-bold text-ink">
                Decision reason
                <textarea
                  value={reasons[item.id] ?? ''}
                  onChange={(event) =>
                    setReasons((current) => ({ ...current, [item.id]: event.target.value }))
                  }
                  rows={2}
                  maxLength={1000}
                  placeholder="Explain the approval or rejection for the performance record."
                  className="w-full resize-y rounded-[9px] border border-line bg-surface px-3.5 py-3 text-[14px] font-normal text-ink placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-brand/30"
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
                  Reject
                </Button>
                <Button
                  disabled={busy !== null}
                  loading={busy === `${item.id}:approved`}
                  leadingIcon={<CheckCircle2 aria-hidden="true" className="size-4" />}
                  onClick={() => void decide(item, 'approved')}
                >
                  Approve and reschedule
                </Button>
                <Button
                  disabled={busy !== null}
                  loading={busy === `${item.id}:completed`}
                  leadingIcon={<Clock3 aria-hidden="true" className="size-4" />}
                  onClick={() => void decide(item, 'completed')}
                >
                  Complete as late
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
