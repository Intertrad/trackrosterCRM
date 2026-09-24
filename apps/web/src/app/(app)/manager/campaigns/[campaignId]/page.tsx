'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, MapPinned, UserPlus, Users } from 'lucide-react';

import { describeCampaignError } from '../page';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Drawer } from '@/components/ui/drawer';
import { FilterSelect } from '@/components/ui/filter-select';
import { PageHeader } from '@/components/ui/page-header';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import {
  addCampaignMember,
  getCampaign,
  listCampaignMembers,
  listCampaignOrganizations,
  removeCampaignMember,
  setCampaignStatus,
  updateCampaignMember,
} from '@/lib/api/campaign-client';
import {
  MAX_STATUS_REASON,
  MIN_STATUS_REASON,
  allowedTransitions,
  campaignStatusLabel,
  campaignStatusTone,
  memberRoleLabel,
  type Campaign,
  type CampaignMember,
  type CampaignMemberRole,
  type CampaignOrganization,
  type CampaignStatus,
  type ParticipationState,
} from '@/lib/api/campaign-types';
import { listMemberships } from '@/lib/api/membership-client';
import { membershipName, type MembershipSummary } from '@/lib/api/membership-types';

export default function CampaignDetailPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = use(params);

  return <CampaignDetail campaignId={campaignId} />;
}

