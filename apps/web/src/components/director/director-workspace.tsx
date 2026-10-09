'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, ChevronRight, RefreshCw, Users } from 'lucide-react';
import Link from 'next/link';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, FieldRow } from '@/components/ui/card';
import { Drawer } from '@/components/ui/drawer';
import { FilterSelect } from '@/components/ui/filter-select';
import { PageHeader } from '@/components/ui/page-header';
import { SearchInput } from '@/components/ui/search-input';
import { StatTile } from '@/components/ui/stat-tile';
import { useLiveRefresh } from '@/lib/live/use-live-refresh';
import { listCampaigns } from '@/lib/api/campaign-client';
import type { Campaign } from '@/lib/api/campaign-types';
import {
  getOrganization,
  listOrganizations,
  type OrganizationDetail,
  type OrganizationSummary,
} from '@/lib/api/organization-client';
import { listTeams, getTeamCapacity } from '@/lib/api/team-client';
import type { Team, TeamCapacity } from '@/lib/api/team-types';
import { ApiError } from '@/lib/api/api-error';

function describeError(error: unknown, fallback: string) {
  if (error instanceof ApiError && error.statusCode === 403) {
    return 'Your director grant does not include this scope.';
  }
  return error instanceof Error ? error.message : fallback;
}

function statusTone(status: string): 'success' | 'warning' | 'neutral' {
  return status === 'active' ? 'success' : status === 'paused' ? 'warning' : 'neutral';
}

