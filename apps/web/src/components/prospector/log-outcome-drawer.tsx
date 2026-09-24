'use client';

import { useMemo, useState } from 'react';
import {
  Ban,
  CalendarPlus,
  CheckCircle2,
  FileText,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  XCircle,
} from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/drawer';
import { SelectField } from '@/components/ui/select-field';
import { ApiError } from '@/lib/api/api-error';
import {
  MAX_ACTION_NOTES,
  OUTCOMES_SUGGESTING_FOLLOW_UP,
  OUTCOME_LABELS,
  type ActionLifecycleStage,
  type ActionType,
  type OutcomeCode,
} from '@/lib/api/action-types';
import { completeAction, createAction, startAction } from '@/lib/api/action-client';
import type { ProspectReservationState } from '@/lib/api/work-queue-types';
import { cn } from '@/lib/ui/cn';

const CHANNELS: Array<{ value: ActionType; label: string; icon: typeof Phone }> = [
  { value: 'call', label: 'Call', icon: Phone },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'visit', label: 'Visit', icon: MapPin },
  { value: 'message', label: 'Message', icon: MessageCircle },
  { value: 'note', label: 'Note', icon: FileText },
];

const OUTCOME_ICONS: Partial<Record<OutcomeCode, typeof Phone>> = {
  no_answer: Phone,
  contacted: CheckCircle2,
  interested: CheckCircle2,
  qualified: CalendarPlus,
  converted: CheckCircle2,
  not_interested: XCircle,
  do_not_contact: Ban,
  completed: CheckCircle2,
};

const OFFERED_OUTCOMES: OutcomeCode[] = [
  'no_answer',
  'contacted',
  'interested',
  'qualified',
  'not_interested',
  'do_not_contact',
];

const LIFECYCLE_OPTIONS: Array<{ value: ActionLifecycleStage; label: string }> = [
  { value: 'contact_made', label: 'Contact made' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'converted', label: 'Converted' },
];

