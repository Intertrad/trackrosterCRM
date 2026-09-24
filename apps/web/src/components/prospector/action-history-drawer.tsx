'use client';

import { useEffect, useState } from 'react';
import { History } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/drawer';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { ApiError } from '@/lib/api/api-error';
import { cancelAction, correctAction, listActionEvents } from '@/lib/api/action-client';
import {
  MAX_ACTION_NOTES,
  MAX_ACTION_REASON,
  OUTCOME_CODES,
  actionEventLabel,
  canCancelAction,
  canCorrectAction,
  type ActionEvent,
  type ActionStatus,
} from '@/lib/api/action-types';

type Mode = 'history' | 'cancel' | 'correct';

/**
 * The audit trail for one logged action, and the two ways it can be amended.
 *
 * A correction never rewrites what was first logged — the API appends a new
 * event, so both the original outcome and the corrected one stay visible.
 * That is the point of the screen: a prospector who mis-logged a visit can
 * put it right without the record pretending the mistake never happened.
 */
export function ActionHistoryDrawer({
  actionId,
  status,
  onClose,
  onChanged,
}: {
  actionId: string | null;
  status: ActionStatus | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [events, setEvents] = useState<ActionEvent[] | null>(null);
  const [mode, setMode] = useState<Mode>('history');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [outcomeCode, setOutcomeCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);

  useEffect(() => {
    setMode('history');
    setReason('');
    setNotes('');
    setOutcomeCode('');
    setError(null);
    setEvents(null);
    /* One key per opened action, so a retry replays rather than duplicates. */
    setIdempotencyKey(actionId ? crypto.randomUUID() : null);

    if (!actionId) {
      return;
    }

    const controller = new AbortController();

    listActionEvents(actionId, controller.signal)
      .then((page) => {
        if (!controller.signal.aborted) {
          setEvents(page.items);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setEvents([]);
          setError('We could not load this action’s history.');
        }
      });

    return () => controller.abort();
  }, [actionId]);

  if (!actionId || !status) {
    return <Drawer open={false} title="Action history" onClose={onClose} children={null} />;
  }

  function submit(): void {
    if (!actionId) {
      return;
    }

    const key = idempotencyKey ?? crypto.randomUUID();

    setBusy(true);
    setError(null);

    const request =
      mode === 'cancel'
        ? cancelAction(actionId, reason.trim(), key)
        : correctAction(
            actionId,
            {
              reason: reason.trim(),
              notes: notes.trim(),
              ...(outcomeCode ? { outcomeCode } : {}),
            },
            key,
          );

    request
      .then(() => {
        setIdempotencyKey(null);
        onChanged();
        onClose();
      })
      .catch((caught: unknown) => setError(describeActionError(caught)))
      .finally(() => setBusy(false));
  }

  const reasonReady = reason.trim().length > 0;
  const notesReady = mode !== 'correct' || notes.trim().length > 0;

  return (
    <Drawer
      open
      title="Action history"
      onClose={onClose}
      headerAccessory={<Badge tone="neutral">Append-only</Badge>}
    >
      <div className="flex flex-col gap-5">
        {mode === 'history' ? (
          <>
            {events === null ? (
              <div className="flex flex-col gap-2" aria-busy="true">
                {[0, 1, 2].map((row) => (
                  <div key={row} className="h-12 animate-pulse rounded-lg bg-line-soft" />
                ))}
              </div>
            ) : events.length === 0 ? (
              <p className="py-8 text-center text-[15px] text-ink-muted">
                No events have been recorded for this action.
              </p>
            ) : (
              <ol className="flex flex-col gap-2.5">
                {events.map((event) => (
                  <li key={event.id} className="rounded-xl border border-line-soft px-3.5 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[15px] font-semibold text-navy">
                        {actionEventLabel(event.eventType)}
                      </span>

                      <span className="text-[13px] text-ink-muted">
                        {formatTimestamp(event.occurredAt)}
                      </span>
                    </div>

                    {Object.keys(event.payload ?? {}).length > 0 ? (
                      <dl className="mt-2 flex flex-col gap-1">
                        {Object.entries(event.payload).map(([key, value]) => (
                          <div key={key} className="flex flex-wrap gap-x-3 text-[13px]">
                            <dt className="min-w-28 font-semibold text-ink-muted">{key}</dt>

                            <dd className="min-w-0 flex-1 break-words text-ink">
                              {formatValue(value)}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}

            {error ? <Alert tone="danger">{error}</Alert> : null}

            <div className="flex flex-wrap gap-3">
              {canCorrectAction(status) ? (
                <Button variant="secondary" onClick={() => setMode('correct')}>
                  <History aria-hidden="true" className="mr-2 size-4" />
                  Correct outcome
                </Button>
              ) : null}

              {canCancelAction(status) ? (
                <Button variant="danger" onClick={() => setMode('cancel')}>
                  Cancel action
                </Button>
              ) : null}
            </div>

            {!canCorrectAction(status) && !canCancelAction(status) ? (
              <Alert tone="info" title="This action can no longer be changed.">
                A cancelled action is final, and only a completed action can be corrected.
              </Alert>
            ) : null}
          </>
        ) : (
          <>
            <Alert
              tone={mode === 'cancel' ? 'warning' : 'info'}
              title={
                mode === 'cancel'
                  ? 'Cancelling closes this action without an outcome.'
                  : 'A correction is added, not substituted.'
              }
            >
              {mode === 'cancel'
                ? 'It stays in the history with the reason you give.'
                : 'The original entry stays in the history alongside the corrected one.'}
            </Alert>

            {mode === 'correct' ? (
              <>
                <SelectField
                  label="Corrected outcome (optional)"
                  value={outcomeCode}
                  disabled={busy}
                  onChange={(event) => setOutcomeCode(event.target.value)}
                  options={[
                    { value: '', label: 'Leave the outcome unchanged' },
                    ...OUTCOME_CODES.map((code) => ({
                      value: code,
                      label: code.replace(/_/g, ' '),
                    })),
                  ]}
                />

                <TextField
                  label="Corrected notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="What actually happened"
                  maxLength={MAX_ACTION_NOTES}
                  disabled={busy}
                  required
                />
              </>
            ) : null}

            <TextField
              label="Reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={
                mode === 'cancel'
                  ? 'Why this action is being cancelled'
                  : 'Why the original entry was wrong'
              }
              maxLength={MAX_ACTION_REASON}
              disabled={busy}
              required
            />

            {error ? <Alert tone="danger">{error}</Alert> : null}

            <div className="flex flex-wrap gap-3">
              <Button
                loading={busy}
                variant={mode === 'cancel' ? 'danger' : 'primary'}
                disabled={!reasonReady || !notesReady}
                onClick={submit}
              >
                {mode === 'cancel' ? 'Cancel action' : 'Save correction'}
              </Button>

              <Button variant="secondary" disabled={busy} onClick={() => setMode('history')}>
                Back
              </Button>
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '—';
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return JSON.stringify(value);
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

function describeActionError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return 'Something went wrong. Please try again.';
  }

  if (error.statusCode === 409) {
    return 'This action changed state. Reopen it to see where it stands now.';
  }

  if (error.statusCode === 403) {
    return 'You are not authorized to change this action.';
  }

  if (error.statusCode === 400) {
    return error.messages.join(' ');
  }

  return 'We could not save that change. Please try again.';
}
