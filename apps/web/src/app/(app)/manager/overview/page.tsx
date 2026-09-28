'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BarChart3, ChevronRight, CircleAlert, CircleDot, UserRound, Users } from 'lucide-react';

import { MemberCell } from '@/components/manager/member-cell';
import { DEFAULT_SCOPE, type ManagerScope, ScopeFilters } from '@/components/manager/scope-filters';
import {
  PeriodFilter,
  type ManagerPeriod,
  resolvePeriod,
} from '@/components/manager/manager-filters';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LinkButton } from '@/components/ui/link-button';
import { CapacityBar } from '@/components/ui/capacity-bar';
import { Card, CardHeader } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { PreviewTag } from '@/components/ui/preview-notice';
import { getReport } from '@/lib/api/report-client';
import { formatRate, type ConversionsReport, type FollowUpsReport } from '@/lib/api/report-types';
import { StatTile } from '@/components/ui/stat-tile';
import { ApiError } from '@/lib/api/api-error';
import { getManagerDashboard } from '@/lib/api/manager-dashboard-client';
import type { ManagerDashboardResponse } from '@/lib/api/manager-dashboard-types';
import { RecentActivity } from '@/components/manager/recent-activity';
import { listMemberships } from '@/lib/api/membership-client';
import type { MembershipSummary } from '@/lib/api/membership-types';
import { listOverrideRequests } from '@/lib/api/override-client';
import type { OverrideRequestSummary } from '@/lib/api/override-types';
import { buildTeamRoster, rosterStatus, type TeamRosterRow } from '@/lib/manager/team-roster';
import { useAuth } from '@/lib/auth/auth-context';
import { cn } from '@/lib/ui/cn';

