'use client';

import { useLiveRefresh } from '@/lib/live/use-live-refresh';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  ChevronRight,
  CircleAlert,
  Download,
  ShieldAlert,
  Target,
  TrendingUp,
  UserRound,
} from 'lucide-react';

import { MemberCell } from '@/components/manager/member-cell';
import {
  PeriodFilter,
  type ManagerPeriod,
  resolvePeriod,
} from '@/components/manager/manager-filters';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CapacityBar } from '@/components/ui/capacity-bar';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ApiError } from '@/lib/api/api-error';
import { getManagerDashboard } from '@/lib/api/manager-dashboard-client';
import type { ManagerDashboardResponse } from '@/lib/api/manager-dashboard-types';
import { listScopedMemberships as listMemberships } from '@/lib/api/membership-client';
import type { MembershipSummary } from '@/lib/api/membership-types';
import { listOverrideRequests } from '@/lib/api/override-client';
import type { OverrideRequestSummary } from '@/lib/api/override-types';
import { buildTeamRoster, rosterStatus, type TeamRosterRow } from '@/lib/manager/team-roster';
import { useAuth } from '@/lib/auth/auth-context';
import { cn } from '@/lib/ui/cn';

export default function TeamOverviewPage() {
  const { activeWorkspace } = useAuth();

  const [period, setPeriod] = useState<ManagerPeriod>('this_week');
  const [data, setData] = useState<ManagerDashboardResponse | null>(null);
  const [memberships, setMemberships] = useState<MembershipSummary[] | null>(null);
  const [requests, setRequests] = useState<OverrideRequestSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      try {
        const teamId = activeWorkspace?.teamId ?? undefined;

        const [response, membershipPage, requestPage] = await Promise.all([
          getManagerDashboard({ ...resolvePeriod(period), ...(teamId ? { teamId } : {}) }, signal),
          listMemberships({ ...(teamId ? { teamId } : {}), status: 'active', limit: 100 }, signal),
          /* The queue is advisory here; a failure must not blank the screen. */
          listPendingOverrideRequests(signal).catch(() => []),
        ]);

        if (signal?.aborted) {
          return;
        }

        setData(response);
        setMemberships(membershipPage.items);
        setRequests(requestPage);
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

  useLiveRefresh(load);

  useEffect(() => {
    const controller = new AbortController();

    void load(controller.signal);

    return () => controller.abort();
  }, [load]);

  const roster = useMemo(() => buildTeamRoster(memberships ?? [], data), [data, memberships]);

  const totals = useMemo(() => {
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
    };
  }, [data]);

  const inactiveCount = roster.filter((row) => rosterStatus(row) === 'inactive').length;

  const activitySeries = roster
    .map((member) => ({ label: member.name, value: member.actionsThisPeriod }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 7);
  const maxActivity = Math.max(...activitySeries.map((item) => item.value), 1);
  const channelSeries = Object.entries(data?.activities.byType ?? {})
    .map(([label, value]) => ({ label: label.replace(/_/g, ' '), value }))
    .sort((a, b) => b.value - a.value);
  const maxChannel = Math.max(...channelSeries.map((item) => item.value), 1);
  const onTrack = roster.length
    ? Math.round(
        (roster.filter((member) => rosterStatus(member) === 'on_track').length / roster.length) *
          100,
      )
    : null;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Team Dashboard"
        subtitle={`Team ${activeWorkspace?.teamId ? '· ' : ''}${new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · 30-second operational read`}
        action={
          <div className="flex flex-wrap items-center gap-2.5">
            <PeriodFilter value={period} onChange={setPeriod} />
            <Link
              href="/manager/exports"
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-line bg-surface px-3.5 text-[13px] font-bold text-ink hover:border-brand hover:text-brand"
            >
              <Download aria-hidden="true" className="size-4" /> Export
            </Link>
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <DashboardMetric
          icon={<Target aria-hidden="true" className="size-5" />}
          value={data ? totals.openAssignments : '—'}
          label="Active assignments"
          detail="Current team portfolio"
          tone="blue"
        />
        <DashboardMetric
          icon={<CalendarDays aria-hidden="true" className="size-5" />}
          value={data ? totals.pendingFollowUps : '—'}
          label="Follow-ups due"
          detail={data ? `${totals.followUpsCompleted} completed in range` : 'Waiting for API'}
          tone="indigo"
        />
        <DashboardMetric
          icon={<CircleAlert aria-hidden="true" className="size-5" />}
          value={data ? totals.overdue : '—'}
          label="Overdue"
          detail={data ? 'Needs attention' : 'Waiting for API'}
          tone="red"
        />
        <DashboardMetric
          icon={<ShieldAlert aria-hidden="true" className="size-5" />}
          value={data ? requests.length : '—'}
          label="Collisions / overrides"
          detail="Pending manager decision"
          tone="amber"
        />
        <DashboardMetric
          icon={<TrendingUp aria-hidden="true" className="size-5" />}
          value={onTrack === null ? '—' : `${onTrack}%`}
          label="On track"
          detail={data ? `${totals.activeProspectors} active prospectors` : 'Waiting for API'}
          tone="green"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(340px,1fr)] xl:items-start">
        <Card padding="none" className="overflow-hidden">
          <DashboardCardHeader
            title="Activity over time"
            subtitle="Actions logged · selected period"
            value={data ? `${totals.activitiesInPeriod} actions` : 'Waiting for API'}
          />
          <div className="flex min-h-[220px] items-end gap-4 px-6 pb-5 pt-8 sm:gap-7">
            {activitySeries.length ? (
              activitySeries.map((item, index) => (
                <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                  <div className="flex h-36 w-full items-end justify-center">
                    <div
                      className={cn(
                        'w-full max-w-10 rounded-t-md transition-[height]',
                        index === 0 ? 'bg-brand' : 'bg-brand/60',
                      )}
                      style={{ height: `${Math.max(8, (item.value / maxActivity) * 100)}%` }}
                      role="img"
                      aria-label={`${item.label}: ${item.value} actions`}
                    />
                  </div>
                  <span className="max-w-20 truncate text-center text-[11px] text-ink-muted">
                    {item.label}
                  </span>
                </div>
              ))
            ) : (
              <p className="w-full self-center text-center text-[13px] text-ink-muted">
                Activity bars appear when the manager API returns team members.
              </p>
            )}
          </div>
        </Card>

        <Card padding="none" className="overflow-hidden">
          <DashboardCardHeader title="Activity by channel" subtitle="Selected period" />
          <div className="flex min-h-[220px] items-center gap-6 px-6 py-6">
            <div
              className="flex size-36 shrink-0 items-center justify-center rounded-full"
              style={{ background: donutGradient(channelSeries) }}
              role="img"
              aria-label="Activity distribution by channel"
            >
              <div className="flex size-24 flex-col items-center justify-center rounded-full bg-surface text-center">
                <span className="text-[22px] font-extrabold text-navy">
                  {data ? totals.activitiesInPeriod : '—'}
                </span>
                <span className="text-[11px] text-ink-muted">complete</span>
              </div>
            </div>
            <ul className="min-w-0 flex-1 space-y-3">
              {channelSeries.length ? (
                channelSeries.slice(0, 5).map((item, index) => (
                  <li key={item.label} className="flex items-center gap-2 text-[12px]">
                    <span className={cn('size-2 rounded-full', channelTone(index))} />
                    <span className="min-w-0 flex-1 truncate capitalize text-ink">
                      {item.label}
                    </span>
                    <span className="font-bold tabular-nums text-navy">{item.value}</span>
                  </li>
                ))
              ) : (
                <li className="text-[13px] text-ink-muted">No channel data returned.</li>
              )}
            </ul>
          </div>
          {channelSeries.length ? (
            <div className="sr-only">Maximum channel count: {maxChannel}</div>
          ) : null}
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] xl:items-start">
        <Card padding="none" className="overflow-hidden">
          <DashboardCardHeader
            title="Team performance"
            subtitle="This week"
            action={
              <Link
                href="/manager/reports"
                className="text-[12px] font-bold text-brand hover:text-brand-hover"
              >
                View all
              </Link>
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse">
              <thead>
                <tr className="border-y border-line-soft text-left text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">
                  <th className="px-5 py-3">Prospector</th>
                  <th className="px-3 py-3 text-center">Actions</th>
                  <th className="px-3 py-3 text-center">Follow-ups</th>
                  <th className="px-5 py-3 text-right">On track</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {roster.map((member) => (
                  <tr key={member.id}>
                    <td className="px-5 py-3.5">
                      <MemberCell
                        initials={member.initials}
                        name={member.name}
                        location={member.role}
                      />
                    </td>
                    <td className="px-3 py-3.5 text-center text-[14px] font-semibold text-navy">
                      {member.actionsThisPeriod}
                    </td>
                    <td className="px-3 py-3.5 text-center text-[14px] font-semibold text-navy">
                      {member.pendingFollowUps}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-3">
                        <CapacityBar percent={member.capacityPercent} className="justify-end" />
                        <MemberStatus member={member} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!roster.length ? (
            <p className="px-5 py-6 text-[13px] text-ink-muted">
              Team members appear after the scoped membership API loads.
            </p>
          ) : null}
        </Card>

        <Card padding="none" className="overflow-hidden">
          <DashboardCardHeader title="Current risks" subtitle="Needs attention" />
          <div className="space-y-2 px-5 pb-5">
            {totals.overdue > 0 ? (
              <RiskRow tone="danger" icon={<CircleAlert aria-hidden="true" className="size-4" />}>
                <strong>{totals.overdue} overdue follow-ups</strong> need attention.
              </RiskRow>
            ) : null}
            {requests.length > 0 ? (
              <RiskRow tone="warning" icon={<ShieldAlert aria-hidden="true" className="size-4" />}>
                <strong>
                  {requests.length} pending override request{requests.length === 1 ? '' : 's'}
                </strong>{' '}
                awaiting manager decision.
              </RiskRow>
            ) : null}
            {inactiveCount > 0 ? (
              <RiskRow tone="warning" icon={<UserRound aria-hidden="true" className="size-4" />}>
                <strong>
                  {inactiveCount} inactive member{inactiveCount === 1 ? '' : 's'}
                </strong>{' '}
                have no recent activity.
              </RiskRow>
            ) : null}
            {!totals.overdue && !requests.length && !inactiveCount ? (
              <RiskRow tone="success" icon={<TrendingUp aria-hidden="true" className="size-4" />}>
                No active risks in the current scope.
              </RiskRow>
            ) : null}
            {requests.length > 0 ? (
              <ul className="space-y-1 pt-1">
                {requests.slice(0, 5).map((request) => (
                  <li key={request.id}>
                    <Link
                      href={`/manager/approvals/${request.id}`}
                      className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-[12px] text-ink-muted hover:bg-surface-muted hover:text-brand"
                    >
                      <span className="truncate">{request.reason}</span>
                      <ChevronRight aria-hidden="true" className="size-3.5 shrink-0" />
                    </Link>
                  </li>
                ))}
                {requests.length > 5 ? (
                  <li className="px-2 pt-1 text-[11px] text-ink-muted">
                    + {requests.length - 5} more pending request
                    {requests.length - 5 === 1 ? '' : 's'}
                  </li>
                ) : null}
              </ul>
            ) : null}
          </div>
        </Card>
      </div>

      <Card padding="none" className="overflow-hidden">
        <DashboardCardHeader
          title="Overdue follow-ups"
          subtitle="From the same scoped dashboard aggregate"
          action={
            <Link
              href="/follow-ups"
              className="text-[12px] font-bold text-brand hover:text-brand-hover"
            >
              All {totals.overdue}
            </Link>
          }
        />
        <div className="divide-y divide-line-soft">
          {totals.overdue > 0 ? (
            <div className="flex items-center justify-between gap-4 px-5 py-4 text-[13px]">
              <div className="flex min-w-0 items-center gap-3">
                <CircleAlert aria-hidden="true" className="size-4 shrink-0 text-danger" />
                <span className="truncate font-semibold text-navy">
                  {totals.overdue} follow-ups require manager attention
                </span>
              </div>
              <Link
                href="/follow-ups?overdue=true"
                className="shrink-0 text-brand hover:text-brand-hover"
              >
                Open queue <ChevronRight aria-hidden="true" className="inline size-4" />
              </Link>
            </div>
          ) : (
            <p className="px-5 py-5 text-[13px] text-ink-muted">
              No overdue follow-ups in this scope.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}

async function listPendingOverrideRequests(
  signal?: AbortSignal,
): Promise<OverrideRequestSummary[]> {
  const items: OverrideRequestSummary[] = [];
  let cursor: string | undefined;

  do {
    const page = await listOverrideRequests(
      { status: 'pending', limit: 100, ...(cursor ? { cursor } : {}) },
      signal,
    );

    items.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor && !signal?.aborted);

  return items;
}

function DashboardMetric({
  icon,
  value,
  label,
  detail,
  tone,
}: {
  icon: ReactNode;
  value: number | string;
  label: string;
  detail: string;
  tone: 'blue' | 'indigo' | 'red' | 'amber' | 'green';
}) {
  const tones = {
    blue: 'bg-blue-50 text-brand',
    indigo: 'bg-indigo-50 text-indigo-500',
    red: 'bg-red-50 text-danger',
    amber: 'bg-amber-50 text-amber-600',
    green: 'bg-emerald-50 text-emerald-600',
  } as const;

  return (
    <Card className="flex min-h-[112px] flex-col justify-between">
      <div className="flex items-start justify-between gap-3">
        <span className="text-[12px] font-semibold text-ink-muted">{label}</span>
        <span className={cn('flex size-8 items-center justify-center rounded-lg', tones[tone])}>
          {icon}
        </span>
      </div>
      <div>
        <p className="text-[26px] font-extrabold leading-none tracking-[-0.03em] text-navy">
          {value}
        </p>
        <p className="mt-2 truncate text-[11px] text-ink-muted">{detail}</p>
      </div>
    </Card>
  );
}

function DashboardCardHeader({
  title,
  subtitle,
  value,
  action,
}: {
  title: string;
  subtitle?: string;
  value?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line-soft px-5 py-4">
      <div>
        <h2 className="text-[15px] font-extrabold text-navy">{title}</h2>
        {subtitle ? <p className="mt-1 text-[12px] text-ink-muted">{subtitle}</p> : null}
      </div>
      {action ??
        (value ? (
          <span className="rounded-full bg-brand-tint px-3 py-1 text-[11px] font-bold text-brand">
            {value}
          </span>
        ) : null)}
    </div>
  );
}

function RiskRow({
  tone,
  icon,
  children,
}: {
  tone: 'danger' | 'warning' | 'success';
  icon: ReactNode;
  children: ReactNode;
}) {
  const styles = {
    danger: 'border-red-200 bg-red-50 text-red-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-700',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  } as const;

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border px-3 py-2.5 text-[12px]',
        styles[tone],
      )}
    >
      {icon}
      <span>{children}</span>
    </div>
  );
}

function channelTone(index: number): string {
  return ['bg-brand', 'bg-blue-400', 'bg-blue-200', 'bg-lime-400', 'bg-violet-400'][index % 5]!;
}

function donutGradient(series: Array<{ label: string; value: number }>): string {
  const total = series.reduce((sum, item) => sum + item.value, 0);
  if (!total) return '#e9eef8';
  const colors = ['#1f5eff', '#6f9bf1', '#a9c3f5', '#9bd63f', '#8b5cf6'];
  let cursor = 0;
  const stops = series.slice(0, colors.length).map((item, index) => {
    const start = cursor;
    cursor += (item.value / total) * 360;
    return `${colors[index]} ${start}deg ${cursor}deg`;
  });
  return `conic-gradient(${stops.join(', ')})`;
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
