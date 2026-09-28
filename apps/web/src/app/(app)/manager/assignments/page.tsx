'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CircleAlert, Send, Users, X } from 'lucide-react';

import { MemberCell } from '@/components/manager/member-cell';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CapacityBar } from '@/components/ui/capacity-bar';
import { Card } from '@/components/ui/card';
import { FilterSelect } from '@/components/ui/filter-select';
import { LinkButton } from '@/components/ui/link-button';
import { PageHeader } from '@/components/ui/page-header';
import { SearchInput } from '@/components/ui/search-input';
import { StatTile } from '@/components/ui/stat-tile';
import { ApiError } from '@/lib/api/api-error';
import {
  applyAssignment,
  listUnassignedProspects,
  previewAssignment,
} from '@/lib/api/assignment-client';
import {
  CATEGORY_LABELS,
  MAX_BATCH_SIZE,
  OUTCOME_LABELS,
  type AssignmentBatchResult,
  type UnassignedProspect,
} from '@/lib/api/assignment-types';
import { ESTABLISHMENT_CATEGORIES, type EstablishmentCategory } from '@/lib/api/import-types';
import { getManagerDashboard } from '@/lib/api/manager-dashboard-client';
import { listCampaigns } from '@/lib/api/campaign-client';
import { listMemberships } from '@/lib/api/membership-client';
import type { MembershipSummary } from '@/lib/api/membership-types';
import { listTeams } from '@/lib/api/team-client';
import type { Team } from '@/lib/api/team-types';
import { getWorkQueueOptions } from '@/lib/api/work-queue-client';
import type { WorkQueueCampaignOption } from '@/lib/api/work-queue-types';
import { useAuth } from '@/lib/auth/auth-context';
import { buildTeamRoster, rosterStatus } from '@/lib/manager/team-roster';
import { resolvePeriod } from '@/components/manager/manager-filters';
import { cn } from '@/lib/ui/cn';

const TARGET_TEAM_REQUIRED = 'Select a target team before previewing assignments.';

