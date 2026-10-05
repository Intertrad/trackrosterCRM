'use client';

import { useLiveRefresh } from '@/lib/live/use-live-refresh';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Map as MapIcon, UserMinus, UserPlus, Users } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CapacityBar } from '@/components/ui/capacity-bar';
import { Card, CardHeader } from '@/components/ui/card';
import { Drawer } from '@/components/ui/drawer';
import { FilterSelect } from '@/components/ui/filter-select';
import { PageHeader } from '@/components/ui/page-header';
import { SelectField } from '@/components/ui/select-field';
import { StatTile } from '@/components/ui/stat-tile';
import { ApiError } from '@/lib/api/api-error';
import { getManagerDashboard } from '@/lib/api/manager-dashboard-client';
import type { ManagerDashboardResponse } from '@/lib/api/manager-dashboard-types';
import {
  PeriodFilter,
  type ManagerPeriod,
  resolvePeriod,
} from '@/components/manager/manager-filters';
import { buildTeamRoster, rosterStatus } from '@/lib/manager/team-roster';
import { listScopedMemberships as listMemberships } from '@/lib/api/membership-client';
import { listTerritoryAssignments } from '@/lib/api/territory-client';
import type { TerritoryAssignment } from '@/lib/api/territory-types';
import {
  membershipInitials,
  membershipName,
  type MembershipSummary,
} from '@/lib/api/membership-types';
import {
  addRosterMember,
  endRosterMember,
  getTeamCapacity,
  listRoster,
  updateRosterMember,
} from '@/lib/api/team-client';
import {
  rosterStateTone,
  utilisationPercent,
  type RosterEntry,
  type RosterState,
  type TeamCapacity,
  type TeamCapacityMember,
  type TeamRole,
} from '@/lib/api/team-types';
import { useAuth } from '@/lib/auth/auth-context';

