'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Map as MapIcon, UserMinus, UserPlus, Users } from 'lucide-react';

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
import { listMemberships } from '@/lib/api/membership-client';
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
      ])
        .then(([loadedCapacity, loadedRoster]) => {
          if (signal?.aborted) {
            return;
          }

          setCapacity(loadedCapacity);
          setRoster(loadedRoster.items);
          setReadError(null);
        })
        .catch((caught: unknown) => {
          if (!signal?.aborted) {
            setRoster([]);
            setReadError(describeTeamError(caught));
          }
        });
    },
    [state, teamId],
  );

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
        title="Team"
        subtitle="Roster, roles and workload for your team"
        action={
          <Button onClick={() => setAdding(true)}>
            <UserPlus aria-hidden="true" className="mr-2 size-4" />
            Add member
          </Button>
        }
      />

      {readError ? <Alert tone="danger">{readError}</Alert> : null}

      {notice ? <Alert tone="success">{notice}</Alert> : null}

      {actionError ? <Alert tone="danger">{actionError}</Alert> : null}

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