export function LogOutcomeDrawer({
  open,
  onClose,
  campaignId,
  prospectId,
  establishmentName,
  reservation,
  defaultChannel = 'call',
  onCompleted,
}: {
  open: boolean;
  onClose: () => void;
  campaignId: string;
  prospectId: string;
  establishmentName: string;
  reservation: ProspectReservationState | null;
  defaultChannel?: ActionType;
  onCompleted: () => void;
}) {
  const [channel, setChannel] = useState<ActionType>(defaultChannel);
  const [outcome, setOutcome] = useState<OutcomeCode | null>(null);
  const [outcomeError, setOutcomeError] = useState(false);
  const [notes, setNotes] = useState('');
  const [lifecycleStage, setLifecycleStage] = useState<ActionLifecycleStage | ''>('');

  const [createFollowUp, setCreateFollowUp] = useState(true);
  const [followUpDate, setFollowUpDate] = useState(defaultFollowUpDate);
  const [followUpTime, setFollowUpTime] = useState('10:00');

  const [releaseReservation, setReleaseReservation] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /*
   * One key for the whole completion, minted when the drawer opens and reused
   * across retries: a network failure is ambiguous, so retrying with a fresh
   * key could log the same action twice.
   */
  const idempotencyKey = useMemo(() => (open ? crypto.randomUUID() : ''), [open]);

  const ownsReservation = reservation?.state === 'owned';

  async function submit(): Promise<void> {
    if (!outcome) {
      setOutcomeError(true);

      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      /*
       * The action is created and started so it exists to be completed; the
       * completion itself is one server transaction covering the outcome,
       * lifecycle change, next follow-up and reservation disposition.
       */
      const action = await createAction(
        {
          campaignId,
          campaignProspectId: prospectId,
          type: channel,
          subject: `${OUTCOME_LABELS[outcome]} — ${establishmentName}`.slice(0, 255),
        },
        `${idempotencyKey}-create`,
      );

      await startAction(action.id, `${idempotencyKey}-start`);

      await completeAction(
        action.id,
        {
          outcomeCode: outcome,
          ...(notes.trim() ? { notes: notes.trim() } : {}),
          ...(lifecycleStage ? { lifecycleStage } : {}),
          ...(createFollowUp
            ? {
                nextFollowUp: {
                  /* The API requires an explicit offset, not a local string. */
                  dueAt: new Date(`${followUpDate}T${followUpTime}`).toISOString(),
                  channel: channel === 'note' || channel === 'task' ? 'call' : channel,
                },
              }
            : {}),
          reservationDisposition: ownsReservation && !releaseReservation ? 'keep' : 'release',
        },
        `${idempotencyKey}-complete`,
      );

      onCompleted();
      onClose();
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Log action outcome"
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={onClose} disabled={submitting}>
            Cancel
          </Button>

          <Button fullWidth loading={submitting} onClick={() => void submit()}>
            {createFollowUp ? 'Complete & schedule follow-up' : 'Complete action'}
          </Button>
        </div>
      }
    >
      <p className="text-[16px] font-bold text-navy">{establishmentName}</p>

      <section className="mt-5">
        <h3 className="text-[14px] font-semibold text-ink">Channel</h3>

        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {CHANNELS.map((item) => (
            <ChoiceTile
              key={item.value}
              icon={<item.icon aria-hidden="true" className="size-5" />}
              label={item.label}
              selected={channel === item.value}
              onSelect={() => setChannel(item.value)}
            />
          ))}
        </div>
      </section>

      <section className="mt-6">
        <h3 className="text-[14px] font-semibold text-ink">
          Outcome <span className="text-danger">*</span>
        </h3>

        {outcomeError && !outcome ? (
          <p className="mt-1 text-[13px] font-medium text-danger">Please select an outcome</p>
        ) : null}

        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {OFFERED_OUTCOMES.map((code) => {
            const Icon = OUTCOME_ICONS[code] ?? CheckCircle2;

            return (
              <ChoiceTile
                key={code}
                icon={<Icon aria-hidden="true" className="size-5" />}
                label={OUTCOME_LABELS[code]}
                selected={outcome === code}
                onSelect={() => {
                  setOutcome(code);
                  setOutcomeError(false);
                  setCreateFollowUp(OUTCOMES_SUGGESTING_FOLLOW_UP.has(code));
                }}
              />
            );
          })}
        </div>
      </section>

      <section className="mt-6">
        <label htmlFor="outcome-notes" className="text-[14px] font-semibold text-ink">
          Notes
        </label>

        <textarea
          id="outcome-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value.slice(0, MAX_ACTION_NOTES))}
          rows={4}
          placeholder="Add details about the contact, discussion points, next steps..."
          className="mt-2 w-full rounded-lg border border-line bg-surface px-3.5 py-3 text-[15px] text-ink placeholder:text-ink-muted hover:border-brand-pale"
        />
      </section>

      <section className="mt-6">
        <SelectField
          label="Update prospect status"
          value={lifecycleStage}
          onChange={(event) => setLifecycleStage(event.target.value as ActionLifecycleStage | '')}
          disabled={submitting}
          options={[{ value: '', label: 'Leave unchanged' }, ...LIFECYCLE_OPTIONS]}
        />
      </section>

      <section className="mt-6 rounded-lg border border-line-soft p-4">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-[15px] font-semibold text-ink">Create next follow-up</h3>

          <Toggle
            checked={createFollowUp}
            onChange={setCreateFollowUp}
            label="Create next follow-up"
          />
        </div>

        {createFollowUp ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="follow-up-date" className="text-[14px] font-semibold text-ink">
                Date
              </label>

              <input
                id="follow-up-date"
                type="date"
                value={followUpDate}
                onChange={(event) => setFollowUpDate(event.target.value)}
                className="h-12 rounded-lg border border-line bg-surface px-3.5 text-[15px] text-ink"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="follow-up-time" className="text-[14px] font-semibold text-ink">
                Time
              </label>

              <input
                id="follow-up-time"
                type="time"
                value={followUpTime}
                onChange={(event) => setFollowUpTime(event.target.value)}
                className="h-12 rounded-lg border border-line bg-surface px-3.5 text-[15px] text-ink"
              />
            </div>
          </div>
        ) : null}
      </section>

      {ownsReservation ? (
        <section className="mt-5">
          <h3 className="text-[15px] font-semibold text-ink">Reservation</h3>

          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <ChoiceTile
              label="Release after completion"
              description="Make this prospect available for your team."
              selected={releaseReservation}
              onSelect={() => setReleaseReservation(true)}
            />

            <ChoiceTile
              label="Keep until expiry"
              description="Maintain the lock until its original expiry."
              selected={!releaseReservation}
              onSelect={() => setReleaseReservation(false)}
            />
          </div>
        </section>
      ) : null}

      {error ? (
        <Alert tone="danger" className="mt-5">
          {error}
        </Alert>
      ) : null}

      <Alert tone="info" className="mt-5">
        The outcome, status change, follow-up and reservation are applied in a single transaction
        and recorded permanently.
      </Alert>
    </Drawer>
  );
}

function ChoiceTile({
  icon,
  label,
  description,
  selected,
  onSelect,
}: {
  icon?: React.ReactNode;
  label: string;
  description?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-center',
        'transition-colors duration-150',
        description && 'items-start text-left',
        selected
          ? 'border-brand bg-brand-wash text-brand'
          : 'border-line bg-surface text-ink-soft hover:border-brand-pale',
      )}
    >
      {icon}

      <span className="text-[14px] font-semibold">{label}</span>

      {description ? (
        <span className="text-[13px] font-normal text-ink-muted">{description}</span>
      ) : null}
    </button>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full transition-colors duration-150',
        checked ? 'bg-brand' : 'bg-line',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'absolute top-0.5 size-5 rounded-full bg-white transition-all duration-150',
          checked ? 'left-[22px]' : 'left-0.5',
        )}
      />
    </button>
  );
}

function describeError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return 'Something went wrong. Please try again.';
  }

  if (error.statusCode === 403) {
    return 'You are not authorized to log an action on this prospect.';
  }

  if (error.statusCode === 409) {
    /* The collision engine refused the contact. */
    return 'This prospect is no longer available to contact. Refresh to see the current state.';
  }

  if (error.statusCode === 400) {
    return 'Please check the outcome and follow-up details.';
  }

  return 'We could not save this outcome. Nothing was applied.';
}

function defaultFollowUpDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 3);

  return date.toISOString().slice(0, 10);
}
