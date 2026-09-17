'use client';

import {
  AlertTriangle,
  Ban,
  CalendarPlus2,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  LockKeyhole,
  Mail,
  MapPinned,
  MessageSquare,
  PhoneCall,
  RefreshCw,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react';
import type { FormEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '@/lib/api/api-error';
import { createProspectFollowUp } from '@/lib/api/follow-up-client';
import type { ProspectFollowUpOwnership } from '@/lib/api/follow-up-types';
import {
  acquireProspectReservation,
  getProspectCollisionDecision,
  getProspectReservation,
  recordProspectActivity,
  releaseProspectReservation,
} from '@/lib/api/work-queue-client';
import type {
  ProspectActivityType,
  ProspectCollisionDecision,
  ProspectCollisionReasonCode,
  ProspectReservationState,
} from '@/lib/api/work-queue-types';

import styles from './prospect-action-panel.module.css';

interface ProspectActionPanelProps {
  campaignId: string;
  prospectId: string;
  teamId: string;

  onActivityRecorded: () => Promise<void>;
}

type MutationState = 'acquire' | 'release' | 'activity' | 'follow-up' | null;

type DecisionTone = 'success' | 'warning' | 'danger';

interface ActivityAttempt {
  type: ProspectActivityType;

  idempotencyKey: string;
}

interface FollowUpAttempt {
  dueAt: string;

  ownership: ProspectFollowUpOwnership;

  idempotencyKey: string;
}

const activityOptions: Array<{
  type: ProspectActivityType;

  label: string;

  icon: typeof PhoneCall;
}> = [
  {
    type: 'call',
    label: 'Call',
    icon: PhoneCall,
  },
  {
    type: 'email',
    label: 'Email',
    icon: Mail,
  },
  {
    type: 'visit',
    label: 'Visit',
    icon: MapPinned,
  },
  {
    type: 'message',
    label: 'Message',
    icon: MessageSquare,
  },
];

function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',

    timeStyle: 'short',
  }).format(date);
}

function getReasonMessage(reasonCode: ProspectCollisionReasonCode): string {
  switch (reasonCode) {
    case 'NO_COLLISION':
      return 'No blocking coordination conflict was detected.';

    case 'ACTIVE_ASSIGNMENT':
      return 'Another active assignment overlaps this establishment.';

    case 'ACTIVE_RESERVATION':
      return 'An active reservation currently protects this prospect from simultaneous work.';

    case 'PLANNED_ACTION':
      return 'A planned prospecting action already exists for this establishment.';

    case 'RECENT_CONTACT':
      return 'This establishment has been contacted recently.';
  }
}

function getDecisionPresentation(decision: ProspectCollisionDecision): {
  title: string;

  description: string;

  tone: DecisionTone;
} {
  switch (decision.decision) {
    case 'allow':
      return {
        title: 'Contact allowed',

        description: getReasonMessage(decision.reasonCode),

        tone: 'success',
      };

    case 'warn':
      return {
        title: 'Proceed with caution',

        description: getReasonMessage(decision.reasonCode),

        tone: 'warning',
      };

    case 'block':
      return {
        title: 'Contact blocked',

        description: getReasonMessage(decision.reasonCode),

        tone: 'danger',
      };

    case 'require_override':
      return {
        title: 'Manager override required',

        description: getReasonMessage(decision.reasonCode),

        tone: 'danger',
      };
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.statusCode === 401) {
      return 'Your TrackRoster session has expired. Refresh the page to restore your session.';
    }

    if (error.statusCode === 403) {
      return 'You no longer have access to this prospect in the selected workspace.';
    }

    if (error.statusCode === 404) {
      return 'This prospect is no longer available in your active Work Queue.';
    }

    if (error.messages.length > 0) {
      return error.messages.join(', ');
    }
  }

  return fallback;
}

