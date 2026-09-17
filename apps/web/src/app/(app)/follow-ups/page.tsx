'use client';

import {
  AlertTriangle,
  Ban,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
  UserRound,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '@/lib/api/api-error';
import {
  cancelProspectFollowUp,
  completeProspectFollowUp,
  listFollowUpQueue,
  rescheduleProspectFollowUp,
} from '@/lib/api/follow-up-client';
import type { FollowUpQueueItem, ProspectFollowUpOwnership } from '@/lib/api/follow-up-types';
import { useAuth } from '@/lib/auth/auth-context';

import styles from './page.module.css';

type FollowUpFilter = 'all' | 'overdue' | 'upcoming';

type FollowUpMutationKind = 'complete' | 'reschedule' | 'cancel';

interface FollowUpFilterOption {
  value: FollowUpFilter;

  label: string;
}

interface FollowUpMutationState {
  followUpId: string;

  kind: FollowUpMutationKind;
}

interface FollowUpMutationAttempt {
  followUpId: string;

  kind: FollowUpMutationKind;

  dueAt?: string;

  idempotencyKey: string;
}

interface ActionErrorState {
  followUpId: string;

  message: string;
}

const filterOptions: FollowUpFilterOption[] = [
  {
    value: 'all',
    label: 'All',
  },
  {
    value: 'overdue',
    label: 'Overdue',
  },
  {
    value: 'upcoming',
    label: 'Upcoming',
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

function isOverdue(dueAt: string): boolean {
  const date = new Date(dueAt);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return date.getTime() < Date.now();
}

function getOwnershipLabel(ownership: ProspectFollowUpOwnership): string {
  return ownership === 'team' ? 'Team-owned' : 'Assigned to me';
}

function getBackendOverdueFilter(filter: FollowUpFilter): boolean | undefined {
  switch (filter) {
    case 'all':
      return undefined;

    case 'overdue':
      return true;

    case 'upcoming':
      return false;
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.statusCode === 401) {
      return 'Your TrackRoster session has expired. Refresh the page to restore your session.';
    }

    if (error.statusCode === 403) {
      return 'You no longer have access to follow-ups in the selected Prospector workspace.';
    }

    if (error.statusCode === 404) {
      return 'This follow-up is no longer available in your active workspace.';
    }

    if (error.messages.length > 0) {
      return error.messages.join(', ');
    }
  }

  return fallback;
}

function shouldReuseIdempotencyKey(error: unknown): boolean {
  if (!(error instanceof ApiError)) {
    /*
     * A browser/network failure can be ambiguous:
     * the backend may have committed successfully
     * without the response reaching the browser.
     */
    return true;
  }

  return error.statusCode === 0 || error.statusCode >= 500;
}

function createMutationIdempotencyKey(kind: FollowUpMutationKind): string {
  return `follow-up-${kind}-${crypto.randomUUID()}`;
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

export default function FollowUpsPage() {
  const { activeWorkspace } = useAuth();

  const teamId =
    activeWorkspace?.mode === 'prospector' && activeWorkspace.scopeType === 'team'
      ? activeWorkspace.teamId
      : null;

  const [items, setItems] = useState<FollowUpQueueItem[]>([]);

  const [filter, setFilter] = useState<FollowUpFilter>('all');

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [mutation, setMutation] = useState<FollowUpMutationState | null>(null);

  const [actionError, setActionError] = useState<ActionErrorState | null>(null);

  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const [rescheduleTargetId, setRescheduleTargetId] = useState<string | null>(null);

  const [rescheduleDrafts, setRescheduleDrafts] = useState<Record<string, string>>({});

  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);

  const requestSequence = useRef(0);

  /*
   * A failed ambiguous mutation keeps its attempt
   * here so the exact same idempotency key can be
   * reused when the user retries that logical action.
   */
  const mutationAttempt = useRef<FollowUpMutationAttempt | null>(null);

  const loadFollowUps = useCallback(async (): Promise<void> => {
    if (!teamId) {
      setItems([]);

      setError(null);

      setLoading(false);

      return;
    }

    const requestId = ++requestSequence.current;

    setLoading(true);

    setError(null);

    try {
      const response = await listFollowUpQueue({
        teamId,

        overdue: getBackendOverdueFilter(filter),

        /*
         * The current queue API is bounded,
         * not cursor-based.
         */
        limit: 100,
      });

      if (requestId !== requestSequence.current) {
        return;
      }

      setItems(response.items);
    } catch (loadError) {
      if (requestId !== requestSequence.current) {
        return;
      }

      setItems([]);

      setError(getErrorMessage(loadError, 'TrackRoster could not load your follow-up queue.'));
    } finally {
      if (requestId === requestSequence.current) {
        setLoading(false);
      }
    }
  }, [filter, teamId]);

  useEffect(() => {
    if (!teamId) {
      requestSequence.current += 1;

      setItems([]);

      setError(null);

      setLoading(false);

      return;
    }

    void loadFollowUps();

    return () => {
      requestSequence.current += 1;
    };
  }, [teamId, loadFollowUps]);

  function getOrCreateMutationAttempt(
    followUpId: string,
    kind: FollowUpMutationKind,
    dueAt?: string,
  ): FollowUpMutationAttempt {
    const current = mutationAttempt.current;

    if (
      current &&
      current.followUpId === followUpId &&
      current.kind === kind &&
      current.dueAt === dueAt
    ) {
      return current;
    }

    const next: FollowUpMutationAttempt = {
      followUpId,

      kind,

      dueAt,

      idempotencyKey: createMutationIdempotencyKey(kind),
    };

    mutationAttempt.current = next;

    return next;
  }

  function clearAttemptIfMatching(followUpId: string, kind: FollowUpMutationKind): void {
    const current = mutationAttempt.current;

    if (current?.followUpId === followUpId && current.kind === kind) {
      mutationAttempt.current = null;
    }
  }

  function handleFilterChange(nextFilter: FollowUpFilter): void {
    if (mutation !== null) {
      return;
    }

    if (nextFilter === filter) {
      void loadFollowUps();

      return;
    }

    setFilter(nextFilter);

    setActionError(null);

    setActionSuccess(null);

    setRescheduleTargetId(null);

    setCancelTargetId(null);
  }

  async function handleComplete(item: FollowUpQueueItem): Promise<void> {
    if (!teamId || mutation !== null) {
      return;
    }

    const attempt = getOrCreateMutationAttempt(item.id, 'complete');

    setMutation({
      followUpId: item.id,

      kind: 'complete',
    });

    setActionError(null);

    setActionSuccess(null);

    setRescheduleTargetId(null);

    setCancelTargetId(null);

    try {
      await completeProspectFollowUp({
        campaignId: item.campaignId,

        prospectId: item.prospectId,

        followUpId: item.id,

        teamId,

        idempotencyKey: attempt.idempotencyKey,
      });

      mutationAttempt.current = null;

      setActionSuccess(`Follow-up for ${item.establishmentName} completed.`);

      await loadFollowUps();
    } catch (mutationError) {
      if (!shouldReuseIdempotencyKey(mutationError)) {
        clearAttemptIfMatching(item.id, 'complete');
      }

      setActionError({
        followUpId: item.id,

        message: getErrorMessage(mutationError, 'TrackRoster could not complete this follow-up.'),
      });
    } finally {
      setMutation(null);
    }
  }

  async function handleCancel(item: FollowUpQueueItem): Promise<void> {
    if (!teamId || mutation !== null) {
      return;
    }

    const attempt = getOrCreateMutationAttempt(item.id, 'cancel');

    setMutation({
      followUpId: item.id,

      kind: 'cancel',
    });

    setActionError(null);

    setActionSuccess(null);

    try {
      await cancelProspectFollowUp({
        campaignId: item.campaignId,

        prospectId: item.prospectId,

        followUpId: item.id,

        teamId,

        idempotencyKey: attempt.idempotencyKey,
      });

      mutationAttempt.current = null;

      setCancelTargetId(null);

      setActionSuccess(`Follow-up for ${item.establishmentName} cancelled.`);

      await loadFollowUps();
    } catch (mutationError) {
      if (!shouldReuseIdempotencyKey(mutationError)) {
        clearAttemptIfMatching(item.id, 'cancel');
      }

      setActionError({
        followUpId: item.id,

        message: getErrorMessage(mutationError, 'TrackRoster could not cancel this follow-up.'),
      });
    } finally {
      setMutation(null);
    }
  }

  async function handleReschedule(
    event: FormEvent<HTMLFormElement>,
    item: FollowUpQueueItem,
  ): Promise<void> {
    event.preventDefault();

    if (!teamId || mutation !== null) {
      return;
    }

    const draft = rescheduleDrafts[item.id] ?? '';

    const dueDate = new Date(draft);

    if (!draft || Number.isNaN(dueDate.getTime())) {
      clearAttemptIfMatching(item.id, 'reschedule');

      setActionSuccess(null);

      setActionError({
        followUpId: item.id,

        message: 'Choose a valid follow-up date and time.',
      });

      return;
    }

    if (dueDate.getTime() <= Date.now()) {
      clearAttemptIfMatching(item.id, 'reschedule');

      setActionSuccess(null);

      setActionError({
        followUpId: item.id,

        message: 'The rescheduled date and time must be in the future.',
      });

      return;
    }

    const dueAt = dueDate.toISOString();

    const attempt = getOrCreateMutationAttempt(item.id, 'reschedule', dueAt);

    setMutation({
      followUpId: item.id,

      kind: 'reschedule',
    });

    setActionError(null);

    setActionSuccess(null);

    try {
      const updated = await rescheduleProspectFollowUp({
        campaignId: item.campaignId,

        prospectId: item.prospectId,

        followUpId: item.id,

        teamId,

        dueAt,

        idempotencyKey: attempt.idempotencyKey,
      });

      mutationAttempt.current = null;

      setRescheduleTargetId(null);

      setRescheduleDrafts((current) => {
        const next = {
          ...current,
        };

        delete next[item.id];

        return next;
      });

      setActionSuccess(
        `Follow-up for ${item.establishmentName} rescheduled to ${formatDateTime(updated.dueAt)}.`,
      );

      await loadFollowUps();
    } catch (mutationError) {
      if (!shouldReuseIdempotencyKey(mutationError)) {
        clearAttemptIfMatching(item.id, 'reschedule');
      }

      setActionError({
        followUpId: item.id,

        message: getErrorMessage(mutationError, 'TrackRoster could not reschedule this follow-up.'),
      });
    } finally {
      setMutation(null);
    }
  }

  function toggleReschedule(item: FollowUpQueueItem): void {
    if (mutation !== null) {
      return;
    }

    setActionError(null);

    setActionSuccess(null);

    setCancelTargetId(null);

    if (rescheduleTargetId === item.id) {
      setRescheduleTargetId(null);

      return;
    }

    setRescheduleTargetId(item.id);
  }

  function toggleCancelConfirmation(item: FollowUpQueueItem): void {
    if (mutation !== null) {
      return;
    }

    setActionError(null);

    setActionSuccess(null);

    setRescheduleTargetId(null);

    setCancelTargetId((current) => (current === item.id ? null : item.id));
  }

  const minimumFollowUpDateTime = toLocalDateTimeMinimum(new Date());

  if (!teamId) {
    return (
      <main className={styles.page}>
        <section className={styles.unavailableCard} aria-labelledby="follow-ups-unavailable-title">
          <div className={styles.unavailableIcon}>
            <ShieldAlert size={24} strokeWidth={1.8} aria-hidden="true" />
          </div>

          <p className={styles.eyebrow}>Prospector workspace required</p>

          <h1 id="follow-ups-unavailable-title">Follow-Ups are not available in this workspace.</h1>

          <p className={styles.unavailableMessage}>
            Select a Prospector team workspace from the sidebar to view operational follow-ups.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Prospecting</p>

          <h1>Follow-Ups</h1>

          <p className={styles.pageDescription}>
            Pending follow-ups that are currently actionable in this team workspace.
          </p>
        </div>

        <button
          type="button"
          className={styles.refreshButton}
          onClick={() => {
            void loadFollowUps();
          }}
          disabled={loading || mutation !== null}
        >
          <RefreshCw size={17} strokeWidth={1.9} aria-hidden="true" />

          <span>{loading ? 'Refreshing…' : 'Refresh'}</span>
        </button>
      </header>

      <section className={styles.controls} aria-label="Follow-up filters">
        <div
          className={styles.filterGroup}
          role="group"
          aria-label="Filter follow-ups by due state"
        >
          {filterOptions.map((option) => {
            const selected = filter === option.value;

            return (
              <button
                key={option.value}
                type="button"
                className={[styles.filterButton, selected ? styles.filterButtonActive : '']
                  .filter(Boolean)
                  .join(' ')}
                aria-pressed={selected}
                disabled={loading || mutation !== null}
                onClick={() => {
                  handleFilterChange(option.value);
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className={styles.summaryBar} aria-label="Follow-up queue summary">
        <div className={styles.summaryIcon}>
          <CalendarClock size={20} strokeWidth={1.9} aria-hidden="true" />
        </div>

        <div>
          <span className={styles.summaryValue}>{loading ? '—' : items.length}</span>

          <span className={styles.summaryLabel}>
            {items.length === 1 ? 'follow-up loaded' : 'follow-ups loaded'}
          </span>
        </div>
      </section>

      {actionSuccess ? (
        <section className={styles.successBanner} role="status" aria-live="polite">
          <CheckCircle2 size={19} strokeWidth={1.9} aria-hidden="true" />

          <span>{actionSuccess}</span>
        </section>
      ) : null}

      {loading ? (
        <section className={styles.stateCard} role="status" aria-live="polite">
          <div className={styles.spinner} />

          <div>
            <h2>Loading follow-ups</h2>

            <p>TrackRoster is retrieving actionable follow-ups for this workspace.</p>
          </div>
        </section>
      ) : null}

      {!loading && error ? (
        <section className={styles.errorCard} role="alert" aria-live="assertive">
          <div className={styles.errorIcon}>
            <ShieldAlert size={22} strokeWidth={1.8} aria-hidden="true" />
          </div>

          <div className={styles.errorContent}>
            <h2>Follow-Ups unavailable</h2>

            <p>{error}</p>

            <button
              type="button"
              onClick={() => {
                void loadFollowUps();
              }}
            >
              Try again
            </button>
          </div>
        </section>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <section className={styles.emptyCard}>
          <div className={styles.emptyIcon}>
            <CalendarClock size={25} strokeWidth={1.8} aria-hidden="true" />
          </div>

          <h2>
            {filter === 'overdue'
              ? 'No overdue follow-ups.'
              : filter === 'upcoming'
                ? 'No upcoming follow-ups.'
                : 'Your follow-up queue is clear.'}
          </h2>

          <p>
            {filter === 'overdue'
              ? 'There are no pending follow-ups past their due time in this workspace.'
              : filter === 'upcoming'
                ? 'There are no pending follow-ups scheduled for now or later in this workspace.'
                : 'There are currently no actionable follow-ups in this team workspace.'}
          </p>
        </section>
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <section className={styles.followUpList} aria-label="Actionable follow-ups">
          {items.map((item) => {
            const overdue = isOverdue(item.dueAt);

            const completing = mutation?.followUpId === item.id && mutation.kind === 'complete';

            const rescheduling = mutation?.followUpId === item.id && mutation.kind === 'reschedule';

            const cancelling = mutation?.followUpId === item.id && mutation.kind === 'cancel';

            const rescheduleOpen = rescheduleTargetId === item.id;

            const cancelOpen = cancelTargetId === item.id;

            const itemActionError =
              actionError?.followUpId === item.id ? actionError.message : null;

            const detailHref =
              `/work-queue/${encodeURIComponent(item.campaignId)}` +
              `/${encodeURIComponent(item.prospectId)}`;

            return (
              <article
                key={item.id}
                className={[styles.followUpCard, overdue ? styles.followUpCardOverdue : '']
                  .filter(Boolean)
                  .join(' ')}
              >
                <Link
                  href={detailHref}
                  className={styles.prospectLink}
                  aria-label={`Open ${item.establishmentName}`}
                >
                  <div className={styles.cardOverview}>
                    <div className={styles.cardPrimary}>
                      <div
                        className={[
                          styles.establishmentIcon,

                          overdue ? styles.establishmentIconOverdue : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        <Building2 size={21} strokeWidth={1.8} aria-hidden="true" />
                      </div>

                      <div className={styles.establishmentContent}>
                        <div className={styles.cardTitleRow}>
                          <h2>{item.establishmentName}</h2>

                          <span
                            className={[
                              styles.dueBadge,

                              overdue ? styles.dueBadgeOverdue : styles.dueBadgeUpcoming,
                            ].join(' ')}
                          >
                            {overdue ? 'Overdue' : 'Upcoming'}
                          </span>
                        </div>

                        <p className={styles.campaignName}>{item.campaignName}</p>

                        <div className={styles.metadata}>
                          <span>
                            {item.ownership === 'team' ? (
                              <Users size={15} strokeWidth={1.9} aria-hidden="true" />
                            ) : (
                              <UserRound size={15} strokeWidth={1.9} aria-hidden="true" />
                            )}

                            {getOwnershipLabel(item.ownership)}
                          </span>

                          <span>
                            <Clock3 size={15} strokeWidth={1.9} aria-hidden="true" />
                            Pending
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className={styles.cardAside}>
                      <span className={styles.dueLabel}>{overdue ? 'Was due' : 'Due'}</span>

                      <time dateTime={item.dueAt}>{formatDateTime(item.dueAt)}</time>

                      {overdue ? (
                        <span className={styles.overdueHint}>
                          <AlertTriangle size={14} strokeWidth={1.9} aria-hidden="true" />
                          Action needed
                        </span>
                      ) : null}
                    </div>
                  </div>
                </Link>

                <div
                  className={styles.cardActions}
                  aria-label={`Actions for ${item.establishmentName}`}
                >
                  <button
                    type="button"
                    className={[styles.actionButton, styles.completeButton].join(' ')}
                    disabled={mutation !== null}
                    onClick={() => {
                      void handleComplete(item);
                    }}
                  >
                    {completing ? (
                      <LoaderCircle className={styles.buttonSpinner} size={17} aria-hidden="true" />
                    ) : (
                      <CheckCircle2 size={17} strokeWidth={1.9} aria-hidden="true" />
                    )}

                    {completing ? 'Completing…' : 'Complete'}
                  </button>

                  <button
                    type="button"
                    className={[styles.actionButton, styles.rescheduleButton].join(' ')}
                    disabled={mutation !== null}
                    aria-expanded={rescheduleOpen}
                    onClick={() => {
                      toggleReschedule(item);
                    }}
                  >
                    <CalendarClock size={17} strokeWidth={1.9} aria-hidden="true" />

                    {rescheduleOpen ? 'Close reschedule' : 'Reschedule'}
                  </button>

                  <button
                    type="button"
                    className={[styles.actionButton, styles.cancelButton].join(' ')}
                    disabled={mutation !== null}
                    aria-expanded={cancelOpen}
                    onClick={() => {
                      toggleCancelConfirmation(item);
                    }}
                  >
                    <Ban size={17} strokeWidth={1.9} aria-hidden="true" />

                    {cancelOpen ? 'Close cancel' : 'Cancel'}
                  </button>
                </div>

                {rescheduleOpen ? (
                  <form
                    className={styles.reschedulePanel}
                    onSubmit={(event) => {
                      void handleReschedule(event, item);
                    }}
                  >
                    <div>
                      <label htmlFor={`reschedule-${item.id}`} className={styles.fieldLabel}>
                        New due date and time
                      </label>

                      <p className={styles.fieldDescription}>
                        Choose a future date and time for this follow-up.
                      </p>
                    </div>

                    <div className={styles.rescheduleControls}>
                      <input
                        id={`reschedule-${item.id}`}
                        type="datetime-local"
                        className={styles.dateTimeInput}
                        min={minimumFollowUpDateTime}
                        value={rescheduleDrafts[item.id] ?? ''}
                        required
                        disabled={mutation !== null}
                        onChange={(event) => {
                          const value = event.currentTarget.value;

                          setRescheduleDrafts((current) => ({
                            ...current,

                            [item.id]: value,
                          }));

                          clearAttemptIfMatching(item.id, 'reschedule');

                          setActionError(null);

                          setActionSuccess(null);
                        }}
                      />

                      <button
                        type="submit"
                        className={styles.rescheduleSubmitButton}
                        disabled={mutation !== null || !rescheduleDrafts[item.id]}
                      >
                        {rescheduling ? (
                          <>
                            <LoaderCircle
                              className={styles.buttonSpinner}
                              size={17}
                              aria-hidden="true"
                            />
                            Rescheduling…
                          </>
                        ) : (
                          'Save new time'
                        )}
                      </button>
                    </div>
                  </form>
                ) : null}

                {cancelOpen ? (
                  <div className={styles.cancelConfirmation}>
                    <div>
                      <strong>Cancel this follow-up?</strong>

                      <p>
                        It will leave the pending operational queue. This action is recorded by the
                        backend.
                      </p>
                    </div>

                    <div className={styles.confirmationActions}>
                      <button
                        type="button"
                        className={styles.keepButton}
                        disabled={mutation !== null}
                        onClick={() => {
                          setCancelTargetId(null);

                          setActionError(null);
                        }}
                      >
                        Keep follow-up
                      </button>

                      <button
                        type="button"
                        className={styles.confirmCancelButton}
                        disabled={mutation !== null}
                        onClick={() => {
                          void handleCancel(item);
                        }}
                      >
                        {cancelling ? (
                          <>
                            <LoaderCircle
                              className={styles.buttonSpinner}
                              size={17}
                              aria-hidden="true"
                            />
                            Cancelling…
                          </>
                        ) : (
                          'Confirm cancellation'
                        )}
                      </button>
                    </div>
                  </div>
                ) : null}

                {itemActionError ? (
                  <div className={styles.actionError} role="alert" aria-live="assertive">
                    <AlertTriangle size={18} strokeWidth={1.9} aria-hidden="true" />

                    <span>{itemActionError}</span>
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>
      ) : null}

      {!loading && !error && items.length === 100 ? (
        <p className={styles.limitNotice}>
          Showing the first 100 actionable follow-ups for this workspace.
        </p>
      ) : null}
    </main>
  );
}
