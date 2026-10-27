'use client';

import { useLiveRefresh } from '@/lib/live/use-live-refresh';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Map as MapIcon, UserMinus, UserPlus, Users } from 'lucide-react';

import { ActivityCharts } from '@/components/ui/activity-charts';
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
import { useTranslation } from '@/lib/i18n/i18n-context';
import { text } from '@/lib/workspace/copy';

export default function TeamPage() {
  const { activeWorkspace } = useAuth();
  const { language } = useTranslation();
  const l = (en: string, fr: string) => text(en, fr, language);
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
            setReadError(describeTeamError(caught, language));
          }
        });
    },
    [language, period, state, teamId],
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
      setActionError(describeTeamError(caught, language));
    } finally {
      setBusy(null);
    }
  }

  if (!teamId) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={l('Team', 'Équipe')} />

        <Alert
          tone="info"
          title={l('This view is scoped to a team.', 'Cette vue est rattachée à une équipe.')}
        >
          {l(
            'Switch to a team workspace to manage its roster and workload.',
            'Passez à un espace d’équipe pour gérer son effectif et sa charge.',
          )}
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={l('Team Activity', 'Activité de l’équipe')}
        subtitle={l('Workload and execution per prospector', 'Charge et exécution par prospecteur')}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <PeriodFilter value={period} onChange={setPeriod} />
            <Button onClick={() => setAdding(true)}>
              <UserPlus aria-hidden="true" className="mr-2 size-4" />
              {l('Add member', 'Ajouter un membre')}
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
              {l('Try again', 'Réessayer')}
            </Button>
          </span>
        </Alert>
      ) : null}

      {notice ? <Alert tone="success">{notice}</Alert> : null}

      {actionError ? <Alert tone="danger">{actionError}</Alert> : null}

      <Card padding="none" className="overflow-hidden">
        <CardHeader
          title={l('Team activity', 'Activité de l’équipe')}
          className="px-5 pt-5"
          action={<Activity aria-hidden="true" className="size-5 text-brand" />}
        />
        <p className="-mt-3 px-5 pb-4 text-[12px] text-ink-muted">
          {l(
            'Live actions, assignments and follow-ups from the manager dashboard',
            'Actions, attributions et relances en direct depuis le tableau de bord manager',
          )}
        </p>
        {dashboard === null ? (
          <div className="space-y-2 p-5" aria-busy="true">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="h-14 animate-pulse rounded-lg bg-line-soft" />
            ))}
          </div>
        ) : activityRoster.length === 0 ? (
          <p className="px-5 py-10 text-center text-[14px] text-ink-muted">
            {l(
              'No team activity returned for this period.',
              'Aucune activité d’équipe pour cette période.',
            )}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="border-b border-line-soft text-left text-[10px] font-bold uppercase tracking-[0.1em] text-ink-muted">
                  <th className="px-5 py-3">{l('Prospector', 'Prospecteur')}</th>
                  <th className="px-3 py-3 text-right">
                    {l('Assigned prospects', 'Prospects attribués')}
                  </th>
                  <th className="px-3 py-3 text-right">
                    {l('Actions', 'Actions')} ({period.replace('_', ' ')})
                  </th>
                  <th className="px-3 py-3 text-right">
                    {l('Open follow-ups', 'Relances ouvertes')}
                  </th>
                  <th className="px-3 py-3 text-right">{l('On track', 'Dans les temps')}</th>
                  <th className="px-5 py-3 text-right">
                    {l('Activity trend', 'Tendance d’activité')}
                  </th>
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
                            ? l('At risk', 'À risque')
                            : status === 'inactive'
                              ? l('No activity', 'Aucune activité')
                              : l('On track', 'Dans les temps')}
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
        <ActivityCharts period={period} mode="channels" />

        <Card>
          <CardHeader title={l('Coverage and follow-ups', 'Couverture et relances')} />
          <p className="-mt-3 text-[12px] text-ink-muted">
            {l('Current server aggregates', 'Agrégats actuels du serveur')}
          </p>
          <dl className="mt-4 divide-y divide-line-soft text-[13px]">
            <div className="flex items-center justify-between py-2.5">
              <dt className="text-ink-muted">{l('Active prospectors', 'Prospecteurs actifs')}</dt>
              <dd className="font-bold tabular-nums text-navy">
                {dashboard?.activities.activeProspectors ?? '—'}
              </dd>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <dt className="text-ink-muted">{l('Pending follow-ups', 'Relances en attente')}</dt>
              <dd className="font-bold tabular-nums text-navy">
                {dashboard?.followUps.pending ?? '—'}
              </dd>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <dt className="text-ink-muted">{l('Overdue', 'En retard')}</dt>
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
          label={l('Rostered', 'Dans l’effectif')}
          delta={
            state === 'all'
              ? l('All periods', 'Toutes les périodes')
              : `${state} ${l('periods', 'périodes')}`
          }
        />

        <StatTile
          icon={<Users aria-hidden="true" className="size-5" />}
          tone="neutral"
          value={capacity === null ? null : totals.workload}
          label={l('Assigned prospects', 'Prospects attribués')}
        />

        <StatTile
          icon={<Users aria-hidden="true" className="size-5" />}
          tone="neutral"
          value={capacity === null ? null : totals.target || '—'}
          label={l('Combined target', 'Objectif cumulé')}
          delta={
            totals.untargeted > 0
              ? `${totals.untargeted} ${l('without a target', 'sans objectif')}`
              : undefined
          }
        />

        <StatTile
          icon={<Users aria-hidden="true" className="size-5" />}
          tone={(capacity?.paused ?? 0) > 0 ? 'warning' : 'neutral'}
          value={capacity?.paused ?? null}
          label={l('Paused assignments', 'Attributions suspendues')}
        />
      </div>

      <Card>
        <CardHeader
          title={l('Roster', 'Effectif')}
          action={
            <FilterSelect
              label={l('Period', 'Période')}
              value={state}
              options={[
                { value: 'active', label: l('Active', 'Active') },
                { value: 'scheduled', label: l('Scheduled', 'Planifiée') },
                { value: 'ended', label: l('Ended', 'Terminée') },
                { value: 'revoked', label: l('Revoked', 'Révoquée') },
                { value: 'all', label: l('All', 'Toutes') },
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
              ? l(
                  'Nobody is rostered to this team right now.',
                  'Personne n’est actuellement dans l’effectif de cette équipe.',
                )
              : `${l('No', 'Aucune')} ${state} ${l('rostering periods.', 'période d’effectif.')}`}
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
                          {workload.globalWorkload}{' '}
                          {l('assigned · no target', 'attribués · sans objectif')}
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
                    {entry.teamRole === 'manager'
                      ? l('Team manager', 'Responsable d’équipe')
                      : l('Member', 'Membre')}
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
                            l('Team role updated.', 'Rôle d’équipe mis à jour.'),
                          )
                        }
                      >
                        {entry.teamRole === 'manager'
                          ? l('Make member', 'Rendre membre')
                          : l('Make manager', 'Rendre responsable')}
                      </Button>

                      <Button
                        variant="secondary"
                        loading={busy === `end-${entry.id}`}
                        disabled={busy !== null}
                        onClick={() =>
                          void run(
                            `end-${entry.id}`,
                            () => endRosterMember(teamId, entry.membershipId, entry.etag),
                            l('Rostering ended.', 'Période d’effectif terminée.'),
                          )
                        }
                      >
                        <UserMinus aria-hidden="true" className="mr-1.5 size-4" />
                        {l('End', 'Terminer')}
                      </Button>
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        <Alert
          tone="info"
          className="mt-5"
          title={l(
            'Ending a rostering is not a removal.',
            'Terminer une période ne supprime pas la personne.',
          )}
        >
          {l(
            'It closes this person’s period on this team. Their workspace membership, and any other team they are rostered to, are unaffected.',
            'La période de cette personne dans l’équipe est clôturée. Son appartenance à l’espace et ses autres équipes restent inchangées.',
          )}
        </Alert>
      </Card>

      <Card>
        <CardHeader title={l('Territory coverage', 'Couverture territoriale')} />

        {territories === null ? (
          <div className="flex flex-col gap-2" aria-busy="true">
            {[0, 1].map((row) => (
              <div key={row} className="h-12 animate-pulse rounded-lg bg-line-soft" />
            ))}
          </div>
        ) : territories.length === 0 ? (
          <p className="py-8 text-center text-[15px] text-ink-muted">
            {l(
              'No territory is assigned to this team.',
              'Aucun territoire n’est attribué à cette équipe.',
            )}
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
                  <Badge tone="neutral">
                    {l('Priority', 'Priorité')} {assignment.priority}
                  </Badge>
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
          {l(
            'Territories are shown by identifier; open the map for their boundaries.',
            'Les territoires sont affichés par identifiant ; ouvrez la carte pour voir leurs limites.',
          )}
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
            l('Member added to the team.', 'Membre ajouté à l’équipe.'),
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
  const { language } = useTranslation();
  const l = (en: string, fr: string) => text(en, fr, language);
  const [membershipId, setMembershipId] = useState('');
  const [teamRole, setTeamRole] = useState<TeamRole>('member');

  useEffect(() => {
    if (open) {
      setMembershipId('');
      setTeamRole('member');
    }
  }, [open]);

  return (
    <Drawer
      open={open}
      title={l('Add a team member', 'Ajouter un membre à l’équipe')}
      onClose={onClose}
    >
      <div className="flex flex-col gap-5">
        {candidates.length === 0 ? (
          <Alert
            tone="info"
            title={l('Everyone is already rostered.', 'Tout le monde est déjà dans l’effectif.')}
          >
            {l(
              'Invite someone to the workspace first, from Users & roles.',
              'Invitez d’abord une personne dans l’espace depuis Utilisateurs et rôles.',
            )}
          </Alert>
        ) : (
          <>
            <SelectField
              label={l('Person', 'Personne')}
              value={membershipId}
              disabled={busy}
              onChange={(event) => setMembershipId(event.target.value)}
              options={[
                { value: '', label: l('Choose a person…', 'Choisir une personne…') },
                ...candidates.map((person) => ({
                  value: person.id,
                  label: `${membershipName(person)} · ${person.email}`,
                })),
              ]}
            />

            <SelectField
              label={l('Team role', 'Rôle dans l’équipe')}
              value={teamRole}
              disabled={busy}
              onChange={(event) => setTeamRole(event.target.value as TeamRole)}
              options={[
                { value: 'member', label: l('Member', 'Membre') },
                { value: 'manager', label: l('Team manager', 'Responsable d’équipe') },
              ]}
            />

            <p className="-mt-2 text-[13px] text-ink-muted">
              {l(
                'The rostering starts now. A team role is separate from the workspace role that governs their permissions.',
                'La période commence maintenant. Le rôle d’équipe est distinct du rôle d’espace qui régit ses autorisations.',
              )}
            </p>

            <Button
              fullWidth
              loading={busy}
              disabled={membershipId === ''}
              onClick={() => onAdd(membershipId, teamRole)}
            >
              {l('Add to team', 'Ajouter à l’équipe')}
            </Button>
          </>
        )}
      </div>
    </Drawer>
  );
}

function describeTeamError(error: unknown, language: string = 'en'): string {
  const l = (en: string, fr: string) => text(en, fr, language);
  if (!(error instanceof ApiError)) {
    return l('Something went wrong. Please try again.', 'Une erreur est survenue. Réessayez.');
  }

  if (error.statusCode === 403) {
    return l(
      'You are not authorized to manage this team.',
      'Vous n’êtes pas autorisé à gérer cette équipe.',
    );
  }

  if (error.statusCode === 409 || error.statusCode === 412) {
    return l(
      'This roster changed elsewhere. Reload before trying again.',
      'Cet effectif a changé ailleurs. Rechargez avant de réessayer.',
    );
  }

  if (error.statusCode === 400) {
    return error.messages.join(' ');
  }

  return l(
    'We could not load this team. Please try again.',
    'Impossible de charger cette équipe. Réessayez.',
  );
}