function CampaignDetail({ campaignId }: { campaignId: string }) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [etag, setEtag] = useState<string | null>(null);
  const [members, setMembers] = useState<CampaignMember[] | null>(null);
  const [organizations, setOrganizations] = useState<CampaignOrganization[]>([]);
  const [people, setPeople] = useState<Map<string, MembershipSummary>>(new Map());
  const [state, setState] = useState<ParticipationState | 'all'>('active');

  const [readError, setReadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [transition, setTransition] = useState<CampaignStatus | null>(null);
  const [adding, setAdding] = useState(false);

  const load = useCallback(
    (signal?: AbortSignal): Promise<void> =>
      getCampaign(campaignId, signal)
        .then((result) => {
          if (!signal?.aborted) {
            setCampaign(result.resource);
            setEtag(result.etag);
            setReadError(null);
          }
        })
        .catch((caught: unknown) => {
          if (!signal?.aborted) {
            setReadError(describeCampaignError(caught));
          }
        }),
    [campaignId],
  );

  const loadMembers = useCallback(
    (signal?: AbortSignal): Promise<void> =>
      listCampaignMembers(campaignId, { state, limit: 100 }, signal)
        .then((page) => {
          if (!signal?.aborted) {
            setMembers(page.items);
          }
        })
        .catch(() => {
          if (!signal?.aborted) {
            setMembers([]);
          }
        }),
    [campaignId, state],
  );

  useEffect(() => {
    const controller = new AbortController();

    void load(controller.signal);

    listCampaignOrganizations(campaignId, { state: 'active' }, controller.signal)
      .then((page) => setOrganizations(page.items))
      .catch(() => setOrganizations([]));

    listMemberships({ limit: 100 }, controller.signal)
      .then((page) => setPeople(new Map(page.items.map((item) => [item.id, item]))))
      .catch(() => setPeople(new Map()));

    return () => controller.abort();
  }, [campaignId, load]);

  useEffect(() => {
    const controller = new AbortController();

    void loadMembers(controller.signal);

    return () => controller.abort();
  }, [loadMembers]);

  async function run(key: string, operation: () => Promise<unknown>, success: string) {
    setBusy(key);
    setActionError(null);
    setNotice(null);

    try {
      await operation();
      await Promise.all([load(), loadMembers()]);
      setNotice(success);
      setTransition(null);
    } catch (caught) {
      setActionError(describeCampaignError(caught));
    } finally {
      setBusy(null);
    }
  }

  if (readError && !campaign) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Campaign" />

        <Alert tone="danger" title="We could not load this campaign.">
          {readError}
        </Alert>

        <div>
          <Link href="/manager/campaigns" className="text-[14px] font-semibold text-brand">
            Back to campaigns
          </Link>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <div className="h-16 animate-pulse rounded-xl bg-line-soft" />

        <div className="h-64 animate-pulse rounded-xl bg-line-soft" />
      </div>
    );
  }

  const transitions = allowedTransitions(campaign.status);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <nav aria-label="Breadcrumb" className="mb-2 text-[13px] text-ink-muted">
          <Link href="/manager/campaigns" className="font-semibold text-brand hover:underline">
            Campaigns
          </Link>{' '}
          / {campaign.name}
        </nav>

        <PageHeader
          title={campaign.name}
          subtitle={campaign.description ?? undefined}
          action={
            <Badge tone={campaignStatusTone(campaign.status)} dot>
              {campaignStatusLabel(campaign.status)}
            </Badge>
          }
        />
      </div>

      {notice ? <Alert tone="success">{notice}</Alert> : null}

      {actionError ? <Alert tone="danger">{actionError}</Alert> : null}

      <Card>
        <CardHeader title="Status" />

        {transitions.length === 0 ? (
          <Alert tone="info" title="This campaign is closed.">
            An archived campaign cannot change status again.
          </Alert>
        ) : (
          <>
            <p className="-mt-3 mb-4 text-[15px] text-ink-muted">
              Only the transitions the API accepts from{' '}
              <strong>{campaignStatusLabel(campaign.status)}</strong> are offered.
            </p>

            <div className="flex flex-wrap gap-3">
              {transitions.map((next) => (
                <Button
                  key={next}
                  variant={next === 'archived' ? 'danger' : 'secondary'}
                  disabled={busy !== null}
                  onClick={() => setTransition(next)}
                >
                  {campaignStatusLabel(next)}
                </Button>
              ))}
            </div>
          </>
        )}
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] xl:items-start">
        <Card>
          <CardHeader
            title="Members"
            action={
              <div className="flex flex-wrap items-center gap-3">
                <FilterSelect
                  label="Period"
                  value={state}
                  options={[
                    { value: 'active', label: 'Active' },
                    { value: 'scheduled', label: 'Scheduled' },
                    { value: 'ended', label: 'Ended' },
                    { value: 'all', label: 'All' },
                  ]}
                  onChange={(value) => setState(value as ParticipationState | 'all')}
                />

                <Button onClick={() => setAdding(true)}>
                  <UserPlus aria-hidden="true" className="mr-2 size-4" />
                  Add
                </Button>
              </div>
            }
          />

          {members === null ? (
            <div className="flex flex-col gap-2" aria-busy="true">
              {[0, 1, 2].map((row) => (
                <div key={row} className="h-14 animate-pulse rounded-lg bg-line-soft" />
              ))}
            </div>
          ) : members.length === 0 ? (
            <p className="py-10 text-center text-[15px] text-ink-muted">
              Nobody is on this campaign for the selected period.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-line-soft">
              {members.map((member) => {
                const person = member.membershipId ? people.get(member.membershipId) : undefined;

                return (
                  <li
                    key={member.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2.5 py-3"
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-2.5">
                      <Users aria-hidden="true" className="size-4 shrink-0 text-ink-muted" />

                      <span className="min-w-0">
                        <span className="block truncate text-[15px] font-semibold text-navy">
                          {person
                            ? membershipName(person)
                            : member.teamId
                              ? 'Whole team'
                              : (member.membershipId?.slice(0, 8) ?? '—')}
                        </span>

                        <span className="block truncate text-[13px] text-ink-muted">
                          {person?.email ?? (member.teamId ? 'Team participation' : '—')}
                        </span>
                      </span>
                    </span>

                    <Badge tone={member.role === 'coordinator' ? 'brand' : 'neutral'}>
                      {memberRoleLabel(member.role)}
                    </Badge>

                    <Badge tone={member.state === 'active' ? 'success' : 'neutral'}>
                      {member.state}
                    </Badge>

                    {member.state === 'active' || member.state === 'scheduled' ? (
                      <span className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          loading={busy === `role-${member.id}`}
                          disabled={busy !== null}
                          onClick={() =>
                            void run(
                              `role-${member.id}`,
                              () =>
                                updateCampaignMember(
                                  member.id,
                                  {
                                    role: member.role === 'coordinator' ? 'member' : 'coordinator',
                                  },
                                  member.etag ?? null,
                                ),
                              'Campaign role updated.',
                            )
                          }
                        >
                          {member.role === 'coordinator' ? 'Make member' : 'Make coordinator'}
                        </Button>

                        <Button
                          variant="secondary"
                          loading={busy === `end-${member.id}`}
                          disabled={busy !== null}
                          onClick={() =>
                            void run(
                              `end-${member.id}`,
                              () => removeCampaignMember(member.id, member.etag ?? null),
                              'Participation ended.',
                            )
                          }
                        >
                          End
                        </Button>
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader title="Organizations" />

            {organizations.length === 0 ? (
              <p className="py-6 text-center text-[15px] text-ink-muted">
                No organization is scoped to this campaign.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-line-soft">
                {organizations.map((organization) => (
                  <li key={organization.id} className="flex items-center gap-3 py-2.5">
                    <Building2 aria-hidden="true" className="size-4 shrink-0 text-ink-muted" />

                    <span className="min-w-0 flex-1 truncate text-[14px] text-ink">
                      {organization.organizationId.slice(0, 8)}
                    </span>

                    <Badge tone={organization.accessMode === 'participate' ? 'brand' : 'neutral'}>
                      {organization.accessMode === 'participate' ? 'Participates' : 'Read only'}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Geographic allocation" />

            <p className="-mt-3 text-[15px] text-ink-muted">
              Distributes selected prospects across this campaign&apos;s territories. Preview shows
              the outcome without changing anything.
            </p>

            {/* The endpoint takes explicit prospect ids, which the bulk
                assignment screen already selects. Sending a selection from
                here would mean re-implementing that picker. */}
            <Alert tone="info" className="mt-4" title="Run this from Assignments.">
              Select the prospects you want to distribute on the assignments screen, where the
              picker and capacity view already live.
            </Alert>

            <Link
              href="/manager/assignments"
              className="mt-4 inline-flex items-center gap-2 text-[14px] font-semibold text-brand hover:text-brand-hover"
            >
              <MapPinned aria-hidden="true" className="size-4" />
              Open assignments
            </Link>
          </Card>
        </div>
      </div>

      <StatusDrawer
        campaign={campaign}
        next={transition}
        busy={busy !== null}
        onClose={() => setTransition(null)}
        onConfirm={(status, reason) =>
          run(
            'status',
            () => setCampaignStatus(campaign.id, status, reason, etag),
            `Campaign moved to ${campaignStatusLabel(status)}.`,
          )
        }
      />

      <AddMemberDrawer
        open={adding}
        candidates={[...people.values()]}
        busy={busy === 'add'}
        onClose={() => setAdding(false)}
        onAdd={(membershipId, role) =>
          run(
            'add',
            () => addCampaignMember(campaign.id, { membershipId, role }),
            'Member added to the campaign.',
          ).then(() => setAdding(false))
        }
      />
    </div>
  );
}

function StatusDrawer({
  campaign,
  next,
  busy,
  onClose,
  onConfirm,
}: {
  campaign: Campaign;
  next: CampaignStatus | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (status: CampaignStatus, reason: string) => void;
}) {
  const [reason, setReason] = useState('');

  useEffect(() => setReason(''), [next]);

  if (!next) {
    return <Drawer open={false} title="Change status" onClose={onClose} children={null} />;
  }

  return (
    <Drawer open title={`Move to ${campaignStatusLabel(next)}`} onClose={onClose}>
      <div className="flex flex-col gap-5">
        {next === 'archived' ? (
          <Alert tone="warning" title="Archiving is final.">
            An archived campaign cannot be reopened.
          </Alert>
        ) : null}

        <p className="text-[15px] text-ink-muted">
          {campaign.name} is currently {campaignStatusLabel(campaign.status).toLowerCase()}.
        </p>

        <TextField
          label="Reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Recorded against the transition"
          maxLength={MAX_STATUS_REASON}
          disabled={busy}
          required
        />

        <p className="-mt-3 text-[13px] text-ink-muted">At least {MIN_STATUS_REASON} characters.</p>

        <Button
          fullWidth
          loading={busy}
          variant={next === 'archived' ? 'danger' : 'primary'}
          disabled={reason.trim().length < MIN_STATUS_REASON}
          onClick={() => onConfirm(next, reason.trim())}
        >
          Move to {campaignStatusLabel(next)}
        </Button>
      </div>
    </Drawer>
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
  onAdd: (membershipId: string, role: CampaignMemberRole) => void;
}) {
  const [membershipId, setMembershipId] = useState('');
  const [role, setRole] = useState<CampaignMemberRole>('member');

  useEffect(() => {
    if (open) {
      setMembershipId('');
      setRole('member');
    }
  }, [open]);

  return (
    <Drawer open={open} title="Add a campaign member" onClose={onClose}>
      <div className="flex flex-col gap-5">
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
          label="Campaign role"
          value={role}
          disabled={busy}
          onChange={(event) => setRole(event.target.value as CampaignMemberRole)}
          options={[
            { value: 'member', label: 'Member' },
            { value: 'coordinator', label: 'Coordinator' },
            { value: 'observer', label: 'Observer' },
          ]}
        />

        <p className="-mt-2 text-[13px] text-ink-muted">
          An observer can read the campaign without being assigned work.
        </p>

        <Button
          fullWidth
          loading={busy}
          disabled={membershipId === ''}
          onClick={() => onAdd(membershipId, role)}
        >
          Add to campaign
        </Button>
      </div>
    </Drawer>
  );
}
