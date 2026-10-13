'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { ConfirmDialog } from '@/components/ui/dialog';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { text } from '@/lib/workspace/copy';
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
import { getOutcomeSettings } from '@/lib/api/outcome-settings-client';
import { outcomesForChannel, type OutcomeDefinition } from '@/lib/api/outcome-settings-types';
import type { ProspectReservationState } from '@/lib/api/work-queue-types';
import { cn } from '@/lib/ui/cn';
import { notify } from '@/lib/notifications/notify';

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

const OUTCOME_LABELS_FR: Record<OutcomeCode, string> = {
  no_answer: 'Sans réponse',
  contacted: 'Contact établi',
  interested: 'Intéressé',
  not_interested: 'Non intéressé',
  qualified: 'Qualifié',
  converted: 'Converti',
  do_not_contact: 'Ne plus contacter',
  completed: 'Terminé',
};

/*
 * What to offer when the tenant's configuration cannot be read.
 *
 * Deliberately a fallback rather than the source. A tenant renames and retires its
 * outcomes, so a fixed list offers ones nobody uses and hides the ones they added —
 * but refusing to let a prospector record a call they have just made, because a
 * settings read failed, would be worse than offering the defaults. The API accepts
 * any well-formed code, so a record written from these is still valid.
 */
const FALLBACK_OUTCOMES: OutcomeDefinition[] = [
  'no_answer',
  'contacted',
  'interested',
  'qualified',
  'not_interested',
  'do_not_contact',
].map((code) => ({
  code,
  label: OUTCOME_LABELS[code as OutcomeCode],
  behavior: code,
  enabled: true,
  actionTypes: [],
}));

