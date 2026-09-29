'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Check,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleX,
  Info,
  ShieldAlert,
  X,
} from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, FieldRow } from '@/components/ui/card';
import { ApiError } from '@/lib/api/api-error';
import { decideOverrideRequest, getOverrideRequest } from '@/lib/api/override-client';
import {
  MAX_OVERRIDE_REASON,
  MIN_OVERRIDE_REASON,
  type OverrideDecision,
  type OverrideRequestDetail,
} from '@/lib/api/override-types';
import { cn } from '@/lib/ui/cn';
import { shortenId } from '@/lib/ui/person';

const REASON_LABELS: Record<string, string> = {
  NO_COLLISION: 'No collision detected',
  ACTIVE_RESERVATION: 'Another member holds an active reservation',
  ACTIVE_ASSIGNMENT: 'The prospect is owned by another active assignment',
  PLANNED_ACTION: 'A conflicting action is already planned',
  RECENT_CONTACT: 'The prospect was contacted too recently',
};

const STATUS_TONE = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  cancelled: 'neutral',
} as const;

export function OverrideRequestView({ requestId }: { requestId: string }) {
  const [detail, setDetail] = useState<OverrideRequestDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [pending, setPending] = useState<OverrideDecision | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      try {
        const result = await getOverrideRequest(requestId, signal);

        if (signal?.aborted) {
          return;
        }

        setDetail(result);
        setLoadError(null);
      } catch (caught) {
        if (signal?.aborted) {
          return;
        }

        setLoadError(
          caught instanceof ApiError && caught.statusCode === 404
            ? 'This override request is not in your scope.'
            : 'We could not load this request. Please try again.',
        );
      }
    },
    [requestId],
  );

  useEffect(() => {
    const controller = new AbortController();

    void load(controller.signal);

    return () => controller.abort();
  }, [load]);

  async function decide(decision: OverrideDecision): Promise<void> {
    const trimmed = reason.trim();

    if (trimmed.length < MIN_OVERRIDE_REASON) {
      setReasonError(`A reason of at least ${MIN_OVERRIDE_REASON} characters is required`);

      return;
    }

    setReasonError(null);
    setActionError(null);
    setPending(decision);

    try {
      const updated = await decideOverrideRequest(
        requestId,
        decision,
        trimmed,
        detail?.etag ?? null,
      );

      setDetail(updated);
      setReason('');
      setNotice(`Override ${updated.status}. The decision is now in the audit log.`);
    } catch (caught) {
      if (caught instanceof ApiError && caught.statusCode === 412) {
        /* Someone else decided it first; show them the current state. */
        setActionError('This request changed since you opened it. Reloading the latest state.');
        await load();
      } else if (caught instanceof ApiError && caught.statusCode === 409) {
        setActionError('This request has already been decided.');
        await load();
      } else if (caught instanceof ApiError && caught.statusCode === 403) {
        setActionError('You are not authorized to decide this request.');
      } else {
        setActionError('We could not record the decision. Please try again.');
      }
    } finally {
      setPending(null);
    }
  }

  if (loadError) {
    return (
      <div className="flex flex-col gap-5">
        <Alert tone="danger">{loadError}</Alert>

        <Link href="/manager/approvals" className="font-semibold text-brand hover:text-brand-hover">
          Back to approvals
        </Link>
      </div>
    );
  }

  if (!detail) {
    return <DetailSkeleton />;
  }

  const collision = detail.collision;
  const decided = detail.status !== 'pending';

  return (
    <div className="flex flex-col gap-5">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[14px]">
        <Link href="/manager/approvals" className="text-ink-muted hover:text-ink">
          Approvals
        </Link>

        <ChevronRight aria-hidden="true" className="size-4 text-line" />

        <span className="font-mono font-semibold text-ink">{shortenId(detail.id)}</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[30px] leading-tight font-bold tracking-[-0.025em] text-navy sm:text-[34px]">
              Override request
            </h1>

            <Badge tone={STATUS_TONE[detail.status]}>{detail.status}</Badge>
          </div>

          <p className="mt-1.5 text-[15px] text-ink-soft">
            Requested by {shortenId(detail.requestedBy)} · {formatDateTime(detail.createdAt)}
          </p>
        </div>

        {!decided ? (
          <div className="flex shrink-0 gap-3">
            <Button
              variant="secondary"
              loading={pending === 'reject'}
              disabled={pending !== null}
              leadingIcon={<X aria-hidden="true" className="size-[18px]" />}
              onClick={() => void decide('reject')}
            >
              Reject
            </Button>

            <Button
              loading={pending === 'approve'}
              disabled={pending !== null}
              leadingIcon={<Check aria-hidden="true" className="size-[18px]" />}
              onClick={() => void decide('approve')}
            >
              Approve override
            </Button>
          </div>
        ) : null}
      </header>

      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {actionError ? <Alert tone="danger">{actionError}</Alert> : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] xl:items-start">
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader title="Request summary" />

            <dl className="divide-y divide-line-soft">
              <FieldRow label="Reason given">
                <span className="font-normal text-ink-soft">“{detail.reason}”</span>
              </FieldRow>

              <FieldRow label="Requester">{shortenId(detail.requestedBy)}</FieldRow>

              <FieldRow label="Prospect">{shortenId(detail.campaignProspectId)}</FieldRow>

              <FieldRow label="Campaign">{shortenId(collision.campaignId)}</FieldRow>

              <FieldRow label="Raised">{formatDateTime(detail.createdAt)}</FieldRow>
            </dl>
          </Card>

          {decided ? (
            <Card>
              <CardHeader title="Decision" />

              <dl className="divide-y divide-line-soft">
                <FieldRow label="Outcome">
                  <Badge tone={STATUS_TONE[detail.status]}>{detail.status}</Badge>
                </FieldRow>

                <FieldRow label="Decided by">
                  {detail.decidedBy ? shortenId(detail.decidedBy) : '—'}
                </FieldRow>

                <FieldRow label="Decided at">
                  {detail.decidedAt ? formatDateTime(detail.decidedAt) : '—'}
                </FieldRow>

                <FieldRow label="Reason">
                  <span className="font-normal text-ink-soft">{detail.decisionReason ?? '—'}</span>
                </FieldRow>

                {detail.approval ? (
                  <FieldRow label="Override expires">
                    {detail.approval.expiresAt
                      ? formatDateTime(detail.approval.expiresAt)
                      : 'No expiry'}
                  </FieldRow>
                ) : null}
              </dl>
            </Card>
          ) : null}
        </div>

        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader title="Policy evaluation" />

            <div
              className={cn(
                'flex items-start gap-3 rounded-lg border px-4 py-3',
                collision.overrideable
                  ? 'border-warning-border bg-warning-bg'
                  : 'border-danger-border bg-danger-bg',
              )}
            >
              {collision.overrideable ? (
                <ShieldAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warning" />
              ) : (
                <CircleX aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-danger" />
              )}

              <div className="min-w-0 text-[14px]">
                <p className="font-semibold text-navy">
                  {collision.overrideable
                    ? 'Manager decision required'
                    : 'This collision cannot be overridden'}
                </p>

                <p className="text-ink-soft">
                  {REASON_LABELS[collision.reasonCode ?? ''] ?? 'Collision detected.'}
                </p>
              </div>
            </div>

            <ul className="mt-4 flex flex-col gap-2.5 text-[14px]">
              <PolicyRow
                label="Server decision"
                value={collision.decision ?? 'unknown'}
                passed={false}
              />

              <PolicyRow
                label="Overrideable"
                value={collision.overrideable ? 'Yes' : 'No'}
                passed={collision.overrideable}
              />

              {collision.policy.defaultCoolingOffMinutes !== undefined ? (
                <PolicyRow
                  label="Cooling-off policy"
                  value={`${collision.policy.defaultCoolingOffMinutes} min`}
                  passed
                />
              ) : null}
            </ul>

            {collision.policy.evaluatorVersion ? (
              <p className="mt-3 text-[13px] text-ink-muted">
                Evaluator {collision.policy.evaluatorVersion} · detected{' '}
                {formatDateTime(collision.createdAt)}
              </p>
            ) : null}
          </Card>

          <Card>
            <CardHeader title="Conflict window" />

            <dl className="divide-y divide-line-soft">
              <FieldRow label="Detected by">{shortenId(collision.detectedBy)}</FieldRow>

              <FieldRow label="Detected at">{formatDateTime(collision.createdAt)}</FieldRow>

              <FieldRow label="Expires">
                {collision.expiresAt ? formatDateTime(collision.expiresAt) : 'No expiry'}
              </FieldRow>
            </dl>
          </Card>

          {!decided ? (
            <Card>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-[19px] font-bold tracking-[-0.015em] text-navy">
                  Decision reason
                </h2>

                <span className="text-[13px] font-semibold text-danger">Required</span>
              </div>

              <label htmlFor="decision-reason" className="sr-only">
                Decision reason
              </label>

              <textarea
                id="decision-reason"
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value.slice(0, MAX_OVERRIDE_REASON));
                  setReasonError(null);
                }}
                rows={5}
                disabled={pending !== null}
                aria-invalid={reasonError ? true : undefined}
                placeholder="Explain why this exception is justified..."
                className={cn(
                  'w-full rounded-lg border bg-surface px-3.5 py-3 text-[15px] text-ink placeholder:text-ink-muted',
                  reasonError ? 'border-danger' : 'border-line hover:border-brand-pale',
                )}
              />

              <div className="mt-1.5 flex items-baseline justify-between gap-3">
                {reasonError ? (
                  <p className="text-[13px] font-medium text-danger">{reasonError}</p>
                ) : (
                  <span />
                )}

                <p className="text-[13px] text-ink-muted">
                  {reason.length} / {MAX_OVERRIDE_REASON}
                </p>
              </div>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Audit notice" />

            <p className="flex items-start gap-3 text-[14px] text-ink-soft">
              <Info aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand" />
              Your decision is written to an immutable audit log with timestamp, reason and affected
              members. It cannot be undone.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function PolicyRow({ label, value, passed }: { label: string; value: string; passed: boolean }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2.5 text-ink-soft">
        {passed ? (
          <CircleCheck aria-hidden="true" className="size-[18px] text-success" />
        ) : (
          <CircleAlert aria-hidden="true" className="size-[18px] text-warning" />
        )}
        {label}
      </span>

      <span className="rounded-md bg-surface-muted px-2 py-0.5 text-[13px] font-semibold text-ink-soft capitalize">
        {value}
      </span>
    </li>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading override request…</span>

      <div className="h-5 w-44 rounded bg-line-soft" />
      <div className="h-10 w-2/3 rounded bg-line-soft" />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="h-72 rounded-xl bg-line-soft" />
        <div className="h-72 rounded-xl bg-line-soft" />
      </div>
    </div>
  );
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