export default function TeamPage() {
  const { activeWorkspace } = useAuth();
  const teamId = activeWorkspace?.teamId ?? null;

  const [capacity, setCapacity] = useState<TeamCapacity | null>(null);
  const [roster, setRoster] = useState<RosterEntry[] | null>(null);
  const [dashboard, setDashboard] = useState<ManagerDashboardResponse | null>(null);
  const [period, setPeriod] = useState<ManagerPeriod>('this_week');
  const [people, setPeople] = useState<Map<string, MembershipSummary>>(new Map());
  const [state, setState] = useState<RosterState | 'all'>('active');

  const [readError, setReadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  /* Territory coverage is a read here: assigning one belongs to the
   * administrator's territory screens, not a team roster view. */
  const [territories, setTerritories] = useState<TerritoryAssignment[] | null>(null);

  const load = useCallback(
    (signal?: AbortSignal): Promise<void> => {
      if (!teamId) {
        return Promise.resolve();
      }

      return Promise.all([
        getTeamCapacity(teamId, signal).catch(() => null),
        listRoster(teamId, { state, limit: 100 }, signal),
        getManagerDashboard({ ...resolvePeriod(period), teamId }, signal).catch(() => null),
      ])
        .then(([loadedCapacity, loadedRoster, loadedDashboard]) => {
          if (signal?.aborted) {
            return;
          }

          setCapacity(loadedCapacity);
          setRoster(loadedRoster.items);
          setDashboard(loadedDashboard);
          setReadError(null);
        })
        .catch((caught: unknown) => {
          if (!signal?.aborted) {
            setRoster([]);
            setReadError(describeTeamError(caught));
          }
        });
    },
    [period, state, teamId],
  );

  useLiveRefresh(load);

  useEffect(() => {
    const controller = new AbortController();

    void load(controller.signal);

    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    if (!teamId) {
      return;
    }

    const controller = new AbortController();

    listTerritoryAssignments({ teamId, state: 'active', limit: 100 }, controller.signal)
      .then((page) => setTerritories(page.items))
      .catch(() => setTerritories([]));

    return () => controller.abort();
  }, [teamId]);

  /* Roster rows carry only a membershipId; names come from /memberships. */
  useEffect(() => {
    const controller = new AbortController();

    listMemberships({ limit: 100 }, controller.signal)
      .then((page) => setPeople(new Map(page.items.map((item) => [item.id, item]))))
      .catch(() => setPeople(new Map()));

    return () => controller.abort();
  }, []);

  const capacityByMembership = useMemo(() => {
    const map = new Map<string, TeamCapacityMember>();

    for (const member of capacity?.members.items ?? []) {
      map.set(member.membershipId, member);
    }

    return map;
  }, [capacity]);

  const rostered = useMemo(() => new Set((roster ?? []).map((row) => row.membershipId)), [roster]);

  const assignable = useMemo(
    () => [...people.values()].filter((person) => !rostered.has(person.id)),
    [people, rostered],
  );

  const totals = useMemo(() => {
    const members = capacity?.members.items ?? [];

    const targeted = members.filter((member) => member.capacity !== null);

    return {
      size: roster?.length ?? 0,
      workload: members.reduce((sum, member) => sum + Number(member.globalWorkload), 0),
      target: targeted.reduce((sum, member) => sum + (member.capacity ?? 0), 0),
      untargeted: members.length - targeted.length,
    };
  }, [capacity, roster]);

  const activityRoster = useMemo(
    () => buildTeamRoster(people.size ? [...people.values()] : [], dashboard),
    [dashboard, people],
  );

  async function run(action: string, operation: () => Promise<unknown>, success: string) {
    setBusy(action);
    setActionError(null);
    setNotice(null);

    try {
      await operation();
      await load();
      setNotice(success);
    } catch (caught) {
      setActionError(describeTeamError(caught));
    } finally {
      setBusy(null);
    }
  }

  if (!teamId) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Team" />

        <Alert tone="info" title="This view is scoped to a team.">
          Switch to a team workspace to manage its roster and workload.
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Team Activity"
        subtitle="Workload and execution per prospector"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <PeriodFilter value={period} onChange={setPeriod} />
            <Button onClick={() => setAdding(true)}>
              <UserPlus aria-hidden="true" className="mr-2 size-4" />
              Add member
            </Button>
          </div>
        }
      />

      {readError ? (
        <Alert tone="danger">
          <span className="flex flex-wrap items-center gap-3">
            <span>{readError}</span>
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => void load()}
              disabled={busy === 'reload'}
            >
              Try again
            </Button>
          </span>
        </Alert>
      ) : null}

      {notice ? <Alert tone="success">{notice}</Alert> : null}

      {actionError ? <Alert tone="danger">{actionError}</Alert> : null}

      <Card padding="none" className="overflow-hidden">
        <CardHeader
          title="Team activity"
          action={<Activity aria-hidden="true" className="size-5 text-brand" />}
        />
        <p className="-mt-3 px-5 pb-3 text-[12px] text-ink-muted">
          Live actions, assignments and follow-ups from the manager dashboard
        </p>
        {dashboard === null ? (
          <div className="space-y-2 p-5" aria-busy="true">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="h-14 animate-pulse rounded-lg bg-line-soft" />
            ))}
          </div>
        ) : activityRoster.length === 0 ? (
          <p className="px-5 py-10 text-center text-[14px] text-ink-muted">
            No team activity returned for this period.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="border-b border-line-soft text-left text-[10px] font-bold uppercase tracking-[0.1em] text-ink-muted">
                  <th className="px-5 py-3">Prospector</th>
                  <th className="px-3 py-3 text-right">Assigned prospects</th>
                  <th className="px-3 py-3 text-right">Actions ({period.replace('_', ' ')})</th>
                  <th className="px-3 py-3 text-right">Open follow-ups</th>
                  <th className="px-3 py-3 text-right">On track</th>
                  <th className="px-5 py-3 text-right">Activity trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {activityRoster.map((member) => {
                  const status = rosterStatus(member);
                  return (
                    <tr key={member.id}>
                      <td className="px-5 py-3">
                        <span className="flex items-center gap-3">
                          <span className="flex size-8 items-center justify-center rounded-full bg-brand-tint text-[11px] font-extrabold text-brand">
                            {member.initials}
                          </span>
                          <span>
                            <span className="block font-semibold text-navy">{member.name}</span>
                            <span className="block text-[12px] text-ink-muted">{member.role}</span>
                          </span>
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right text-[13px] font-semibold tabular-nums text-navy">
                        {member.activeProspects}
                      </td>
                      <td className="px-3 py-3 text-right text-[13px] font-semibold tabular-nums text-navy">
                        {member.actionsThisPeriod}
                      </td>
                      <td className="px-3 py-3 text-right text-[13px] tabular-nums text-ink">
                        {member.pendingFollowUps}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Badge
                          tone={
                            status === 'at_risk'
                              ? 'warning'
                              : status === 'inactive'
                                ? 'neutral'
                                : 'success'
                          }
                          dot
                        >
                          {status === 'at_risk'
                            ? 'At risk'
                            : status === 'inactive'
                              ? 'No activity'
                              : 'On track'}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span
                          className="inline-flex h-7 items-end gap-1"
                          aria-label={`${member.actionsThisPeriod} actions`}
                        >
                          {[0.45, 0.62, 0.54, 0.76, 0.66, 0.9].map((scale, index) => (
                            <span
                              key={index}
                              className="w-1.5 rounded-t bg-brand/60"
                              style={{
                                height: `${Math.max(4, (member.actionsThisPeriod * scale) / 2)}px`,
                              }}
                            />
                          ))}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Actions by channel" />
          <p className="-mt-3 text-[12px] text-ink-muted">Team total · selected period</p>
          {dashboard ? (
            <ul className="mt-4 flex flex-col divide-y divide-line-soft">
              {Object.entries(dashboard.activities.byType)
                .sort(([, left], [, right]) => right - left)
                .slice(0, 6)
                .map(([channel, count]) => (
                  <li
                    key={channel}
                    className="flex items-center justify-between py-2.5 text-[13px]"
                  >
                    <span className="capitalize text-ink">{channel.replace(/_/g, ' ')}</span>
                    <span className="font-bold tabular-nums text-navy">{count}</span>
                  </li>
                ))}
              {Object.keys(dashboard.activities.byType).length === 0 ? (
                <li className="py-3 text-[13px] text-ink-muted">No channel activity returned.</li>
              ) : null}
            </ul>
          ) : (
            <div className="mt-4 h-24 animate-pulse rounded-lg bg-line-soft" aria-busy="true" />
          )}
        </Card>

        <Card>
          <CardHeader title="Coverage and follow-ups" />
          <p className="-mt-3 text-[12px] text-ink-muted">Current server aggregates</p>
          <dl className="mt-4 divide-y divide-line-soft text-[13px]">
            <div className="flex items-center justify-between py-2.5">
              <dt className="text-ink-muted">Active prospectors</dt>
              <dd className="font-bold tabular-nums text-navy">
                {dashboard?.activities.activeProspectors ?? '—'}
              </dd>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <dt className="text-ink-muted">Pending follow-ups</dt>
              <dd className="font-bold tabular-nums text-navy">
                {dashboard?.followUps.pending ?? '—'}
              </dd>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <dt className="text-ink-muted">Overdue</dt>
              <dd
                className={
                  (dashboard?.followUps.overdue ?? 0) > 0
                    ? 'font-bold tabular-nums text-danger'
                    : 'font-bold tabular-nums text-success'
                }
              >
                {dashboard?.followUps.overdue ?? '—'}
              </dd>
            </div>
          </dl>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={<Users aria-hidden="true" className="size-5" />}
          tone="brand"
          value={roster === null ? null : totals.size}
          label="Rostered"
          delta={state === 'all' ? 'All periods' : `${state} periods`}
        />

        <StatTile
          icon={<Users aria-hidden="true" className="size-5" />}
          tone="neutral"
          value={capacity === null ? null : totals.workload}
          label="Assigned prospects"
        />

        <StatTile
          icon={<Users aria-hidden="true" className="size-5" />}
          tone="neutral"
          value={capacity === null ? null : totals.target || '—'}
          label="Combined target"
          delta={totals.untargeted > 0 ? `${totals.untargeted} without a target` : undefined}
        />

        <StatTile
          icon={<Users aria-hidden="true" className="size-5" />}
          tone={(capacity?.paused ?? 0) > 0 ? 'warning' : 'neutral'}
          value={capacity?.paused ?? null}
          label="Paused assignments"
        />
      </div>

      <Card>
        <CardHeader
          title="Roster"
          action={
            <FilterSelect
              label="Period"
              value={state}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'scheduled', label: 'Scheduled' },
                { value: 'ended', label: 'Ended' },
                { value: 'revoked', label: 'Revoked' },
                { value: 'all', label: 'All' },
              ]}
              onChange={(value) => setState(value as RosterState | 'all')}
            />
          }
        />

        {roster === null ? (
          <div className="flex flex-col gap-2" aria-busy="true">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="h-16 animate-pulse rounded-lg bg-line-soft" />
            ))}
          </div>
        ) : roster.length === 0 ? (
          <p className="py-10 text-center text-[15px] text-ink-muted">
            {state === 'active'
              ? 'Nobody is rostered to this team right now.'
              : `No ${state} rostering periods.`}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-line-soft">
            {roster.map((entry) => {
              const person = people.get(entry.membershipId);
              const workload = capacityByMembership.get(entry.membershipId);
              const percent = workload ? utilisationPercent(workload) : null;

              return (
                <li key={entry.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 py-3.5">
                  <span className="flex min-w-0 flex-1 items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-tint text-[13px] font-bold text-brand"
                    >
                      {person ? membershipInitials(person) : '—'}
                    </span>

                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-semibold text-navy">
                        {person ? membershipName(person) : entry.membershipId.slice(0, 8)}
                      </span>

                      <span className="block truncate text-[13px] text-ink-muted">
                        {person?.email ?? '—'}
                      </span>
                    </span>
                  </span>

                  <span className="w-40 shrink-0">
                    {workload ? (
                      percent === null ? (
                        <span className="text-[13px] text-ink-muted">
                          {workload.globalWorkload} assigned · no target
                        </span>
                      ) : (
                        <span className="flex flex-col gap-1">
                          <CapacityBar percent={percent} />

                          <span className="text-[12px] text-ink-muted">
                            {workload.globalWorkload} of {workload.capacity}
                          </span>
                        </span>
                      )
                    ) : (
                      <span className="text-[13px] text-ink-muted">—</span>
                    )}
                  </span>

                  <Badge tone={entry.teamRole === 'manager' ? 'brand' : 'neutral'}>
                    {entry.teamRole === 'manager' ? 'Team manager' : 'Member'}
                  </Badge>

                  <Badge tone={rosterStateTone(entry.state)}>{entry.state}</Badge>

                  {entry.state === 'active' || entry.state === 'scheduled' ? (
                    <span className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        loading={busy === `role-${entry.id}`}
                        disabled={busy !== null}
                        onClick={() =>
                          void run(
                            `role-${entry.id}`,
                            () =>
                              updateRosterMember(
                                teamId,
                                entry.membershipId,
                                {
                                  teamRole: entry.teamRole === 'manager' ? 'member' : 'manager',
                                },
                                entry.etag,
                              ),
                            'Team role updated.',
                          )
                        }
                      >
                        {entry.teamRole === 'manager' ? 'Make member' : 'Make manager'}
                      </Button>

                      <Button
                        variant="secondary"
                        loading={busy === `end-${entry.id}`}
                        disabled={busy !== null}
                        onClick={() =>
                          void run(
                            `end-${entry.id}`,
                            () => endRosterMember(teamId, entry.membershipId, entry.etag),
                            'Rostering ended.',
                          )
                        }
                      >
                        <UserMinus aria-hidden="true" className="mr-1.5 size-4" />
                        End
                      </Button>
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        <Alert tone="info" className="mt-5" title="Ending a rostering is not a removal.">
          It closes this person’s period on this team. Their workspace membership, and any other
          team they are rostered to, are unaffected.
        </Alert>
      </Card>

      <Card>
        <CardHeader title="Territory coverage" />

        {territories === null ? (
          <div className="flex flex-col gap-2" aria-busy="true">
            {[0, 1].map((row) => (
              <div key={row} className="h-12 animate-pulse rounded-lg bg-line-soft" />
            ))}
          </div>
        ) : territories.length === 0 ? (
          <p className="py-8 text-center text-[15px] text-ink-muted">
            No territory is assigned to this team.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-line-soft">
            {territories.map((assignment) => (
              <li
                key={assignment.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5"
              >
                <MapIcon aria-hidden="true" className="size-4 shrink-0 text-ink-muted" />

                <span className="min-w-0 flex-1 truncate text-[14px] text-ink">
                  {assignment.territoryId.slice(0, 8)}
                </span>

                {assignment.priority !== null ? (
                  <Badge tone="neutral">Priority {assignment.priority}</Badge>
                ) : null}

                <Badge tone={assignment.state === 'active' ? 'success' : 'neutral'}>
                  {assignment.state}
                </Badge>
              </li>
            ))}
          </ul>
        )}

        {/* Territory names live behind GET /territories/:id, one call per
            row. The id is shown rather than firing a request per territory. */}
        <p className="mt-4 text-[13px] text-ink-muted">
          Territories are shown by identifier; open the map for their boundaries.
        </p>
      </Card>

      <AddMemberDrawer
        open={adding}
        candidates={assignable}
        busy={busy === 'add'}
        onClose={() => setAdding(false)}
        onAdd={(membershipId, teamRole) =>
          run(
            'add',
            () => addRosterMember(teamId, { membershipId, teamRole }),
            'Member added to the team.',
          ).then(() => setAdding(false))
        }
      />
    </div>
  );
}

function AddMemberDrawer({
  open,
  candidates,
  busy,
  onClose,
  onAdd,
}: {
  open: boolean;
  candidates: MembershipSummary[];
  busy: boolean;
  onClose: () => void;
  onAdd: (membershipId: string, teamRole: TeamRole) => void;
}) {
  const [membershipId, setMembershipId] = useState('');
  const [teamRole, setTeamRole] = useState<TeamRole>('member');

  useEffect(() => {
    if (open) {
      setMembershipId('');
      setTeamRole('member');
    }
  }, [open]);

  return (
    <Drawer open={open} title="Add a team member" onClose={onClose}>
      <div className="flex flex-col gap-5">
        {candidates.length === 0 ? (
          <Alert tone="info" title="Everyone is already rostered.">
            Invite someone to the workspace first, from Users &amp; roles.
          </Alert>
        ) : (
          <>
            <SelectField
              label="Person"
              value={membershipId}
              disabled={busy}
              onChange={(event) => setMembershipId(event.target.value)}
              options={[
                { value: '', label: 'Choose a person…' },
                ...candidates.map((person) => ({
                  value: person.id,
                  label: `${membershipName(person)} · ${person.email}`,
                })),
              ]}
            />

            <SelectField
              label="Team role"
              value={teamRole}
              disabled={busy}
              onChange={(event) => setTeamRole(event.target.value as TeamRole)}
              options={[
                { value: 'member', label: 'Member' },
                { value: 'manager', label: 'Team manager' },
              ]}
            />

            <p className="-mt-2 text-[13px] text-ink-muted">
              The rostering starts now. A team role is separate from the workspace role that governs
              their permissions.
            </p>

            <Button
              fullWidth
              loading={busy}
              disabled={membershipId === ''}
              onClick={() => onAdd(membershipId, teamRole)}
            >
              Add to team
            </Button>
          </>
        )}
      </div>
    </Drawer>
  );
}

function describeTeamError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return 'Something went wrong. Please try again.';
  }

  if (error.statusCode === 403) {
    return 'You are not authorized to manage this team.';
  }

  if (error.statusCode === 409 || error.statusCode === 412) {
    return 'This roster changed elsewhere. Reload before trying again.';
  }

  if (error.statusCode === 400) {
    return error.messages.join(' ');
  }

  return 'We could not load this team. Please try again.';
}