export default function AssignmentsPage() {
  const { activeWorkspace } = useAuth();

  /*
   * Where the dispatch team comes from, and it is not always the workspace.
   *
   * A team-scoped manager dispatches into the team they already operate in. A
   * tenant-scoped administrator has no team at all, and this page used to read
   * that as "cannot dispatch" — which was a frontend assumption, not a backend
   * rule: `authorizeBatch` admits a tenant-scoped client_admin, and the API's
   * `targets()` then requires the team to belong to the campaign's organization.
   * So an administrator picks the team explicitly and everything downstream is
   * the API's existing behaviour.
   */
  const isAdmin = activeWorkspace?.mode === 'admin';
  const workspaceTeamId = activeWorkspace?.teamId ?? undefined;

  const [targetTeamId, setTargetTeamId] = useState('');

  const effectiveTeamId = isAdmin ? targetTeamId || undefined : workspaceTeamId;

  const [campaigns, setCampaigns] = useState<WorkQueueCampaignOption[]>([]);
  const [campaignId, setCampaignId] = useState('');

  /*
   * Only an administrator needs these. The organization is read from the chosen
   * campaign because the API refuses a team outside it, so offering the whole
   * tenant's teams would offer a guaranteed 400.
   */
  const [campaignOrganizations, setCampaignOrganizations] = useState<Map<string, string>>(
    () => new Map(),
  );
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [teamsError, setTeamsError] = useState(false);
  const [unassigned, setUnassigned] = useState<UnassignedProspect[] | null>(null);
  const [memberships, setMemberships] = useState<MembershipSummary[]>([]);
  const [dashboard, setDashboard] = useState<Awaited<
    ReturnType<typeof getManagerDashboard>
  > | null>(null);

  const [search, setSearch] = useState('');
  /*
   * What is actually sent. The référentiel is over 14,000 establishments and one
   * page holds 100, so the search has to reach the database — but not on every
   * keystroke, hence the short settle below.
   */
  const [appliedSearch, setAppliedSearch] = useState('');
  const [category, setCategory] = useState<EstablishmentCategory | ''>('');
  const [department, setDepartment] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetMemberId, setTargetMemberId] = useState<string | null>(null);

  const [preview, setPreview] = useState<AssignmentBatchResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /*
   * Campaign is mandatory for the unassigned queue, so it is chosen first — but
   * the list cannot come from the same place for both roles.
   *
   * The work-queue options are the caller's *own* assigned campaigns, which is
   * right for a manager and always empty for an administrator, who is assigned
   * nothing. It is emptiest exactly after a bulk enrolment, which is when an
   * administrator comes here. So administration reads the campaigns themselves.
   */
  useEffect(() => {
    const controller = new AbortController();

    if (isAdmin) {
      listCampaigns({ limit: 100, sort: 'name' }, controller.signal)
        .then((page) => {
          if (controller.signal.aborted) {
            return;
          }

          /* Completed and archived campaigns refuse assignment upstream. */
          const open = page.items.filter(
            (campaign) => campaign.status !== 'completed' && campaign.status !== 'archived',
          );

          setCampaigns(open.map((campaign) => ({ id: campaign.id, name: campaign.name })));
          setCampaignOrganizations(
            new Map(open.map((campaign) => [campaign.id, campaign.organizationId])),
          );
          setCampaignId((current) => current || (open[0]?.id ?? ''));
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setCampaigns([]);
          }
        });

      return () => controller.abort();
    }

    if (!workspaceTeamId) {
      return () => controller.abort();
    }

    getWorkQueueOptions({ teamId: workspaceTeamId, signal: controller.signal })
      .then((options) => {
        if (controller.signal.aborted) {
          return;
        }

        setCampaigns(options.campaigns);
        setCampaignId((current) => current || (options.campaigns[0]?.id ?? ''));
      })
      .catch(() => setCampaigns([]));

    return () => controller.abort();
  }, [isAdmin, workspaceTeamId]);

  /*
   * The teams an administrator may dispatch this campaign into: the campaign's
   * own organization, because `targets()` upstream answers 400 for any other.
   * Mirroring that rule here turns an impossible choice into one that is not
   * offered; the API remains the authority.
   */
  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    const organizationId = campaignId ? campaignOrganizations.get(campaignId) : undefined;

    if (!organizationId) {
      setTeams(campaignId ? null : []);

      return;
    }

    const controller = new AbortController();

    setTeams(null);
    setTeamsError(false);

    listTeams({ organizationId, limit: 100 }, controller.signal)
      .then((page) => {
        if (controller.signal.aborted) {
          return;
        }

        const active = page.items.filter((team) => team.status === 'active');

        setTeams(active);

        /*
         * Never auto-select. Dispatching a batch into a team is a decision, and
         * a pre-filled target is how the wrong team receives real work.
         */
        setTargetTeamId((current) => (active.some((team) => team.id === current) ? current : ''));
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setTeams([]);
          setTeamsError(true);
        }
      });

    return () => controller.abort();
  }, [campaignId, campaignOrganizations, isAdmin]);

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      /*
       * The roster has to be the target team's, not the workspace's: upstream
       * only accepts an assignee holding a prospector grant on that team.
       */
      listMemberships(
        { ...(effectiveTeamId ? { teamId: effectiveTeamId } : {}), status: 'active', limit: 100 },
        controller.signal,
      ),
      getManagerDashboard(
        { ...resolvePeriod('this_month'), ...(effectiveTeamId ? { teamId: effectiveTeamId } : {}) },
        controller.signal,
      ).catch(() => null),
    ])
      .then(([membershipPage, dashboardResult]) => {
        if (controller.signal.aborted) {
          return;
        }

        setMemberships(membershipPage.items);
        setDashboard(dashboardResult);

        /*
         * Re-resolve rather than keep: after a team change the previous member
         * belongs to the previous team, and assigning to them would be refused.
         */
        setTargetMemberId((current) =>
          current && membershipPage.items.some((member) => member.id === current)
            ? current
            : (membershipPage.items[0]?.id ?? null),
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError('We could not load your team.');
        }
      });

    return () => controller.abort();
  }, [effectiveTeamId]);

  useEffect(() => {
    const timer = setTimeout(() => setAppliedSearch(search.trim()), 300);

    return () => clearTimeout(timer);
  }, [search]);

  const loadUnassigned = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      if (!campaignId) {
        setUnassigned([]);

        return;
      }

      try {
        const page = await listUnassignedProspects(
          {
            campaignId,
            /*
             * Omitted until an administrator picks a team. The queue endpoint
             * accepts that from a tenant-scoped grant, so the work can be read
             * and judged before deciding who receives it.
             */
            ...(effectiveTeamId ? { teamId: effectiveTeamId } : {}),
            ...(appliedSearch ? { search: appliedSearch } : {}),
            ...(category ? { category } : {}),
            /* Two digits, or three overseas; anything shorter is still typing. */
            ...(/^(?:\d{2}|9[78]\d)$/.test(department) ? { department } : {}),
            limit: MAX_BATCH_SIZE,
          },
          signal,
        );

        if (signal?.aborted) {
          return;
        }

        setUnassigned(page.items);
        setError(null);
      } catch (caught) {
        if (signal?.aborted) {
          return;
        }

        setError(
          caught instanceof ApiError && caught.statusCode === 403
            ? 'You do not have assignment authority for this campaign.'
            : 'We could not load unassigned prospects.',
        );
      }
    },
    [appliedSearch, campaignId, category, department, effectiveTeamId],
  );

  useEffect(() => {
    const controller = new AbortController();

    setSelected(new Set());
    setPreview(null);
    setUnassigned(null);
    void loadUnassigned(controller.signal);

    return () => controller.abort();
  }, [loadUnassigned]);

  const roster = useMemo(() => buildTeamRoster(memberships, dashboard), [dashboard, memberships]);

  const visible = unassigned ?? [];

  const filtered = Boolean(appliedSearch || category || department);

  const target = roster.find((row) => row.id === targetMemberId) ?? null;

  function toggle(id: string): void {
    setPreview(null);

    setSelected((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < MAX_BATCH_SIZE) {
        next.add(id);
      }

      return next;
    });
  }

  /*
   * A missing target team is a validation state, not a silent no-op: an
   * administrator who clicks Preview and sees nothing happen has been told the
   * page is broken.
   */
  const missingTargetTeam = isAdmin && !effectiveTeamId;

  async function runPreview(): Promise<void> {
    if (!campaignId || selected.size === 0) {
      return;
    }

    if (!effectiveTeamId) {
      setError(TARGET_TEAM_REQUIRED);

      return;
    }

    setPreviewing(true);
    setError(null);
    setNotice(null);

    try {
      /* The server decides what can be assigned; the UI never guesses. */
      setPreview(
        await previewAssignment({
          campaignId,
          prospectIds: [...selected],
          teamId: effectiveTeamId,
          assignedUserId: targetMemberId,
        }),
      );
    } catch (caught) {
      setError(describeBatchError(caught));
    } finally {
      setPreviewing(false);
    }
  }

  async function runApply(): Promise<void> {
    if (!campaignId || selected.size === 0) {
      return;
    }

    /*
     * The same team the preview was taken against, from the same value. Applying
     * decisions computed for one team into another is the failure this guards:
     * capacity, eligibility and collisions were all judged for the other team.
     */
    if (!effectiveTeamId) {
      setError(TARGET_TEAM_REQUIRED);

      return;
    }

    setApplying(true);
    setError(null);

    try {
      const result = await applyAssignment(
        {
          campaignId,
          prospectIds: [...selected],
          teamId: effectiveTeamId,
          assignedUserId: targetMemberId,
        },
        crypto.randomUUID(),
      );

      setNotice(`${result.assigned} prospect${result.assigned === 1 ? '' : 's'} assigned.`);

      setSelected(new Set());
      setPreview(null);

      await loadUnassigned();
    } catch (caught) {
      setError(describeBatchError(caught));
    } finally {
      setApplying(false);
    }
  }

  /*
   * Only a scoped role needs a workspace team. An administrator has none and
   * chooses one below, which is what the API has always accepted.
   */
  if (!isAdmin && !workspaceTeamId) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Assignments" />

        <Alert tone="info" title="This view is scoped to a team.">
          Switch to a team workspace to balance portfolios.
        </Alert>
      </div>
    );
  }

  const atRisk = roster.filter((row) => rosterStatus(row) === 'at_risk').length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Assignments"
        subtitle="Balance prospect portfolios across your team"
        action={
          <LinkButton href="/manager/assignments/active" variant="secondary">
            Manage active assignments
          </LinkButton>
        }
      />

      {error ? <Alert tone="danger">{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      <div className="flex flex-wrap items-center gap-2.5">
        <SearchInput
          label="Search prospects"
          placeholder="Search prospects..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="min-w-[220px] flex-1"
        />

        <FilterSelect
          label="Campaign"
          value={campaignId}
          onChange={(value) => {
            setCampaignId(value);

            /*
             * A different campaign may belong to a different organization, so the
             * chosen team may no longer be a legal target.
             */
            if (isAdmin) {
              setTargetTeamId('');
              setPreview(null);
            }
          }}
          options={
            campaigns.length
              ? campaigns.map((campaign) => ({ value: campaign.id, label: campaign.name }))
              : [{ value: '', label: 'No campaigns' }]
          }
        />

        {/*
         * Administrators only. A team-scoped manager already operates inside
         * one team and re-picking it would be a question with one answer.
         */}
        {isAdmin ? (
          <FilterSelect
            label="Target team"
            tone="brand"
            value={targetTeamId}
            disabled={teams === null || teams.length === 0}
            onChange={(value) => {
              setTargetTeamId(value);

              /*
               * The preview was computed against the previous team's capacity and
               * eligibility, so it must not survive into this one.
               *
               * The queue-reload effect below already clears both the preview and
               * the selection when the effective team changes, so this is not the
               * only guard — but it is the local one, and the rule should not
               * depend on a dependency array somewhere else continuing to include
               * the team.
               */
              setPreview(null);
              setError(null);
            }}
            options={
              teams === null
                ? [{ value: '', label: campaignId ? 'Loading teams…' : 'Choose a campaign first' }]
                : teams.length === 0
                  ? [
                      {
                        value: '',
                        label: teamsError
                          ? 'Teams unavailable'
                          : 'No active team in this organization',
                      },
                    ]
                  : [
                      { value: '', label: 'Choose a team' },
                      ...teams.map((team) => ({ value: team.id, label: team.name })),
                    ]
            }
          />
        ) : null}

        <FilterSelect
          label="Section"
          value={category}
          onChange={(value) => setCategory(value as EstablishmentCategory | '')}
          options={[
            { value: '', label: 'All sections' },
            ...ESTABLISHMENT_CATEGORIES.map((value) => ({
              value,
              label: CATEGORY_LABELS[value],
            })),
          ]}
        />

        <div className="relative">
          <label htmlFor="department-filter" className="sr-only">
            Department
          </label>

          <input
            id="department-filter"
            inputMode="numeric"
            maxLength={3}
            placeholder="Dept."
            value={department}
            onChange={(event) => setDepartment(event.target.value.replace(/\D/g, ''))}
            className="h-11 w-24 rounded-full border border-line bg-surface px-4 text-[14px] font-semibold text-ink transition-colors duration-150 hover:border-brand-pale"
          />
        </div>
      </div>

      <Card>
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            icon={<Users aria-hidden="true" className="size-6" />}
            tone="brand"
            value={unassigned?.length ?? null}
            label="Unassigned prospects"
          />

          <StatTile
            icon={<Users aria-hidden="true" className="size-6" />}
            tone="success"
            value={dashboard?.assignments.current ?? null}
            label="Assigned prospects"
          />

          <StatTile
            icon={<Users aria-hidden="true" className="size-6" />}
            tone="neutral"
            value={roster.length}
            label="Team members"
          />

          <StatTile
            icon={<CircleAlert aria-hidden="true" className="size-6" />}
            tone="danger"
            value={atRisk}
            label="At-risk members"
          />
        </div>
      </Card>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="p-0 sm:p-0">
          <div className="flex items-center gap-3 px-5 py-4 sm:px-6">
            <h2 className="text-[19px] font-bold tracking-[-0.015em] text-navy">
              Unassigned prospects
            </h2>

            <Badge tone="neutral">{visible.length}</Badge>
          </div>

          {unassigned === null ? (
            <ListSkeleton />
          ) : visible.length === 0 ? (
            <p className="px-6 py-12 text-center text-[15px] text-ink-muted">
              {filtered
                ? 'No unassigned prospects match these filters.'
                : campaignId
                  ? 'Every prospect in this campaign is assigned.'
                  : 'Choose a campaign to see its unassigned prospects.'}
            </p>
          ) : (
            <ul className="max-h-[520px] divide-y divide-line-soft overflow-y-auto border-t border-line-soft">
              {visible.map((prospect) => (
                <li
                  key={prospect.campaignProspectId}
                  className="flex items-center gap-3 px-5 py-3 sm:px-6"
                >
                  <input
                    type="checkbox"
                    aria-label={`Select ${prospect.name}`}
                    checked={selected.has(prospect.campaignProspectId)}
                    onChange={() => toggle(prospect.campaignProspectId)}
                    className="size-[18px] shrink-0 cursor-pointer appearance-none rounded-[5px] border border-line bg-surface checked:border-brand checked:bg-brand"
                  />

                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-navy">
                      {prospect.name}
                    </span>

                    <span className="block truncate text-[13px] text-ink-muted">
                      {[
                        prospect.category ? CATEGORY_LABELS[prospect.category] : null,
                        [prospect.postalCode, prospect.city].filter(Boolean).join(' ') || null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </div>

                  {/*
                   * Both of these end in a refused reservation rather than a
                   * completed call, so a manager sees them before dispatching
                   * instead of the prospector discovering them afterwards.
                   */}
                  {prospect.contactBlocked ? <Badge tone="danger">Opposition</Badge> : null}

                  {prospect.activeElsewhere ? <Badge tone="warning">Active elsewhere</Badge> : null}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-0 sm:p-0">
          <div className="px-5 py-4 sm:px-6">
            <h2 className="text-[19px] font-bold tracking-[-0.015em] text-navy">Team capacity</h2>
          </div>

          {roster.length === 0 ? (
            <p className="px-6 py-12 text-center text-[15px] text-ink-muted">
              No active members in this team.
            </p>
          ) : (
            <ul className="divide-y divide-line-soft border-t border-line-soft">
              {roster.map((member) => (
                <li key={member.id}>
                  <label
                    className={cn(
                      'flex cursor-pointer flex-wrap items-center gap-3 px-5 py-3.5 transition-colors sm:px-6',
                      targetMemberId === member.id ? 'bg-brand-wash' : 'hover:bg-surface-muted',
                    )}
                  >
                    <input
                      type="radio"
                      name="target-member"
                      checked={targetMemberId === member.id}
                      onChange={() => {
                        setTargetMemberId(member.id);
                        setPreview(null);
                      }}
                      aria-label={`Assign to ${member.name}`}
                      className="size-[18px] shrink-0 cursor-pointer accent-[var(--color-brand)]"
                    />

                    <MemberCell
                      initials={member.initials}
                      name={member.name}
                      location={member.role}
                      className="min-w-0 flex-1 basis-36"
                    />

                    <span className="text-[15px] text-ink tabular-nums">
                      {member.activeProspects}
                    </span>

                    <CapacityBar percent={member.capacityPercent} />
                  </label>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 text-[19px] font-bold tracking-[-0.015em] text-navy">
            Assignment preview
          </h2>

          <dl className="flex flex-col gap-2 border-b border-line-soft pb-4 text-[14px]">
            <Row label="Selected">{selected.size}</Row>

            {isAdmin ? (
              <Row label="Target team">
                {teams?.find((team) => team.id === targetTeamId)?.name ?? 'None'}
              </Row>
            ) : null}

            <Row label="Target member">{target ? target.name : 'None'}</Row>
          </dl>

          {preview ? (
            <>
              <dl className="mt-4 flex flex-col gap-2 text-[14px]">
                <Row label="Will be assigned">{preview.proposed}</Row>

                <Row label="Conflicts">
                  <span className={preview.conflicts > 0 ? 'text-warning' : undefined}>
                    {preview.conflicts}
                  </span>
                </Row>
              </dl>

              {preview.decisions.some((d) => d.outcome !== 'proposed') ? (
                <ul className="mt-4 flex flex-col gap-2 border-t border-line-soft pt-4 text-[13px]">
                  {preview.decisions
                    .filter((decision) => decision.outcome !== 'proposed')
                    .slice(0, 8)
                    .map((decision) => (
                      <li key={decision.prospectId} className="flex items-start gap-2">
                        <CircleAlert
                          aria-hidden="true"
                          className="mt-0.5 size-4 shrink-0 text-warning"
                        />

                        <span className="text-ink-soft">{OUTCOME_LABELS[decision.outcome]}</span>
                      </li>
                    ))}
                </ul>
              ) : null}

              {!preview.canApply ? (
                <Alert tone="warning" className="mt-4">
                  Resolve the conflicts above before assigning — the server will refuse the batch
                  while any remain.
                </Alert>
              ) : null}
            </>
          ) : missingTargetTeam ? (
            /* Stated before the click, not after a request that goes nowhere. */
            <Alert tone="info" className="mt-4">
              {TARGET_TEAM_REQUIRED}
            </Alert>
          ) : (
            <p className="mt-4 text-[14px] text-ink-muted">
              Preview the batch to see what the server would assign.
            </p>
          )}

          <div className="mt-5 flex flex-col gap-3">
            <Button
              variant="secondary"
              fullWidth
              loading={previewing}
              disabled={
                selected.size === 0 ||
                !targetMemberId ||
                missingTargetTeam ||
                (isAdmin && teams === null)
              }
              onClick={() => void runPreview()}
            >
              Preview {selected.size} prospect{selected.size === 1 ? '' : 's'}
            </Button>

            <Button
              fullWidth
              loading={applying}
              disabled={!preview?.canApply || selected.size === 0 || missingTargetTeam}
              leadingIcon={<Send aria-hidden="true" className="size-[18px]" />}
              onClick={() => void runApply()}
            >
              Assign {preview?.proposed ?? selected.size} prospects
            </Button>
          </div>
        </Card>
      </div>

      {selected.size > 0 ? (
        <div
          role="region"
          aria-label="Bulk assignment actions"
          className="sticky bottom-20 z-20 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-raised lg:bottom-6"
        >
          <span className="text-[15px] font-semibold text-navy">
            {selected.size} prospect{selected.size === 1 ? '' : 's'} selected
            {selected.size === MAX_BATCH_SIZE ? ` (batch limit)` : ''}
          </span>

          <button
            type="button"
            onClick={() => {
              setSelected(new Set());
              setPreview(null);
            }}
            aria-label="Clear selection"
            className="ml-auto text-ink-muted hover:text-ink"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-ink-muted">{label}</dt>

      <dd className="font-semibold text-ink tabular-nums">{children}</dd>
    </div>
  );
}

function ListSkeleton() {
  return (
    <ul className="divide-y divide-line-soft border-t border-line-soft" aria-busy="true">
      {[0, 1, 2, 3].map((row) => (
        <li key={row} className="flex animate-pulse items-center gap-3 px-6 py-4">
          <span className="size-[18px] rounded bg-line-soft" />
          <span className="h-5 flex-1 rounded bg-line-soft" />
        </li>
      ))}
    </ul>
  );
}

function describeBatchError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return 'Something went wrong. Please try again.';
  }

  if (error.statusCode === 409) {
    /* Another manager assigned part of the lot first. */
    return 'Assignments changed while you were working. Preview again before assigning.';
  }

  if (error.statusCode === 403) {
    return 'You are not authorized to assign in this campaign.';
  }

  return 'We could not complete the assignment. Please try again.';
}
