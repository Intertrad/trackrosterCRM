'use client';

import {
  Activity,
  AlertTriangle,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Clock3,
  RefreshCw,
  ShieldAlert,
  UserRound,
  Users,
} from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getManagerDashboard } from '@/lib/api/manager-dashboard-client';
import type {
  ManagerDashboardQuery,
  ManagerDashboardResponse,
} from '@/lib/api/manager-dashboard-types';
import { useAuth } from '@/lib/auth/auth-context';

import styles from './page.module.css';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RANGE_DAYS = 366;

interface AppliedRange {
  from?: string;
  to?: string;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
  }).format(new Date(value));
}

function formatActivityType(value: string): string {
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return 'TrackRoster could not load manager reporting.';
}

function buildUtcRange(startDate: string, endDate: string): AppliedRange | null {
  if (!startDate && !endDate) {
    return {};
  }

  if (!startDate || !endDate) {
    return null;
  }

  const from = new Date(`${startDate}T00:00:00.000Z`);
  const inclusiveEnd = new Date(`${endDate}T00:00:00.000Z`);

  if (Number.isNaN(from.getTime()) || Number.isNaN(inclusiveEnd.getTime())) {
    return null;
  }

  const to = new Date(inclusiveEnd.getTime() + DAY_MS);

  const rangeMs = to.getTime() - from.getTime();

  if (rangeMs <= 0 || rangeMs > MAX_RANGE_DAYS * DAY_MS) {
    return null;
  }

  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

function getAuthorityLabel(authority: ManagerDashboardResponse['scope']['authority']): string {
  switch (authority) {
    case 'client_admin':
      return 'Client Admin';

    case 'director':
      return 'Director';

    case 'manager':
      return 'Manager';
  }
}

export default function ManagerDashboardPage() {
  const { activeWorkspace } = useAuth();

  const [dashboard, setDashboard] = useState<ManagerDashboardResponse | null>(null);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [rangeError, setRangeError] = useState<string | null>(null);

  const [startDate, setStartDate] = useState('');

  const [endDate, setEndDate] = useState('');

  const [appliedRange, setAppliedRange] = useState<AppliedRange>({});

  const requestSequence = useRef(0);

  const workspaceQuery = useMemo<ManagerDashboardQuery | null>(() => {
    if (!activeWorkspace) {
      return null;
    }

    switch (activeWorkspace.mode) {
      case 'admin':
        return {};

      case 'director':
        if (activeWorkspace.scopeType !== 'organization' || !activeWorkspace.organizationId) {
          return null;
        }

        return {
          organizationId: activeWorkspace.organizationId,
        };

      case 'manager':
        if (activeWorkspace.scopeType !== 'team' || !activeWorkspace.teamId) {
          return null;
        }

        return {
          teamId: activeWorkspace.teamId,
        };

      default:
        return null;
    }
  }, [activeWorkspace]);

  const reportingWorkspace =
    activeWorkspace?.mode === 'admin' ||
    activeWorkspace?.mode === 'director' ||
    activeWorkspace?.mode === 'manager';

  const loadDashboard = useCallback(
    async (range: AppliedRange = appliedRange): Promise<void> => {
      if (!workspaceQuery) {
        requestSequence.current += 1;

        setDashboard(null);
        setError(null);
        setLoading(false);

        return;
      }

      const requestId = ++requestSequence.current;

      setLoading(true);
      setError(null);

      try {
        const response = await getManagerDashboard({
          ...workspaceQuery,
          ...range,
        });

        if (requestId !== requestSequence.current) {
          return;
        }

        setDashboard(response);
      } catch (loadError) {
        if (requestId !== requestSequence.current) {
          return;
        }

        setDashboard(null);

        setError(getErrorMessage(loadError));
      } finally {
        if (requestId === requestSequence.current) {
          setLoading(false);
        }
      }
    },
    [appliedRange, workspaceQuery],
  );

  useEffect(() => {
    if (!workspaceQuery) {
      requestSequence.current += 1;

      setDashboard(null);
      setError(null);
      setLoading(false);

      return;
    }

    void loadDashboard();

    return () => {
      requestSequence.current += 1;
    };
  }, [workspaceQuery, loadDashboard]);

  function handleRangeSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const nextRange = buildUtcRange(startDate, endDate);

    if (nextRange === null) {
      setRangeError(
        'Choose both dates, keep the end date on or after the start date, and use a range of 366 days or less.',
      );

      return;
    }

    setRangeError(null);
    setAppliedRange(nextRange);
  }

  function resetRange(): void {
    setStartDate('');
    setEndDate('');
    setRangeError(null);

    setAppliedRange({});
  }

  if (!reportingWorkspace) {
    return (
      <main className={styles.page}>
        <section className={styles.unavailableCard} aria-labelledby="manager-dashboard-unavailable">
          <div className={styles.unavailableIcon}>
            <ShieldAlert size={25} strokeWidth={1.8} aria-hidden="true" />
          </div>

          <p className={styles.eyebrow}>Reporting workspace required</p>

          <h1 id="manager-dashboard-unavailable">
            Manager Dashboard is not available in this workspace.
          </h1>

          <p>Select a Manager, Director, or Client Admin workspace to view reporting.</p>
        </section>
      </main>
    );
  }

  if (!workspaceQuery) {
    return (
      <main className={styles.page}>
        <section className={styles.errorCard} role="alert">
          <ShieldAlert size={24} aria-hidden="true" />

          <div>
            <h1>Reporting workspace is incomplete</h1>

            <p>
              TrackRoster could not determine the reporting dimension for the selected workspace.
            </p>
          </div>
        </section>
      </main>
    );
  }

  const noOperationalData =
    dashboard !== null &&
    dashboard.activities.total === 0 &&
    dashboard.assignments.current === 0 &&
    dashboard.followUps.pending === 0 &&
    dashboard.followUps.completedInRange === 0 &&
    dashboard.followUps.cancelledInRange === 0;

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Reporting</p>

          <h1>Manager Dashboard</h1>

          <p className={styles.pageDescription}>
            Activity, assignment and follow-up visibility for the reporting scope authorized by
            TrackRoster.
          </p>
        </div>

        <button
          type="button"
          className={styles.refreshButton}
          disabled={loading}
          onClick={() => {
            void loadDashboard();
          }}
        >
          <RefreshCw size={17} strokeWidth={1.9} aria-hidden="true" />

          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      <section className={styles.rangeCard} aria-labelledby="dashboard-range-title">
        <div className={styles.rangeHeading}>
          <CalendarDays size={21} strokeWidth={1.8} aria-hidden="true" />

          <div>
            <h2 id="dashboard-range-title">Reporting period</h2>

            <p>
              Leave the dates empty to use the backend default 30-day reporting window. Custom
              calendar dates are interpreted as UTC days.
            </p>
          </div>
        </div>

        <form className={styles.rangeForm} onSubmit={handleRangeSubmit}>
          <label>
            <span>Start date</span>

            <input
              type="date"
              value={startDate}
              disabled={loading}
              onChange={(event) => {
                setStartDate(event.currentTarget.value);

                setRangeError(null);
              }}
            />
          </label>

          <label>
            <span>End date</span>

            <input
              type="date"
              value={endDate}
              disabled={loading}
              onChange={(event) => {
                setEndDate(event.currentTarget.value);

                setRangeError(null);
              }}
            />
          </label>

          <div className={styles.rangeActions}>
            <button type="submit" disabled={loading} className={styles.applyButton}>
              Apply period
            </button>

            <button
              type="button"
              disabled={loading}
              className={styles.resetButton}
              onClick={resetRange}
            >
              Default 30 days
            </button>
          </div>
        </form>

        {rangeError ? (
          <p className={styles.rangeError} role="alert">
            <AlertTriangle size={17} aria-hidden="true" />

            {rangeError}
          </p>
        ) : null}
      </section>

      {loading && !dashboard ? (
        <section className={styles.stateCard} role="status" aria-live="polite">
          <div className={styles.spinner} />

          <div>
            <h2>Loading manager reporting</h2>

            <p>TrackRoster is calculating dashboard metrics for this workspace.</p>
          </div>
        </section>
      ) : null}

      {!loading && error ? (
        <section className={styles.errorCard} role="alert" aria-live="assertive">
          <ShieldAlert size={23} aria-hidden="true" />

          <div>
            <h2>Manager Dashboard unavailable</h2>

            <p>{error}</p>

            <button
              type="button"
              onClick={() => {
                void loadDashboard();
              }}
            >
              Try again
            </button>
          </div>
        </section>
      ) : null}

      {dashboard ? (
        <>
          <section className={styles.scopeBar} aria-label="Authorized reporting scope">
            <div>
              <span className={styles.scopeLabel}>Effective scope</span>

              <strong>{getAuthorityLabel(dashboard.scope.authority)}</strong>
            </div>

            {dashboard.scope.organizationId ? (
              <div>
                <span className={styles.scopeLabel}>Organization</span>

                <code>{dashboard.scope.organizationId}</code>
              </div>
            ) : null}

            {dashboard.scope.teamId ? (
              <div>
                <span className={styles.scopeLabel}>Team</span>

                <code>{dashboard.scope.teamId}</code>
              </div>
            ) : null}

            <div>
              <span className={styles.scopeLabel}>Reporting range</span>

              <strong>
                {formatDate(dashboard.range.from)}
                {' – '}
                {formatDate(dashboard.range.to)}
              </strong>
            </div>

            <div>
              <span className={styles.scopeLabel}>Snapshot</span>

              <strong>{formatDateTime(dashboard.generatedAt)}</strong>
            </div>
          </section>

          <section className={styles.kpiGrid} aria-label="Manager dashboard summary">
            <article className={styles.kpiCard}>
              <div className={styles.kpiIcon}>
                <Activity size={21} aria-hidden="true" />
              </div>

              <div>
                <span>Total activities</span>

                <strong>{dashboard.activities.total}</strong>

                <small>In reporting period</small>
              </div>
            </article>

            <article className={styles.kpiCard}>
              <div className={styles.kpiIcon}>
                <Users size={21} aria-hidden="true" />
              </div>

              <div>
                <span>Active Prospectors</span>

                <strong>{dashboard.activities.activeProspectors}</strong>

                <small>With period activity</small>
              </div>
            </article>

            <article className={styles.kpiCard}>
              <div className={styles.kpiIcon}>
                <Briefcase size={21} aria-hidden="true" />
              </div>

              <div>
                <span>Current assignments</span>

                <strong>{dashboard.assignments.current}</strong>

                <small>Active assignment snapshot</small>
              </div>
            </article>

            <article className={styles.kpiCard}>
              <div className={styles.kpiIcon}>
                <Clock3 size={21} aria-hidden="true" />
              </div>

              <div>
                <span>Pending follow-ups</span>

                <strong>{dashboard.followUps.pending}</strong>

                <small>Current pending snapshot</small>
              </div>
            </article>

            <article
              className={[styles.kpiCard, dashboard.followUps.overdue > 0 ? styles.warningCard : '']
                .filter(Boolean)
                .join(' ')}
            >
              <div className={styles.kpiIcon}>
                <AlertTriangle size={21} aria-hidden="true" />
              </div>

              <div>
                <span>Overdue follow-ups</span>

                <strong>{dashboard.followUps.overdue}</strong>

                <small>Due before snapshot time</small>
              </div>
            </article>
          </section>

          {noOperationalData ? (
            <section className={styles.emptyNotice}>
              <CheckCircle2 size={20} aria-hidden="true" />

              <div>
                <strong>No reporting activity found</strong>

                <p>
                  There are no activities, assignments or follow-up events for this scope and
                  period.
                </p>
              </div>
            </section>
          ) : null}

          <div className={styles.detailGrid}>
            <section className={styles.panel} aria-labelledby="activity-breakdown">
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.panelEyebrow}>Activity</p>

                  <h2 id="activity-breakdown">Activity breakdown</h2>
                </div>

                <Activity size={21} aria-hidden="true" />
              </div>

              {Object.keys(dashboard.activities.byType).length === 0 ? (
                <p className={styles.panelEmpty}>
                  No activity types were recorded in this reporting period.
                </p>
              ) : (
                <div className={styles.metricRows}>
                  {Object.entries(dashboard.activities.byType).map(([type, count]) => (
                    <div key={type} className={styles.metricRow}>
                      <span>{formatActivityType(type)}</span>

                      <strong>{count}</strong>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className={styles.panel} aria-labelledby="assignment-distribution">
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.panelEyebrow}>Assignments</p>

                  <h2 id="assignment-distribution">Current distribution</h2>
                </div>

                <Briefcase size={21} aria-hidden="true" />
              </div>

              <div className={styles.metricRows}>
                <div className={styles.metricRow}>
                  <span>Individually assigned</span>

                  <strong>{dashboard.assignments.individuallyAssigned}</strong>
                </div>

                <div className={styles.metricRow}>
                  <span>Team-owned</span>

                  <strong>{dashboard.assignments.teamOwned}</strong>
                </div>

                <div className={styles.metricRow}>
                  <span>Total current</span>

                  <strong>{dashboard.assignments.current}</strong>
                </div>
              </div>
            </section>

            <section className={styles.panel} aria-labelledby="follow-up-health">
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.panelEyebrow}>Follow-ups</p>

                  <h2 id="follow-up-health">Follow-up health</h2>
                </div>

                <Clock3 size={21} aria-hidden="true" />
              </div>

              <div className={styles.metricRows}>
                <div className={styles.metricRow}>
                  <span>Due in reporting period</span>

                  <strong>{dashboard.followUps.dueInRange}</strong>
                </div>

                <div className={styles.metricRow}>
                  <span>Completed in period</span>

                  <strong>{dashboard.followUps.completedInRange}</strong>
                </div>

                <div className={styles.metricRow}>
                  <span>Cancelled in period</span>

                  <strong>{dashboard.followUps.cancelledInRange}</strong>
                </div>

                <div className={styles.metricRow}>
                  <span>Current overdue</span>

                  <strong>{dashboard.followUps.overdue}</strong>
                </div>
              </div>
            </section>
          </div>

          <section className={styles.tablePanel} aria-labelledby="prospector-metrics">
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelEyebrow}>Team visibility</p>

                <h2 id="prospector-metrics">Metrics by Prospector</h2>

                <p className={styles.tableDescription}>
                  The current reporting API exposes user IDs rather than display names, so
                  TrackRoster shows the backend identifier without inventing user metadata.
                </p>
              </div>

              <UserRound size={22} aria-hidden="true" />
            </div>

            {dashboard.byProspector.length === 0 ? (
              <p className={styles.panelEmpty}>
                No Prospector metrics are available for this scope and reporting period.
              </p>
            ) : (
              <div className={styles.tableScroller}>
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Prospector</th>

                      <th scope="col">Activities</th>

                      <th scope="col">Assignments</th>

                      <th scope="col">Pending</th>

                      <th scope="col">Overdue</th>
                    </tr>
                  </thead>

                  <tbody>
                    {dashboard.byProspector.map((prospector) => (
                      <tr key={prospector.userId}>
                        <td>
                          <code>{prospector.userId}</code>
                        </td>

                        <td>{prospector.activities}</td>

                        <td>{prospector.currentAssignments}</td>

                        <td>{prospector.pendingFollowUps}</td>

                        <td>
                          <span
                            className={
                              prospector.overdueFollowUps > 0 ? styles.overdueValue : undefined
                            }
                          >
                            {prospector.overdueFollowUps}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </main>
  );
}