export default function TeamOverviewPage() {
  const { activeWorkspace } = useAuth();

  const [period, setPeriod] = useState<ManagerPeriod>('this_week');
  const [scope, setScope] = useState<ManagerScope>(DEFAULT_SCOPE);
  const [data, setData] = useState<ManagerDashboardResponse | null>(null);
  const [memberships, setMemberships] = useState<MembershipSummary[] | null>(null);
  const [requests, setRequests] = useState<OverrideRequestSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  /* Real conversion and follow-up figures for the snapshot card. */
  const [snapshot, setSnapshot] = useState<Array<{
    id: string;
    label: string;
    value: number | null;
    caption: string;
  }> | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      getReport<ConversionsReport>('conversions', {}, controller.signal),
      getReport<FollowUpsReport>('follow-ups', {}, controller.signal),
    ])
      .then(([conversions, followUps]) => {
        if (controller.signal.aborted) {
          return;
        }

        setSnapshot([
          {
            id: 'contact',
            label: 'Contact rate',
            value: conversions.data.contactRate,
            caption: `${conversions.data.contacted} of ${conversions.data.total} prospects`,
          },
          {
            id: 'conversion',
            label: 'Conversion rate',
            value: conversions.data.conversionRate,
            caption: `${conversions.data.converted} converted`,
          },
          {
            id: 'followups',
            label: 'Follow-ups completed',
            value: followUps.data.completionRate,
            caption: `${followUps.data.overdue} overdue`,
          },
        ]);
      })
      .catch(() => setSnapshot([]));

    return () => controller.abort();
  }, []);

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      try {
        const teamId = activeWorkspace?.teamId ?? undefined;

        const [response, membershipPage, requestPage] = await Promise.all([
          getManagerDashboard({ ...resolvePeriod(period), ...(teamId ? { teamId } : {}) }, signal),
          listMemberships({ ...(teamId ? { teamId } : {}), status: 'active', limit: 100 }, signal),
          /* The queue is advisory here; a failure must not blank the screen. */
          listOverrideRequests({ status: 'pending', limit: 5 }, signal).catch(() => ({
            items: [],
            nextCursor: null,
          })),
        ]);

        if (signal?.aborted) {
          return;
        }

        setData(response);
        setMemberships(membershipPage.items);
        setRequests(requestPage.items);
        setError(null);
      } catch (caught) {
        if (signal?.aborted) {
          return;
        }

        setError(
          caught instanceof ApiError && caught.statusCode === 403
            ? 'You do not have reporting access for this scope.'
            : 'We could not load the team overview. Please try again.',
        );
      }
    },
    [activeWorkspace?.teamId, period],
  );

  useEffect(() => {
    const controller = new AbortController();

    void load(controller.signal);

    return () => controller.abort();
  }, [load]);

  const roster = useMemo(() => buildTeamRoster(memberships ?? [], data), [data, memberships]);

  const totals = useMemo(() => {
    const withCapacity = roster.filter((row) => row.capacityPercent !== null);

    return {
      /*
       * Every one of these is a server aggregate, named for what the backend
       * actually counts.
       *
       * `assignments.current` counts assignments that have not ended, so it is the
       * work still open — not a total ever assigned. There is no completed-assignment
       * count, which means assigned = completed + remaining is not a relationship
       * this data supports, and labelling any of these "Assigned" or deriving a
       * "Completed" from subtraction would be a number a manager makes decisions on
       * and should not.
       */
      openAssignments: data?.assignments.current ?? 0,
      pendingFollowUps: data?.followUps.pending ?? 0,
      overdue: data?.followUps.overdue ?? 0,
      activitiesInPeriod: data?.activities.total ?? 0,
      activeProspectors: data?.activities.activeProspectors ?? 0,
      followUpsCompleted: data?.followUps.completedInRange ?? 0,

      /* Averaging over members without a target would understate the load. */
      capacity: withCapacity.length
        ? Math.round(
            withCapacity.reduce((sum, row) => sum + (row.capacityPercent ?? 0), 0) /
              withCapacity.length,
          )
        : null,
    };
  }, [data, roster]);

  const inactiveCount = roster.filter((row) => rosterStatus(row) === 'inactive').length;

  function toggle(id: string): void {
    setSelected((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  const allSelected = roster.length > 0 && selected.size === roster.length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Team overview"
        subtitle={`Coordinate workload, activity and exceptions across ${
          scope.territory === 'region-54' ? 'Region 54' : scope.territory
        }`}
        action={
          <div className="flex flex-wrap gap-2.5">
            <PeriodFilter value={period} onChange={setPeriod} />

            <ScopeFilters
              scope={scope}
              fields={['team', 'campaign', 'territory']}
              onChange={setScope}
            />
          </div>
        }
      />

      {error ? (
        <Alert tone="warning" title="Live figures are unavailable">
          {error}

          <Button variant="secondary" size="md" className="mt-3" onClick={() => void load()}>
            Try again
          </Button>
        </Alert>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <StatTile
            icon={<Users aria-hidden="true" className="size-6" />}
            tone="success"
            value={totals.openAssignments}
            label="Open assignments"
          />
        </Card>

        <Card>
          <StatTile
            icon={<CircleDot aria-hidden="true" className="size-6" />}
            tone="neutral"
            value={totals.pendingFollowUps}
            /* Pending follow-ups, not remaining work — those are different counts. */
            label="Pending follow-ups"
          />
        </Card>

        <Card>
          <StatTile
            icon={<CircleAlert aria-hidden="true" className="size-6" />}
            tone="danger"
            value={totals.overdue}
            label="Overdue follow-ups"
          />
        </Card>

        <Card>
          <StatTile
            icon={<BarChart3 aria-hidden="true" className="size-6" />}
            tone="brand"
            value={totals.capacity === null ? null : `${totals.capacity}%`}
            label="Capacity used"
          />
        </Card>

        {/* Counted over the selected period, by the server. */}
        <Card>
          <StatTile
            icon={<BarChart3 aria-hidden="true" className="size-6" />}
            tone="brand"
            value={totals.activitiesInPeriod}
            label="Activity in period"
          />
        </Card>

        <Card>
          <StatTile
            icon={<Users aria-hidden="true" className="size-6" />}
            tone="neutral"
            value={totals.activeProspectors}
            label="Active prospectors"
          />
        </Card>

        <Card>
          <StatTile
            icon={<CircleDot aria-hidden="true" className="size-6" />}
            tone="success"
            value={totals.followUpsCompleted}
            label="Follow-ups completed"
          />
        </Card>
      </div>

      {/*
       * What the team actually did, from the action feed rather than the aggregates
       * above — a different question and a different source. Nothing in it computes a
       * total from the rows it fetched.
       */}
      <RecentActivity members={memberships ?? []} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] xl:items-start">
        <Card className="p-0 sm:p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-6">
            <h2 className="flex items-center gap-2.5 text-[22px] font-bold tracking-[-0.02em] text-navy">
              Team workload
              <PreviewTag />
            </h2>

            <Link
              href="/manager/reports"
              className="text-[14px] font-semibold text-brand hover:text-brand-hover"
            >
              View team details
            </Link>
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="border-y border-line-soft text-left">
                  <th scope="col" className="w-12 px-5 py-3 sm:px-6">
                    <input
                      type="checkbox"
                      aria-label="Select all members"
                      checked={allSelected}
                      onChange={() =>
                        setSelected(
                          allSelected ? new Set() : new Set(roster.map((member) => member.id)),
                        )
                      }
                      className="size-[18px] cursor-pointer appearance-none rounded-[5px] border border-line bg-surface checked:border-brand checked:bg-brand"
                    />
                  </th>
                  <Th>Member</Th>
                  <Th align="center">Active prospects</Th>
                  <Th align="center">Actions this week</Th>
                  <Th align="center">Overdue</Th>
                  <Th>Capacity</Th>
                  <Th>Status</Th>
                </tr>
              </thead>

              <tbody className="divide-y divide-line-soft">
                {roster.map((member) => (
                  <tr key={member.id}>
                    <td className="px-5 py-4 sm:px-6">
                      <input
                        type="checkbox"
                        aria-label={`Select ${member.name}`}
                        checked={selected.has(member.id)}
                        onChange={() => toggle(member.id)}
                        className="size-[18px] cursor-pointer appearance-none rounded-[5px] border border-line bg-surface checked:border-brand checked:bg-brand"
                      />
                    </td>

                    <td className="px-3 py-4">
                      <MemberCell
                        initials={member.initials}
                        name={member.name}
                        location={member.role}
                      />
                    </td>

                    <td className="px-3 py-4 text-center text-[15px] text-ink tabular-nums">
                      {member.activeProspects}
                    </td>

                    <td className="px-3 py-4 text-center text-[15px] text-ink tabular-nums">
                      {member.actionsThisPeriod}
                    </td>

                    <td
                      className={cn(
                        'px-3 py-4 text-center text-[15px] tabular-nums',
                        member.overdue > 0 ? 'font-bold text-danger' : 'text-ink',
                      )}
                    >
                      {member.overdue}
                    </td>

                    <td className="px-3 py-4">
                      <CapacityBar percent={member.capacityPercent} />
                    </td>

                    <td className="px-5 py-4 sm:px-6">
                      <MemberStatus member={member} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-line-soft border-t border-line-soft md:hidden">
            {roster.map((member) => (
              <li key={member.id} className="flex flex-col gap-3 px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <MemberCell
                    initials={member.initials}
                    name={member.name}
                    location={member.role}
                  />

                  <MemberStatus member={member} />
                </div>

                <dl className="grid grid-cols-3 gap-3 text-[14px]">
                  <Stat label="Prospects" value={member.activeProspects} />
                  <Stat label="Actions" value={member.actionsThisPeriod} />
                  <Stat label="Overdue" value={member.overdue} danger={member.overdue > 0} />
                </dl>

                <CapacityBar percent={member.capacityPercent} />
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Needs attention" />

          <div className="flex flex-col gap-5">
            <AttentionGroup
              tone="bg-danger"
              icon={<CircleAlert aria-hidden="true" className="size-5 text-white" />}
              title={`${requests.length} pending override request${requests.length === 1 ? '' : 's'}`}
            >
              {requests.length === 0 ? (
                <p className="mt-1 text-[13px] text-ink-muted">
                  Nothing is waiting on a manager decision.
                </p>
              ) : (
                <ul className="mt-2 flex flex-col">
                  {requests.map((request) => (
                    <li key={request.id}>
                      <Link
                        href={`/manager/approvals/${request.id}`}
                        className="flex items-center gap-3 rounded-lg py-2 transition-colors hover:bg-surface-muted"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-semibold text-navy">
                            {request.reason}
                          </span>

                          <span className="block truncate text-[13px] text-ink-muted">
                            {formatDateTime(request.createdAt)}
                          </span>
                        </span>

                        <ChevronRight
                          aria-hidden="true"
                          className="size-4 shrink-0 text-ink-muted"
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              <Link
                href="/manager/approvals"
                className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-brand-wash py-2.5 text-[14px] font-semibold text-brand hover:bg-brand-tint"
              >
                <Users aria-hidden="true" className="size-[18px]" />
                Review approvals
              </Link>
            </AttentionGroup>

            <AttentionGroup
              tone="bg-surface-muted"
              icon={<UserRound aria-hidden="true" className="size-5 text-ink-muted" />}
              title={`${inactiveCount} inactive member${inactiveCount === 1 ? '' : 's'}`}
            >
              <p className="mt-1 text-[13px] text-ink-muted">No activity for 4 days</p>
            </AttentionGroup>
          </div>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] xl:items-start">
        <Card>
          <h2 className="text-[22px] font-bold tracking-[-0.02em] text-navy">
            Performance snapshot
          </h2>

          {/* Fed by /reports/conversions and /reports/follow-ups. A rate the
              API reports as null means nothing was measured, which is not the
              same as a rate of zero. */}
          {snapshot === null ? (
            <div className="mt-6 grid gap-6 sm:grid-cols-3" aria-busy="true">
              {[0, 1, 2].map((row) => (
                <div key={row} className="h-14 animate-pulse rounded-lg bg-line-soft" />
              ))}
            </div>
          ) : (
            <div className="mt-6 grid gap-6 sm:grid-cols-3">
              {snapshot.map((metric) => (
                <div key={metric.id} className="flex flex-col">
                  <span className="text-[26px] font-bold tracking-[-0.02em] text-navy">
                    {formatRate(metric.value)}
                  </span>

                  <span className="text-[14px] font-semibold text-ink">{metric.label}</span>

                  <span className="mt-1 text-[12px] text-ink-muted">{metric.caption}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="flex items-center gap-2.5 text-[22px] font-bold tracking-[-0.02em] text-navy">
              Territory coverage
              <PreviewTag />
            </h2>

            <Link
              href="/map"
              className="text-[14px] font-semibold text-brand hover:text-brand-hover"
            >
              Open map
            </Link>
          </div>

          {/* The territory model landed recently; this tile is wired when
              GET /territories/map is integrated. */}
          <Alert tone="info">
            Coverage clusters render once the territory map endpoint is integrated.
          </Alert>

          <LinkButton href="/map" className="mt-4 w-full">
            View territory map
          </LinkButton>
        </Card>
      </div>
    </div>
  );
}

function Th({
  children,
  align = 'left',
}: {
  children: React.ReactNode;
  align?: 'left' | 'center';
}) {
  return (
    <th
      scope="col"
      className={cn(
        'px-3 py-3 text-[13px] font-semibold text-ink-muted',
        align === 'center' && 'text-center',
      )}
    >
      {children}
    </th>
  );
}

function Stat({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div>
      <dt className="text-ink-muted">{label}</dt>

      <dd className={cn('font-bold tabular-nums', danger ? 'text-danger' : 'text-navy')}>
        {value}
      </dd>
    </div>
  );
}

function MemberStatus({ member }: { member: TeamRosterRow }) {
  const status = rosterStatus(member);

  if (status === 'at_risk') {
    return <Badge tone="warning">At risk</Badge>;
  }

  if (status === 'inactive') {
    return <Badge tone="neutral">Inactive</Badge>;
  }

  return <Badge tone="success">On track</Badge>;
}

function AttentionGroup({
  tone,
  icon,
  title,
  children,
}: {
  tone: string;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line-soft p-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', tone)}
        >
          {icon}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-bold text-navy">{title}</p>

          {children}
        </div>
      </div>
    </div>
  );
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