function shouldReuseIdempotencyKey(error: unknown): boolean {
  if (!(error instanceof ApiError)) {
    return true;
  }

  /*
   * Network/5xx failures are ambiguous: Nest may
   * have committed the mutation even though the
   * browser never received the response.
   *
   * Reusing the same key makes a retry the same
   * logical mutation.
   */
  return error.statusCode === 0 || error.statusCode >= 500;
}

function createActivityIdempotencyKey(type: ProspectActivityType): string {
  return `prospect-activity-${type}-${crypto.randomUUID()}`;
}

function createFollowUpIdempotencyKey(): string {
  return `prospect-follow-up-${crypto.randomUUID()}`;
}

function toLocalDateTimeMinimum(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0');

  return (
    `${date.getFullYear()}-` +
    `${pad(date.getMonth() + 1)}-` +
    `${pad(date.getDate())}T` +
    `${pad(date.getHours())}:` +
    `${pad(date.getMinutes())}`
  );
}

export function ProspectActionPanel({
  campaignId,
  prospectId,
  teamId,
  onActivityRecorded,
}: ProspectActionPanelProps) {
  const [collisionDecision, setCollisionDecision] = useState<ProspectCollisionDecision | null>(
    null,
  );

  const [reservation, setReservation] = useState<ProspectReservationState | null>(null);

  const [selectedActivityType, setSelectedActivityType] = useState<ProspectActivityType>('call');

  const [followUpDueAt, setFollowUpDueAt] = useState('');

  const [followUpOwnership, setFollowUpOwnership] = useState<ProspectFollowUpOwnership>('user');

  const [loading, setLoading] = useState(true);

  const [coordinationError, setCoordinationError] = useState<string | null>(null);

  const [actionError, setActionError] = useState<string | null>(null);

  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const [mutation, setMutation] = useState<MutationState>(null);

  const requestSequence = useRef(0);

  /*
   * Ambiguous retries must reuse the exact
   * idempotency key for the same logical mutation.
   */
  const activityAttempt = useRef<ActivityAttempt | null>(null);

  const followUpAttempt = useRef<FollowUpAttempt | null>(null);

  const loadCoordination = useCallback(async (): Promise<void> => {
    const requestId = ++requestSequence.current;

    setLoading(true);

    setCoordinationError(null);

    try {
      const [collisionResponse, reservationResponse] = await Promise.all([
        getProspectCollisionDecision({
          campaignId,

          prospectId,

          teamId,
        }),

        getProspectReservation({
          campaignId,

          prospectId,

          teamId,
        }),
      ]);

      if (requestId !== requestSequence.current) {
        return;
      }

      setCollisionDecision(collisionResponse);

      setReservation(reservationResponse);
    } catch (error) {
      if (requestId !== requestSequence.current) {
        return;
      }

      /*
       * Fail closed. Prospecting actions should
       * not be available when TrackRoster cannot
       * establish the authoritative coordination
       * state.
       */
      setCollisionDecision(null);

      setReservation(null);

      setCoordinationError(
        getErrorMessage(error, 'TrackRoster could not load the current coordination state.'),
      );
    } finally {
      if (requestId === requestSequence.current) {
        setLoading(false);
      }
    }
  }, [campaignId, prospectId, teamId]);

  useEffect(() => {
    void loadCoordination();

    return () => {
      requestSequence.current += 1;
    };
  }, [loadCoordination]);

  async function handleAcquireReservation(): Promise<void> {
    if (!collisionDecision || !reservation || reservation.state !== 'none') {
      return;
    }

    if (collisionDecision.decision !== 'allow' && collisionDecision.decision !== 'warn') {
      return;
    }

    setMutation('acquire');

    setActionError(null);

    setActionSuccess(null);

    try {
      const acquired = await acquireProspectReservation({
        campaignId,

        prospectId,

        teamId,
      });

      setReservation({
        state: 'owned',

        reservationId: acquired.reservationId,

        acquiredAt: acquired.acquiredAt,

        expiresAt: acquired.expiresAt,
      });

      setActionSuccess(
        'Reservation acquired. You can now record activity or schedule a follow-up.',
      );
    } catch (error) {
      setActionError(getErrorMessage(error, 'TrackRoster could not acquire the reservation.'));

      /*
       * A failed acquisition may mean another
       * user won the race. Reload authoritative
       * reservation/collision state.
       */
      await loadCoordination();
    } finally {
      setMutation(null);
    }
  }

  async function handleReleaseReservation(): Promise<void> {
    if (!reservation || reservation.state !== 'owned') {
      return;
    }

    setMutation('release');

    setActionError(null);

    setActionSuccess(null);

    try {
      await releaseProspectReservation({
        campaignId,

        prospectId,

        teamId,

        reservationId: reservation.reservationId,
      });

      setActionSuccess('Reservation released.');

      await loadCoordination();
    } catch (error) {
      setActionError(getErrorMessage(error, 'TrackRoster could not release the reservation.'));

      await loadCoordination();
    } finally {
      setMutation(null);
    }
  }

  async function handleRecordActivity(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!reservation || reservation.state !== 'owned') {
      return;
    }

    let attempt = activityAttempt.current;

    if (!attempt || attempt.type !== selectedActivityType) {
      attempt = {
        type: selectedActivityType,

        idempotencyKey: createActivityIdempotencyKey(selectedActivityType),
      };

      activityAttempt.current = attempt;
    }

    setMutation('activity');

    setActionError(null);

    setActionSuccess(null);

    try {
      const activity = await recordProspectActivity({
        campaignId,

        prospectId,

        teamId,

        type: attempt.type,

        idempotencyKey: attempt.idempotencyKey,
      });

      activityAttempt.current = null;

      setActionSuccess(
        `${getActivityLabel(activity.type)} recorded at ${formatDateTime(activity.occurredAt)}.`,
      );

      /*
       * Reload the timeline from the server
       * instead of fabricating an optimistic
       * activity entry.
       */
      await onActivityRecorded();
    } catch (error) {
      if (!shouldReuseIdempotencyKey(error)) {
        activityAttempt.current = null;
      }

      setActionError(getErrorMessage(error, 'TrackRoster could not record the activity.'));
    } finally {
      setMutation(null);
    }
  }

  async function handleScheduleFollowUp(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!reservation || reservation.state !== 'owned') {
      return;
    }

    const dueDate = new Date(followUpDueAt);

    if (!followUpDueAt || Number.isNaN(dueDate.getTime())) {
      followUpAttempt.current = null;

      setActionSuccess(null);

      setActionError('Choose a valid follow-up date and time.');

      return;
    }

    if (dueDate.getTime() <= Date.now()) {
      followUpAttempt.current = null;

      setActionSuccess(null);

      setActionError('Follow-up date and time must be in the future.');

      return;
    }

    const dueAt = dueDate.toISOString();

    let attempt = followUpAttempt.current;

    /*
     * Changing either logical mutation
     * input creates a new mutation and
     * therefore requires a fresh key.
     */
    if (!attempt || attempt.dueAt !== dueAt || attempt.ownership !== followUpOwnership) {
      attempt = {
        dueAt,

        ownership: followUpOwnership,

        idempotencyKey: createFollowUpIdempotencyKey(),
      };

      followUpAttempt.current = attempt;
    }

    setMutation('follow-up');

    setActionError(null);

    setActionSuccess(null);

    try {
      const followUp = await createProspectFollowUp({
        campaignId,

        prospectId,

        teamId,

        dueAt: attempt.dueAt,

        ownership: attempt.ownership,

        idempotencyKey: attempt.idempotencyKey,
      });

      /*
       * Successful completion ends the logical
       * mutation. The next scheduling action must
       * use a new key.
       */
      followUpAttempt.current = null;

      setFollowUpDueAt('');

      setFollowUpOwnership('user');

      setActionSuccess(
        followUp.ownership === 'team'
          ? `Team follow-up scheduled for ${formatDateTime(followUp.dueAt)}.`
          : `Follow-up scheduled for ${formatDateTime(followUp.dueAt)}.`,
      );
    } catch (error) {
      if (!shouldReuseIdempotencyKey(error)) {
        followUpAttempt.current = null;
      }

      setActionError(getErrorMessage(error, 'TrackRoster could not schedule the follow-up.'));
    } finally {
      setMutation(null);
    }
  }

  function handleActivitySelection(type: ProspectActivityType): void {
    if (type !== selectedActivityType) {
      activityAttempt.current = null;
    }

    setSelectedActivityType(type);

    setActionError(null);

    setActionSuccess(null);
  }

  const decisionPresentation = collisionDecision
    ? getDecisionPresentation(collisionDecision)
    : null;

  const canAcquire =
    reservation?.state === 'none' &&
    (collisionDecision?.decision === 'allow' || collisionDecision?.decision === 'warn');

  const canRecordActivity = reservation?.state === 'owned';

  const canScheduleFollowUp = reservation?.state === 'owned';

  const minimumFollowUpDateTime = toLocalDateTimeMinimum(new Date());

  return (
    <section className={styles.card} aria-labelledby="prospect-coordination-title">
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Prospecting coordination</p>

          <h2 id="prospect-coordination-title">Contact & reservation</h2>
        </div>

        <button
          type="button"
          className={styles.refreshButton}
          onClick={() => {
            void loadCoordination();
          }}
          disabled={loading || mutation !== null}
          aria-label="Refresh coordination status"
        >
          <RefreshCw size={17} strokeWidth={1.9} aria-hidden="true" />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className={styles.loading} role="status" aria-live="polite">
          <LoaderCircle className={styles.spinner} size={20} aria-hidden="true" />
          Checking contact permissions and reservation…
        </div>
      ) : null}

      {!loading && coordinationError ? (
        <div className={styles.errorState} role="alert">
          <AlertTriangle size={20} strokeWidth={1.9} aria-hidden="true" />

          <div>
            <strong>Coordination unavailable</strong>

            <p>{coordinationError}</p>
          </div>
        </div>
      ) : null}

      {!loading && !coordinationError && decisionPresentation && collisionDecision ? (
        <>
          <div
            className={[
              styles.decisionState,

              decisionPresentation.tone === 'success' ? styles.decisionSuccess : '',

              decisionPresentation.tone === 'warning' ? styles.decisionWarning : '',

              decisionPresentation.tone === 'danger' ? styles.decisionDanger : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <div className={styles.decisionIcon}>
              {collisionDecision.decision === 'allow' ? (
                <ShieldCheck size={21} strokeWidth={1.9} aria-hidden="true" />
              ) : null}

              {collisionDecision.decision === 'warn' ? (
                <AlertTriangle size={21} strokeWidth={1.9} aria-hidden="true" />
              ) : null}

              {collisionDecision.decision === 'block' ? (
                <Ban size={21} strokeWidth={1.9} aria-hidden="true" />
              ) : null}

              {collisionDecision.decision === 'require_override' ? (
                <LockKeyhole size={21} strokeWidth={1.9} aria-hidden="true" />
              ) : null}
            </div>

            <div className={styles.decisionContent}>
              <strong>{decisionPresentation.title}</strong>

              <p>{decisionPresentation.description}</p>

              <span className={styles.reasonCode}>{collisionDecision.reasonCode}</span>
            </div>
          </div>

          <div className={styles.reservationSection}>
            <div className={styles.reservationHeader}>
              <div>
                <p className={styles.reservationEyebrow}>Reservation</p>

                {reservation?.state === 'none' ? (
                  <>
                    <h3>Not currently reserved</h3>

                    <p>Reserve the prospect before beginning outreach.</p>
                  </>
                ) : null}

                {reservation?.state === 'owned' ? (
                  <>
                    <h3>Reserved by you</h3>

                    <p>
                      Reservation expires{' '}
                      <time dateTime={reservation.expiresAt}>
                        {formatDateTime(reservation.expiresAt)}
                      </time>
                      .
                    </p>
                  </>
                ) : null}

                {reservation?.state === 'reserved' ? (
                  <>
                    <h3>Reserved by another user</h3>

                    <p>
                      Available after{' '}
                      <time dateTime={reservation.expiresAt}>
                        {formatDateTime(reservation.expiresAt)}
                      </time>
                      .
                    </p>
                  </>
                ) : null}
              </div>

              <Clock3 size={20} strokeWidth={1.8} aria-hidden="true" />
            </div>

            {reservation?.state === 'none' && canAcquire ? (
              <button
                type="button"
                className={styles.primaryButton}
                disabled={mutation !== null}
                onClick={() => {
                  void handleAcquireReservation();
                }}
              >
                {mutation === 'acquire' ? (
                  <>
                    <LoaderCircle className={styles.spinner} size={17} aria-hidden="true" />
                    Reserving…
                  </>
                ) : (
                  <>
                    <LockKeyhole size={17} strokeWidth={1.9} aria-hidden="true" />
                    Start work
                  </>
                )}
              </button>
            ) : null}

            {reservation?.state === 'owned' ? (
              <button
                type="button"
                className={styles.secondaryButton}
                disabled={mutation !== null}
                onClick={() => {
                  void handleReleaseReservation();
                }}
              >
                {mutation === 'release' ? (
                  <>
                    <LoaderCircle className={styles.spinner} size={17} aria-hidden="true" />
                    Releasing…
                  </>
                ) : (
                  'Release reservation'
                )}
              </button>
            ) : null}

            {reservation?.state === 'none' && collisionDecision.decision === 'block' ? (
              <p className={styles.blockedHint}>
                Outreach cannot start while this collision is blocking the prospect.
              </p>
            ) : null}

            {reservation?.state === 'none' && collisionDecision.decision === 'require_override' ? (
              <p className={styles.blockedHint}>
                An authorized manager must issue an override before this prospect can be reserved.
              </p>
            ) : null}
          </div>

          <form className={styles.activitySection} onSubmit={handleRecordActivity}>
            <div className={styles.activityHeader}>
              <div>
                <p className={styles.reservationEyebrow}>Prospecting action</p>

                <h3>Record activity</h3>

                <p>Record the channel used for this prospect.</p>
              </div>
            </div>

            <fieldset
              className={styles.activityFieldset}
              disabled={!canRecordActivity || mutation !== null}
            >
              <legend className="sr-only">Prospecting activity type</legend>

              <div className={styles.activityGrid}>
                {activityOptions.map((option) => {
                  const Icon = option.icon;

                  const selected = selectedActivityType === option.type;

                  return (
                    <label
                      key={option.type}
                      className={[
                        styles.activityOption,

                        selected ? styles.activityOptionSelected : '',

                        !canRecordActivity ? styles.activityOptionDisabled : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <input
                        type="radio"
                        name="activityType"
                        value={option.type}
                        checked={selected}
                        onChange={() => {
                          handleActivitySelection(option.type);
                        }}
                      />

                      <Icon size={18} strokeWidth={1.9} aria-hidden="true" />

                      <span>{option.label}</span>
                    </label>
                  );
                })}
              </div>

              <button
                type="submit"
                className={styles.recordButton}
                disabled={!canRecordActivity || mutation !== null}
              >
                {mutation === 'activity' ? (
                  <>
                    <LoaderCircle className={styles.spinner} size={17} aria-hidden="true" />
                    Recording…
                  </>
                ) : (
                  'Record activity'
                )}
              </button>
            </fieldset>

            {!canRecordActivity ? (
              <p className={styles.activityHint}>
                Acquire the reservation before recording prospecting activity.
              </p>
            ) : null}
          </form>

          <form className={styles.activitySection} onSubmit={handleScheduleFollowUp}>
            <div className={styles.activityHeader}>
              <div>
                <p className={styles.reservationEyebrow}>Follow-up</p>

                <h3>Schedule follow-up</h3>

                <p>Plan the next action for this prospect.</p>
              </div>

              <CalendarPlus2 size={20} strokeWidth={1.8} aria-hidden="true" />
            </div>

            <fieldset
              className={styles.activityFieldset}
              disabled={!canScheduleFollowUp || mutation !== null}
            >
              <legend className="sr-only">Schedule prospect follow-up</legend>

              <label className={styles.followUpField}>
                <span className={styles.followUpLabel}>Due date and time</span>

                <input
                  type="datetime-local"
                  className={styles.followUpInput}
                  value={followUpDueAt}
                  min={minimumFollowUpDateTime}
                  required
                  onChange={(event) => {
                    /*
                     * Changing scheduling input
                     * starts a new logical
                     * mutation.
                     */
                    followUpAttempt.current = null;

                    setFollowUpDueAt(event.target.value);

                    setActionError(null);

                    setActionSuccess(null);
                  }}
                />

                <span className={styles.followUpDescription}>
                  Select a future date and time for the next prospecting action.
                </span>
              </label>

              <div
                className={styles.activityGrid}
                role="radiogroup"
                aria-label="Follow-up ownership"
              >
                <label
                  className={[
                    styles.activityOption,

                    followUpOwnership === 'user' ? styles.activityOptionSelected : '',

                    !canScheduleFollowUp ? styles.activityOptionDisabled : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <input
                    type="radio"
                    name="followUpOwnership"
                    value="user"
                    checked={followUpOwnership === 'user'}
                    onChange={() => {
                      followUpAttempt.current = null;

                      setFollowUpOwnership('user');

                      setActionError(null);

                      setActionSuccess(null);
                    }}
                  />

                  <UserRound size={18} strokeWidth={1.9} aria-hidden="true" />

                  <span>Assigned to me</span>
                </label>

                <label
                  className={[
                    styles.activityOption,

                    followUpOwnership === 'team' ? styles.activityOptionSelected : '',

                    !canScheduleFollowUp ? styles.activityOptionDisabled : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <input
                    type="radio"
                    name="followUpOwnership"
                    value="team"
                    checked={followUpOwnership === 'team'}
                    onChange={() => {
                      followUpAttempt.current = null;

                      setFollowUpOwnership('team');

                      setActionError(null);

                      setActionSuccess(null);
                    }}
                  />

                  <Users size={18} strokeWidth={1.9} aria-hidden="true" />

                  <span>Team-owned</span>
                </label>
              </div>

              <button
                type="submit"
                className={styles.recordButton}
                disabled={!canScheduleFollowUp || mutation !== null || !followUpDueAt}
              >
                {mutation === 'follow-up' ? (
                  <>
                    <LoaderCircle className={styles.spinner} size={17} aria-hidden="true" />
                    Scheduling…
                  </>
                ) : (
                  <>
                    <CalendarPlus2 size={17} strokeWidth={1.9} aria-hidden="true" />
                    Schedule follow-up
                  </>
                )}
              </button>
            </fieldset>

            {!canScheduleFollowUp ? (
              <p className={styles.activityHint}>
                Acquire the reservation before scheduling a follow-up.
              </p>
            ) : null}
          </form>
        </>
      ) : null}

      {actionError ? (
        <div className={styles.actionError} role="alert" aria-live="assertive">
          <AlertTriangle size={18} strokeWidth={1.9} aria-hidden="true" />

          <span>{actionError}</span>
        </div>
      ) : null}

      {actionSuccess ? (
        <div className={styles.actionSuccess} role="status" aria-live="polite">
          <CheckCircle2 size={18} strokeWidth={1.9} aria-hidden="true" />

          <span>{actionSuccess}</span>
        </div>
      ) : null}
    </section>
  );
}

function getActivityLabel(type: ProspectActivityType): string {
  switch (type) {
    case 'call':
      return 'Call';

    case 'email':
      return 'Email';

    case 'visit':
      return 'Visit';

    case 'message':
      return 'Message';
  }
}