const lifecycleLabels: Partial<Record<ActionLifecycleStage, string>> = {
  contact_made: 'Contact établi',
  in_progress: 'En cours',
  follow_up: 'À relancer',
  qualified: 'Qualifié',
  converted: 'Converti',
};
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
  const { language } = useTranslation();
  const l = (en: string, fr: string) => text(en, fr, language);
  const [discard, setDiscard] = useState(false);
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

  /*
   * The tenant's own outcome vocabulary, read while the drawer is open. Null until
   * it arrives or fails, at which point the defaults stand in.
   */
  const [configured, setConfigured] = useState<OutcomeDefinition[] | null>(null);
  const [configFailed, setConfigFailed] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    const controller = new AbortController();

    getOutcomeSettings(controller.signal)
      .then((settings) => {
        if (!controller.signal.aborted) {
          setConfigured(settings.outcomes);
          setConfigFailed(false);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setConfigured(null);
          setConfigFailed(true);
        }
      });

    return () => controller.abort();
  }, [open]);

  /*
   * Narrowed to the chosen channel: "no answer" belongs to a call, not an e-mail,
   * and a retired outcome is never offered even though its history survives.
   */
  const offered = useMemo(
    () => outcomesForChannel(configured ?? FALLBACK_OUTCOMES, channel),
    [configured, channel],
  );

  /*
   * A channel change can retire the chosen outcome. Leaving it selected would
   * submit an outcome the tenant does not offer for this channel.
   */
  useEffect(() => {
    setOutcome((current) =>
      current && offered.some((option) => option.code === current) ? current : null,
    );
  }, [offered]);

  const dirty =
    !!outcome || notes.trim().length > 0 || lifecycleStage !== '' || channel !== defaultChannel;
  useEffect(() => {
    if (!open || !dirty) return;
    const protect = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [open, dirty]);
  const close = () => {
    if (submitting) return;
    if (dirty) setDiscard(true);
    else onClose();
  };
  function resetDraft() {
    setOutcome(null);
    setNotes('');
    setLifecycleStage('');
    setChannel(defaultChannel);
    setError(null);
  }
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
          subject:
            `${offered.find((option) => option.code === outcome)?.label ?? outcome} — ${establishmentName}`.slice(
              0,
              255,
            ),
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

      resetDraft();
      onCompleted();
      notify.success(
        createFollowUp
          ? l('Action completed and follow-up scheduled.', 'Action terminée et relance planifiée.')
          : l('Action completed.', 'Action terminée.'),
        { id: 'action-completed' },
      );
      onClose();
    } catch (caught) {
      setError(describeError(caught, language));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Drawer
        open={open}
        onClose={close}
        title={l('Log action outcome', 'Consigner le résultat')}
        footer={
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button variant="secondary" fullWidth onClick={close} disabled={submitting}>
              {l('Cancel', 'Annuler')}
            </Button>

            <Button fullWidth loading={submitting} onClick={() => void submit()}>
              {createFollowUp
                ? l('Complete & schedule follow-up', 'Terminer et prévoir la relance')
                : l('Complete action', 'Terminer l’action')}
            </Button>
          </div>
        }
      >
        <p className="text-[16px] font-bold text-navy">{establishmentName}</p>

        <section className="mt-5">
          <h3 className="text-[14px] font-semibold text-ink">{l('Channel', 'Canal')}</h3>

          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {CHANNELS.map((item) => (
              <ChoiceTile
                key={item.value}
                icon={<item.icon aria-hidden="true" className="size-5" />}
                label={
                  language === 'fr'
                    ? ((
                        {
                          call: 'Appel',
                          email: 'E-mail',
                          visit: 'Visite',
                          message: 'Message',
                          note: 'Note',
                        } as Record<string, string>
                      )[item.value] ?? item.label)
                    : item.label
                }
                selected={channel === item.value}
                onSelect={() => setChannel(item.value)}
              />
            ))}
          </div>
        </section>

        <section className="mt-6">
          <h3 className="text-[14px] font-semibold text-ink">
            {l('Outcome', 'Résultat')} <span className="text-danger">*</span>
          </h3>

          {outcomeError && !outcome ? (
            <p className="mt-1 text-[13px] font-medium text-danger">
              {l('Please select an outcome', 'Sélectionnez un résultat')}
            </p>
          ) : null}

          {/*
           * Said rather than silent: the prospector is choosing from the shipped
           * defaults, which may not be the wording their tenant configured.
           */}
          {configFailed ? (
            <p className="mt-1 text-[13px] text-ink-muted">
              {l(
                'Your workspace’s outcomes could not be loaded, so the standard ones are shown.',
                'Les résultats de votre espace n’ont pas pu être chargés. Les choix standards sont affichés.',
              )}
            </p>
          ) : null}

          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {offered.map((option) => {
              /* An icon for the codes shipped by default; the rest get a neutral one. */
              const Icon = OUTCOME_ICONS[option.code as OutcomeCode] ?? CheckCircle2;

              return (
                <ChoiceTile
                  key={option.code}
                  icon={<Icon aria-hidden="true" className="size-5" />}
                  /* The tenant's own wording, not the frontend's. */
                  label={
                    language === 'fr' &&
                    [
                      OUTCOME_LABELS[option.code as OutcomeCode]?.toLowerCase(),
                      option.code.replaceAll('_', ' '),
                    ].includes(option.label.toLowerCase())
                      ? (OUTCOME_LABELS_FR[option.code as OutcomeCode] ?? option.label)
                      : option.label
                  }
                  selected={outcome === option.code}
                  onSelect={() => {
                    setOutcome(option.code as OutcomeCode);
                    setOutcomeError(false);
                    setCreateFollowUp(
                      OUTCOMES_SUGGESTING_FOLLOW_UP.has(option.code as OutcomeCode),
                    );
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
            placeholder={l(
              'Add details about the contact, discussion points, next steps...',
              'Précisez les échanges et les prochaines étapes…',
            )}
            className="mt-2 w-full resize-none rounded-lg border border-line bg-surface px-3.5 py-3 text-[15px] text-ink placeholder:text-ink-muted hover:border-brand-pale"
          />
        </section>

        <section className="mt-6">
          <SelectField
            label={l('Update prospect status', 'Modifier le statut de l’établissement')}
            value={lifecycleStage}
            onChange={(event) => setLifecycleStage(event.target.value as ActionLifecycleStage | '')}
            disabled={submitting}
            options={[
              { value: '', label: l('Leave unchanged', 'Conserver le statut') },
              ...LIFECYCLE_OPTIONS.map((option) => ({
                ...option,
                label:
                  language === 'fr'
                    ? (lifecycleLabels[option.value] ?? option.label)
                    : option.label,
              })),
            ]}
          />
        </section>

        <section className="mt-6 rounded-lg border border-line-soft p-4">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-[15px] font-semibold text-ink">
              {l('Create next follow-up', 'Prévoir une relance')}
            </h3>

            <Toggle
              checked={createFollowUp}
              onChange={setCreateFollowUp}
              label={l('Create next follow-up', 'Prévoir une relance')}
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
                  {l('Time', 'Heure')}
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
            <h3 className="text-[15px] font-semibold text-ink">
              {l('Reservation', 'Réservation')}
            </h3>

            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <ChoiceTile
                label={l('Release after completion', 'Libérer après l’action')}
                description={l(
                  'Make this prospect available for your team.',
                  'Rendre cet établissement disponible pour votre équipe.',
                )}
                selected={releaseReservation}
                onSelect={() => setReleaseReservation(true)}
              />

              <ChoiceTile
                label={l('Keep until expiry', 'Conserver jusqu’à l’expiration')}
                description={l(
                  'Maintain the lock until its original expiry.',
                  'Conserver la réservation jusqu’à son expiration.',
                )}
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
          {l(
            'The outcome, status change, follow-up and reservation are applied in a single transaction and recorded permanently.',
            'Le résultat, le statut, la relance et la réservation sont enregistrés ensemble et conservés dans l’historique.',
          )}
        </Alert>
      </Drawer>
      <ConfirmDialog
        open={discard}
        title={l('Discard this outcome?', 'Abandonner ce résultat ?')}
        description={l(
          'Your unsaved notes and outcome will be lost.',
          'Vos notes et votre résultat non enregistrés seront perdus.',
        )}
        confirmLabel={l('Discard draft', 'Abandonner le brouillon')}
        onClose={() => setDiscard(false)}
        onConfirm={() => {
          resetDraft();
          setDiscard(false);
          onClose();
        }}
      />
    </>
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

function describeError(error: unknown, language: 'en' | 'fr'): string {
  const l = (en: string, fr: string) => text(en, fr, language);
  if (!(error instanceof ApiError)) {
    return l('Something went wrong. Please try again.', 'Une erreur est survenue. Réessayez.');
  }

  if (error.statusCode === 403) {
    return l(
      'You are not authorized to log an action on this prospect.',
      'Vous n’êtes pas autorisé à consigner une action sur cet établissement.',
    );
  }

  if (error.statusCode === 409) {
    /* The collision engine refused the contact. */
    return l(
      'This prospect is no longer available to contact. Refresh to see the current state.',
      'Cet établissement n’est plus disponible. Actualisez pour consulter son statut.',
    );
  }

  if (error.statusCode === 400) {
    return l(
      'Please check the outcome and follow-up details.',
      'Vérifiez le résultat et les informations de relance.',
    );
  }

  if (
    error.statusCode === 502 ||
    error.code === 'UPSTREAM_REQUEST_FAILED' ||
    error.code === 'UNEXPECTED_BACKEND_ERROR'
  ) {
    return l(
      'The TrackRoster service is unavailable. Reconnect the backend and retry; nothing was saved.',
      'Le service TrackRoster est indisponible. Reconnectez le backend puis réessayez ; rien n’a été enregistré.',
    );
  }

  return l(
    'We could not confirm that the outcome was saved. Retry to check and complete it.',
    'L’enregistrement du résultat n’a pas pu être confirmé. Réessayez pour le vérifier et le terminer.',
  );
}

function defaultFollowUpDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 3);

  return date.toISOString().slice(0, 10);
}