export function DirectorCompaniesPage() {
  const [organizations, setOrganizations] = useState<OrganizationSummary[] | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('active');
  const [selected, setSelected] = useState<OrganizationSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const [organizationPage, campaignPage] = await Promise.all([
          listOrganizations(
            {
              status: status === 'all' ? undefined : (status as 'active' | 'inactive'),
              search: search.trim() || undefined,
              limit: 100,
            },
            signal,
          ),
          listCampaigns({ limit: 100 }, signal),
        ]);
        if (!signal?.aborted) {
          setOrganizations(organizationPage.items);
          setCampaigns(campaignPage.items);
          setError(null);
        }
      } catch (caught) {
        if (!signal?.aborted) setError(describeError(caught, 'We could not load companies.'));
      }
    },
    [search, status],
  );

  useLiveRefresh(load);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (organizations ?? []).filter(
      (organization) =>
        !query ||
        `${organization.name} ${organization.shortName ?? ''} ${organization.slug}`
          .toLowerCase()
          .includes(query),
    );
  }, [organizations, search]);
  const campaignCount = (organizationId: string) =>
    campaigns.filter((campaign) => campaign.organizationId === organizationId).length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Companies"
        subtitle="Organization-wide read-only view · coordination stays with workspace administrators"
        action={
          <Button
            variant="secondary"
            leadingIcon={<RefreshCw className="size-4" />}
            onClick={() => void load()}
          >
            Refresh
          </Button>
        }
      />
      {error ? (
        <Alert tone="danger" title="Companies unavailable">
          {error}
        </Alert>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          icon={<Building2 className="size-5" />}
          tone="neutral"
          value={organizations?.length ?? null}
          label="Companies in scope"
        />
        <StatTile
          icon={<Users className="size-5" />}
          tone="brand"
          value={campaigns.length || null}
          label="Campaigns linked"
        />
        <StatTile
          icon={<Building2 className="size-5" />}
          tone="success"
          value={
            organizations
              ? organizations.filter((organization) => organization.status === 'active').length
              : null
          }
          label="Active companies"
        />
      </div>
      <Card>
        <CardHeader
          title="Companies"
          action={
            <FilterSelect
              label="Status"
              value={status}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
                { value: 'all', label: 'All' },
              ]}
              onChange={setStatus}
            />
          }
        />
        <SearchInput
          label="Search companies"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onClear={() => setSearch('')}
          placeholder="Search company name or slug…"
        />
        {organizations === null ? (
          <div className="mt-5 space-y-2" aria-busy="true">
            {[0, 1, 2].map((row) => (
              <div key={row} className="h-14 animate-pulse rounded-lg bg-line-soft" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <p className="py-12 text-center text-sm text-ink-muted">No companies match this scope.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead className="border-b border-line-soft text-[11px] uppercase tracking-[0.08em] text-ink-muted">
                <tr>
                  <th className="px-3 py-3">Company</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Campaigns</th>
                  <th className="px-3 py-3">Website</th>
                  <th className="px-3 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {visible.map((organization) => (
                  <tr key={organization.id} className="hover:bg-surface-muted">
                    <td className="px-3 py-3.5">
                      <button
                        type="button"
                        className="block w-full rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                        onClick={() => setSelected(organization)}
                        aria-label={`Open ${organization.shortName ?? organization.name}`}
                      >
                        <span className="block font-semibold text-navy">
                          {organization.shortName ?? organization.name}
                        </span>
                        <span className="text-xs text-ink-muted">{organization.slug}</span>
                      </button>
                    </td>
                    <td className="px-3 py-3.5">
                      <Badge tone={statusTone(organization.status)} dot>
                        {organization.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-3.5 tabular-nums">{campaignCount(organization.id)}</td>
                    <td className="px-3 py-3.5 text-ink-muted">{organization.website ?? '—'}</td>
                    <td className="px-3 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => setSelected(organization)}
                        className="rounded p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                        aria-label={`Open ${organization.shortName ?? organization.name}`}
                      >
                        <ChevronRight
                          aria-hidden="true"
                          className="ml-auto size-4 text-ink-muted"
                        />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <DirectorCompanyDrawer
        organization={selected}
        campaigns={campaigns}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

function DirectorCompanyDrawer({
  organization,
  campaigns,
  onClose,
}: {
  organization: OrganizationSummary | null;
  campaigns: Campaign[];
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<OrganizationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setDetail(null);
    if (!organization) return;
    const controller = new AbortController();
    setLoading(true);
    void getOrganization(organization.id, controller.signal)
      .then((result) => setDetail(result.resource))
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [organization]);
  const companyCampaigns = organization
    ? campaigns.filter((campaign) => campaign.organizationId === organization.id)
    : [];
  return (
    <Drawer
      open={Boolean(organization)}
      title={organization?.shortName ?? organization?.name ?? 'Company detail'}
      onClose={onClose}
    >
      <div className="space-y-5">
        {loading ? <p className="text-sm text-ink-muted">Loading company detail…</p> : null}
        <Card>
          <CardHeader
            title="Company profile"
            action={
              organization ? (
                <Link
                  href={`/director/companies/${organization.id}`}
                  className="text-[13px] font-bold text-brand hover:underline"
                >
                  Open detail
                </Link>
              ) : undefined
            }
          />
          <dl className="divide-y divide-line-soft">
            <FieldRow label="Name">{String(detail?.name ?? organization?.name ?? '—')}</FieldRow>
            <FieldRow label="Status">
              <Badge tone={statusTone(String(detail?.status ?? organization?.status))}>
                {String(detail?.status ?? organization?.status ?? '—')}
              </Badge>
            </FieldRow>
            <FieldRow label="Website">
              {String(detail?.website ?? organization?.website ?? '—')}
            </FieldRow>
            <FieldRow label="Address">
              {String(detail?.address ?? organization?.address ?? '—')}
            </FieldRow>
          </dl>
        </Card>
        <Card>
          <CardHeader title="Campaigns" />
          {companyCampaigns.length ? (
            <ul className="divide-y divide-line-soft">
              {companyCampaigns.map((campaign) => (
                <li key={campaign.id} className="flex items-center justify-between gap-3 py-3">
                  <span className="font-semibold text-navy">{campaign.name}</span>
                  <Badge tone={statusTone(campaign.status)}>{campaign.status}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-muted">No campaigns in the authorized scope.</p>
          )}
        </Card>
        <Alert tone="info">
          Director access is read-only. Changes to company profiles and coordination policies remain
          in the administrator workspace.
        </Alert>
      </div>
    </Drawer>
  );
}

export function DirectorCompanyDetailPage({ organizationId }: { organizationId: string }) {
  const [organization, setOrganization] = useState<OrganizationDetail | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      getOrganization(organizationId, controller.signal),
      listCampaigns({ organizationId, limit: 100 }, controller.signal),
    ])
      .then(([result, campaignPage]) => {
        setOrganization(result.resource);
        setCampaigns(campaignPage.items);
      })
      .catch((caught) => setError(describeError(caught, 'We could not load this company.')));
    return () => controller.abort();
  }, [organizationId]);
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={String(organization?.name ?? 'Company detail')}
        subtitle="Director read-only view"
        action={
          <Link href="/director/companies" className="text-sm font-bold text-brand">
            Back to companies
          </Link>
        }
      />
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Card>
        <CardHeader title="Company profile" />
        <dl className="grid gap-x-8 divide-y divide-line-soft sm:grid-cols-2 sm:divide-y-0">
          <FieldRow label="Status">{String(organization?.status ?? '—')}</FieldRow>
          <FieldRow label="Slug">{String(organization?.slug ?? '—')}</FieldRow>
          <FieldRow label="Website">{String(organization?.website ?? '—')}</FieldRow>
          <FieldRow label="Address">{String(organization?.address ?? '—')}</FieldRow>
          <FieldRow label="Phone">{String(organization?.phone ?? '—')}</FieldRow>
          <FieldRow label="E-mail">{String(organization?.email ?? '—')}</FieldRow>
        </dl>
      </Card>
      <Card>
        <CardHeader title="Campaigns in scope" />
        {campaigns.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="rounded-lg border border-line-soft p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-navy">{campaign.name}</span>
                  <Badge tone={statusTone(campaign.status)}>{campaign.status}</Badge>
                </div>
                <p className="mt-2 text-sm text-ink-muted">
                  {campaign.description ?? 'No description'}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-muted">No campaigns in the authorized scope.</p>
        )}
      </Card>
      <Alert tone="info">
        This screen does not expose edit controls. Company and coordination changes are managed by
        client administrators.
      </Alert>
    </div>
  );
}

export function DirectorTeamsPage() {
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [capacities, setCapacities] = useState<Map<string, TeamCapacity>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const page = await listTeams({ limit: 100 }, signal);
      const capacityEntries = await Promise.all(
        page.items.map(async (team) => [team.id, await getTeamCapacity(team.id, signal)] as const),
      );
      if (!signal?.aborted) {
        setTeams(page.items);
        setCapacities(new Map(capacityEntries));
        setError(null);
      }
    } catch (caught) {
      if (!signal?.aborted) setError(describeError(caught, 'We could not load teams.'));
    }
  }, []);
  useLiveRefresh(load);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Teams"
        subtitle="Organization-wide team capacity and workload · read-only"
        action={
          <Button
            variant="secondary"
            leadingIcon={<RefreshCw className="size-4" />}
            onClick={() => void load()}
          >
            Refresh
          </Button>
        }
      />
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[13px]">
            <thead className="bg-surface-muted text-[11px] uppercase tracking-[0.08em] text-ink-muted">
              <tr>
                <th className="px-5 py-3">Team</th>
                <th className="px-3 py-3">Organization</th>
                <th className="px-3 py-3">Members</th>
                <th className="px-3 py-3">Assigned prospects</th>
                <th className="px-3 py-3">Paused</th>
                <th className="px-5 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {teams === null ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-ink-muted">
                    Loading team capacity…
                  </td>
                </tr>
              ) : (
                teams.map((team) => {
                  const capacity = capacities.get(team.id);
                  return (
                    <tr key={team.id}>
                      <td className="px-5 py-3.5 font-semibold text-navy">{team.name}</td>
                      <td className="px-3 py-3.5 text-ink-muted">
                        {team.organizationId.slice(0, 8)}
                      </td>
                      <td className="px-3 py-3.5 tabular-nums">
                        {capacity?.members.items.length ?? '—'}
                      </td>
                      <td className="px-3 py-3.5 tabular-nums">{capacity?.teamOwned ?? '—'}</td>
                      <td className="px-3 py-3.5 tabular-nums">{capacity?.paused ?? '—'}</td>
                      <td className="px-5 py-3.5 text-right">
                        <Badge tone={statusTone(team.status)} dot>
                          {team.status}
                        </Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
      <Alert tone="info" title="Read-only director access">
        Team membership, capacity targets and assignments are managed by authorized administrators
        and managers. This view reflects the live team APIs.
      </Alert>
    </div>
  );
}
