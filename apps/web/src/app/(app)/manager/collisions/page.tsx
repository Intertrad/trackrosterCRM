'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ShieldAlert, ShieldCheck, ShieldX, TriangleAlert } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Drawer } from '@/components/ui/drawer';
import { FilterSelect } from '@/components/ui/filter-select';
import { PageHeader } from '@/components/ui/page-header';
import { StatTile } from '@/components/ui/stat-tile';
import { TextField } from '@/components/ui/text-field';
import { ApiError } from '@/lib/api/api-error';
import { listCollisionEvents, requestCollisionOverride } from '@/lib/api/collision-client';
import {
  canRequestOverride,
  decisionLabel,
  decisionTone,
  isCollisionExpired,
  reasonLabel,
  type CollisionEvent,
  type CollisionReasonCode,
} from '@/lib/api/collision-types';

const MIN_REASON = 3;

export default function CollisionCentrePage() {
  const [events, setEvents] = useState<CollisionEvent[] | null>(null);
  const [reasonCode, setReasonCode] = useState<'all' | CollisionReasonCode>('all');
  const [decision, setDecision] = useState<'all' | 'blocked'>('all');
  const [selected, setSelected] = useState<CollisionEvent | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(
    (signal?: AbortSignal): Promise<void> =>
      listCollisionEvents({ limit: 100, ...(reasonCode === 'all' ? {} : { reasonCode }) }, signal)
        .then((page) => {
          if (!signal?.aborted) {
            setEvents(page.items);
            setReadError(null);
          }
        })
        .catch((caught: unknown) => {
          if (!signal?.aborted) {
            setEvents([]);
            setReadError(describeCollisionError(caught));
          }
        }),
    [reasonCode],
  );

  useEffect(() => {
    const controller = new AbortController();

    void load(controller.signal);

    return () => controller.abort();
  }, [load]);

  const visible = useMemo(() => {
    if (!events) {
      return [];
    }

    if (decision === 'blocked') {
      return events.filter(
        (event) => event.decision === 'block' || event.decision === 'require_override',
      );
    }

    return events;
  }, [decision, events]);

  const counts = useMemo(() => {
    const all = events ?? [];

    return {
      total: all.length,
      blocked: all.filter((event) => event.decision === 'block').length,
      overrides: all.filter((event) => event.decision === 'require_override').length,
      warned: all.filter((event) => event.decision === 'warn').length,
    };
  }, [events]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Collision centre"
        subtitle="What the anti-collision engine decided, and why"
      />

      {readError ? <Alert tone="danger">{readError}</Alert> : null}

      {notice ? <Alert tone="success">{notice}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={<ShieldCheck aria-hidden="true" className="size-5" />}
          tone="brand"
          value={events === null ? null : counts.total}
          label="Recorded decisions"
        />

        <StatTile
          icon={<ShieldX aria-hidden="true" className="size-5" />}
          tone={counts.blocked > 0 ? 'danger' : 'neutral'}
          value={events === null ? null : counts.blocked}
          label="Blocked"
        />

        <StatTile
          icon={<ShieldAlert aria-hidden="true" className="size-5" />}
          tone={counts.overrides > 0 ? 'warning' : 'neutral'}
          value={events === null ? null : counts.overrides}
          label="Override required"
        />

        <StatTile
          icon={<TriangleAlert aria-hidden="true" className="size-5" />}
          tone="neutral"
          value={events === null ? null : counts.warned}
          label="Warned"
        />
      </div>

      <Card>
        <CardHeader
          title="Collision events"
          action={
            <Link
              href="/manager/approvals"
              className="text-[14px] font-semibold text-brand hover:text-brand-hover"
            >
              Open approvals
            </Link>
          }
        />

        <div className="flex flex-wrap items-end gap-3">
          <FilterSelect
            label="Reason"
            value={reasonCode}
            options={[
              { value: 'all', label: 'All reasons' },
              { value: 'ACTIVE_RESERVATION', label: 'Active reservation' },
              { value: 'ACTIVE_ASSIGNMENT', label: 'Active assignment' },
              { value: 'PLANNED_ACTION', label: 'Planned action' },
              { value: 'RECENT_CONTACT', label: 'Recent contact' },
            ]}
            onChange={(value) => setReasonCode(value as 'all' | CollisionReasonCode)}
          />

          <FilterSelect
            label="Decision"
            value={decision}
            options={[
              { value: 'all', label: 'All decisions' },
              { value: 'blocked', label: 'Blocked or needs override' },
            ]}
            onChange={(value) => setDecision(value as 'all' | 'blocked')}
          />
        </div>

        {events === null ? (
          <div className="mt-5 flex flex-col gap-2" aria-busy="true">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="h-14 animate-pulse rounded-lg bg-line-soft" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <p className="py-10 text-center text-[15px] text-ink-muted">
            {events.length === 0
              ? 'The engine has not recorded a collision for your scope.'
              : 'No events match these filters.'}
          </p>
        ) : (
          <ul className="mt-5 flex flex-col gap-2.5">
            {visible.map((event) => {
              const expired = isCollisionExpired(event);

              return (
                <li key={event.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(event)}
                    className="w-full rounded-xl border border-line-soft px-3.5 py-3 text-left hover:border-brand"
                  >
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <Badge tone={decisionTone(event.decision)} dot>
                        {decisionLabel(event.decision)}
                      </Badge>

                      <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-navy">
                        {reasonLabel(event.reasonCode)}
                      </span>

                      {expired ? (
                        <Badge tone="neutral">Window closed</Badge>
                      ) : event.overrideable ? (
                        <Badge tone="brand">Overrideable</Badge>
                      ) : (
                        <Badge tone="neutral">Policy forbids override</Badge>
                      )}
                    </span>

                    <span className="mt-1 block text-[13px] text-ink-muted">
                      Detected {formatTimestamp(event.createdAt)} ·{' '}
                      {expired
                        ? `closed ${formatTimestamp(event.expiresAt)}`
                        : `open until ${formatTimestamp(event.expiresAt)}`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <CollisionDrawer
        event={selected}
        onClose={() => setSelected(null)}
        onRequested={(message) => {
          setNotice(message);
          setSelected(null);
          void load();
        }}
      />
    </div>
  );
}

function CollisionDrawer({
  event,
  onClose,
  onRequested,
}: {
  event: CollisionEvent | null;
  onClose: () => void;
  onRequested: (message: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);

  useEffect(() => {
    setReason('');
    setError(null);
    /* One key per opened event, so a retry cannot raise two requests. */
    setIdempotencyKey(event ? crypto.randomUUID() : null);
  }, [event]);

  if (!event) {
    return <Drawer open={false} title="Collision event" onClose={onClose} children={null} />;
  }

  const allowed = canRequestOverride(event);

  return (
    <Drawer
      open
      title="Collision event"
      onClose={onClose}
      headerAccessory={
        <Badge tone={decisionTone(event.decision)} dot>
          {decisionLabel(event.decision)}
        </Badge>
      }
    >
      <div className="flex flex-col gap-5">
        <dl className="flex flex-col gap-3">
          <Row label="Reason">{reasonLabel(event.reasonCode)}</Row>

          <Row label="Detected">{formatTimestamp(event.createdAt)}</Row>

          <Row label="Window closes">{formatTimestamp(event.expiresAt)}</Row>

          {event.policy.defaultCoolingOffMinutes !== undefined ? (
            <Row label="Cooling-off">{event.policy.defaultCoolingOffMinutes} minutes</Row>
          ) : null}

          {event.policy.evaluatorVersion !== undefined ? (
            <Row label="Policy version">{String(event.policy.evaluatorVersion)}</Row>
          ) : null}
        </dl>

        <Alert tone="info" title="Conflict detail is deliberately withheld.">
          The engine publishes its decision and reason, not the other team&apos;s work. Who holds
          the conflicting claim is never disclosed here.
        </Alert>

        {allowed ? (
          <section className="rounded-xl border border-line-soft bg-surface-muted p-4">
            <h3 className="text-[15px] font-bold text-navy">Request an override</h3>

            <p className="mt-1 text-[14px] text-ink-muted">
              This goes to approvals for a decision. The reason is recorded in the audit log.
            </p>

            <TextField
              label="Reason"
              className="mt-3"
              value={reason}
              onChange={(changed) => setReason(changed.target.value)}
              placeholder="Why this contact should proceed"
              maxLength={1000}
              disabled={busy}
              required
            />

            {error ? (
              <Alert tone="danger" className="mt-3">
                {error}
              </Alert>
            ) : null}

            <Button
              className="mt-4"
              loading={busy}
              disabled={reason.trim().length < MIN_REASON}
              onClick={() => {
                setBusy(true);
                setError(null);

                requestCollisionOverride(
                  event.id,
                  reason.trim(),
                  idempotencyKey ?? crypto.randomUUID(),
                )
                  .then(() => onRequested('Override request raised.'))
                  .catch((caught: unknown) => setError(describeCollisionError(caught)))
                  .finally(() => setBusy(false));
              }}
            >
              Request override
            </Button>
          </section>
        ) : (
          <Alert
            tone="warning"
            title={
              isCollisionExpired(event)
                ? 'This collision window has closed.'
                : 'Policy forbids an override for this conflict.'
            }
          >
            {isCollisionExpired(event)
              ? 'Re-attempt the contact to get a fresh decision from the engine.'
              : 'The reservation rule in force when this was detected does not allow a manager override.'}
          </Alert>
        )}
      </div>
    </Drawer>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      <dt className="min-w-32 text-[13px] font-semibold text-ink-muted">{label}</dt>

      <dd className="min-w-0 flex-1 text-[14px] text-ink">{children}</dd>
    </div>
  );
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

function describeCollisionError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return 'Something went wrong. Please try again.';
  }

  if (error.statusCode === 403) {
    return 'You are not authorized to act on this collision.';
  }

  if (error.statusCode === 409) {
    return 'This collision changed. Reload before requesting an override.';
  }

  if (error.statusCode === 400) {
    return error.messages.join(' ');
  }

  return 'We could not load collision events. Please try again.';
}
