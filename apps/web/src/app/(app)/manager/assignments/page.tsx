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
  MAX_BATCH_SIZE,
  OUTCOME_LABELS,
  type AssignmentBatchResult,
  type UnassignedProspect,
} from '@/lib/api/assignment-types';
import { getManagerDashboard } from '@/lib/api/manager-dashboard-client';
import { listMemberships } from '@/lib/api/membership-client';
import type { MembershipSummary } from '@/lib/api/membership-types';
import { getWorkQueueOptions } from '@/lib/api/work-queue-client';
import type { WorkQueueCampaignOption } from '@/lib/api/work-queue-types';
import { useAuth } from '@/lib/auth/auth-context';
import { buildTeamRoster, rosterStatus } from '@/lib/manager/team-roster';
import { resolvePeriod } from '@/components/manager/manager-filters';
import { cn } from '@/lib/ui/cn';

export default function AssignmentsPage() {
  const { activeWorkspace } = useAuth();
  const teamId = activeWorkspace?.teamId ?? undefined;

  const [campaigns, setCampaigns] = useState<WorkQueueCampaignOption[]>([]);
  const [campaignId, setCampaignId] = useState('');
  const [unassigned, setUnassigned] = useState<UnassignedProspect[] | null>(null);
  const [memberships, setMemberships] = useState<MembershipSummary[]>([]);
  const [dashboard, setDashboard] = useState<Awaited<
    ReturnType<typeof getManagerDashboard>
  > | null>(null);

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetMemberId, setTargetMemberId] = useState<string | null>(null);

  const [preview, setPreview] = useState<AssignmentBatchResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /* Campaign is mandatory for the unassigned queue, so it is chosen first. */
  useEffect(() => {
    if (!teamId) {
      return;
    }

    const controller = new AbortController();

    getWorkQueueOptions({ teamId, signal: controller.signal })
      .then((options) => {
        if (controller.signal.aborted) {
          return;
        }

        setCampaigns(options.campaigns);
        setCampaignId((current) => current || (options.campaigns[0]?.id ?? ''));
      })
      .catch(() => setCampaigns([]));

    return () => controller.abort();
  }, [teamId]);

  useEffect(() => {
    const controller = new AbortController();

    Promise.all([
      listMemberships(
        { ...(teamId ? { teamId } : {}), status: 'active', limit: 100 },
        controller.signal,
      ),
      getManagerDashboard(
        { ...resolvePeriod('this_month'), ...(teamId ? { teamId } : {}) },
        controller.signal,
      ).catch(() => null),
    ])
      .then(([membershipPage, dashboardResult]) => {
        if (controller.signal.aborted) {
          return;
        }

        setMemberships(membershipPage.items);
        setDashboard(dashboardResult);
        setTargetMemberId((current) => current ?? membershipPage.items[0]?.id ?? null);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError('We could not load your team.');
        }
      });

    return () => controller.abort();
  }, [teamId]);

  const loadUnassigned = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      if (!campaignId) {
        setUnassigned([]);

        return;
      }

      try {
        const page = await listUnassignedProspects(
          { campaignId, ...(teamId ? { teamId } : {}), limit: MAX_BATCH_SIZE },
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
    [campaignId, teamId],
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

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();

    return (unassigned ?? []).filter(
      (prospect) => !query || prospect.name.toLowerCase().includes(query),
    );
  }, [search, unassigned]);

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

  async function runPreview(): Promise<void> {
    if (!campaignId || selected.size === 0 || !teamId) {
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
          teamId,
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
    if (!campaignId || selected.size === 0 || !teamId) {
      return;
    }

    setApplying(true);
    setError(null);

    try {
      const result = await applyAssignment(
        {
          campaignId,
          prospectIds: [...selected],
          teamId,
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

  if (!teamId) {
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
          onChange={setCampaignId}
          options={
            campaigns.length
              ? campaigns.map((campaign) => ({ value: campaign.id, label: campaign.name }))
              : [{ value: '', label: 'No campaigns' }]
          }
        />
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
              {search
                ? 'No prospects match your search.'
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

                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-navy">
                    {prospect.name}
                  </span>
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
              disabled={selected.size === 0 || !targetMemberId}
              onClick={() => void runPreview()}
            >
              Preview {selected.size} prospect{selected.size === 1 ? '' : 's'}
            </Button>

            <Button
              fullWidth
              loading={applying}
              disabled={!preview?.canApply || selected.size === 0}
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
