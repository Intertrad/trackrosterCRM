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
import { useTranslation } from '@/lib/i18n/i18n-context';

function describeError(error: unknown, fallback: string, forbidden = fallback) {
  if (error instanceof ApiError && error.statusCode === 403) {
    return forbidden;
  }
  return error instanceof Error ? error.message : fallback;
}

function statusTone(status: string): 'success' | 'warning' | 'neutral' {
  return status === 'active' ? 'success' : status === 'paused' ? 'warning' : 'neutral';
}

export function DirectorCompaniesPage() {
  const { t } = useTranslation();
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
        if (!signal?.aborted)
          setError(
            describeError(caught, t('director.loadCompaniesError'), t('director.scopeError')),
          );
      }
    },
    [search, status, t],
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
        title={t('director.companies.title')}
        subtitle={t('director.companies.subtitle')}
        action={
          <Button
            variant="secondary"
            leadingIcon={<RefreshCw className="size-4" />}
            onClick={() => void load()}
          >
            {t('director.refresh')}
          </Button>
        }
      />
      {error ? (
        <Alert tone="danger" title={t('director.companies.unavailable')}>
          {error}
        </Alert>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          icon={<Building2 className="size-5" />}
          tone="neutral"
          value={organizations?.length ?? null}
          label={t('director.companies.inScope')}
        />
        <StatTile
          icon={<Users className="size-5" />}
          tone="brand"
          value={campaigns.length || null}
          label={t('director.campaignsLinked')}
        />
        <StatTile
          icon={<Building2 className="size-5" />}
          tone="success"
          value={
            organizations
              ? organizations.filter((organization) => organization.status === 'active').length
              : null
          }
          label={t('director.activeCompanies')}
        />
      </div>
      <Card>
        <CardHeader
          title={t('director.companies.title')}
          action={
            <FilterSelect
              label={t('director.status')}
              value={status}
              options={[
                { value: 'active', label: t('director.active') },
                { value: 'inactive', label: t('director.inactive') },
                { value: 'all', label: t('director.all') },
              ]}
              onChange={setStatus}
            />
          }
        />
        <SearchInput
          label={t('director.searchCompanies')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onClear={() => setSearch('')}
          placeholder={t('director.searchCompanyPlaceholder')}
        />
        {organizations === null ? (
          <div className="mt-5 space-y-2" aria-busy="true">
            {[0, 1, 2].map((row) => (
              <div key={row} className="h-14 animate-pulse rounded-lg bg-line-soft" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <p className="py-12 text-center text-sm text-ink-muted">{t('director.noCompanies')}</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead className="border-b border-line-soft text-[11px] uppercase tracking-[0.08em] text-ink-muted">
                <tr>
                  <th className="px-3 py-3">{t('director.company')}</th>
                  <th className="px-3 py-3">{t('director.status')}</th>
                  <th className="px-3 py-3">{t('director.campaigns')}</th>
                  <th className="px-3 py-3">{t('director.website')}</th>
                  <th className="px-3 py-3 text-right">{t('director.details')}</th>
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
  const { t } = useTranslation();
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
      title={organization?.shortName ?? organization?.name ?? t('director.companyDetail')}
      onClose={onClose}
    >
      <div className="space-y-5">
        {loading ? <p className="text-sm text-ink-muted">{t('director.loadingCompany')}</p> : null}
        <Card>
          <CardHeader
            title={t('director.companyProfile')}
            action={
              organization ? (
                <Link
                  href={`/director/companies/${organization.id}`}
                  className="text-[13px] font-bold text-brand hover:underline"
                >
                  {t('director.openDetail')}
                </Link>
              ) : undefined
            }
          />
          <dl className="divide-y divide-line-soft">
            <FieldRow label={t('director.name')}>
              {String(detail?.name ?? organization?.name ?? '—')}
            </FieldRow>
            <FieldRow label={t('director.status')}>
              <Badge tone={statusTone(String(detail?.status ?? organization?.status))}>
                {String(detail?.status ?? organization?.status ?? '—')}
              </Badge>
            </FieldRow>
            <FieldRow label={t('director.website')}>
              {String(detail?.website ?? organization?.website ?? '—')}
            </FieldRow>
            <FieldRow label={t('director.address')}>
              {String(detail?.address ?? organization?.address ?? '—')}
            </FieldRow>
          </dl>
        </Card>
        <Card>
          <CardHeader title={t('director.campaigns')} />
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
            <p className="text-sm text-ink-muted">{t('director.noCampaigns')}</p>
          )}
        </Card>
        <Alert tone="info">{t('director.readOnlyNotice')}</Alert>
      </div>
    </Drawer>
  );
}

export function DirectorCompanyDetailPage({ organizationId }: { organizationId: string }) {
  const { t } = useTranslation();
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
      .catch((caught) =>
        setError(describeError(caught, t('director.loadCompanyError'), t('director.scopeError'))),
      );
    return () => controller.abort();
  }, [organizationId, t]);
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={String(organization?.name ?? t('director.companyDetail'))}
        subtitle={t('director.directorReadOnly')}
        action={
          <Link href="/director/companies" className="text-sm font-bold text-brand">
            {t('director.backCompanies')}
          </Link>
        }
      />
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Card>
        <CardHeader title={t('director.companyProfile')} />
        <dl className="grid gap-x-8 divide-y divide-line-soft sm:grid-cols-2 sm:divide-y-0">
          <FieldRow label={t('director.status')}>{String(organization?.status ?? '—')}</FieldRow>
          <FieldRow label="Slug">{String(organization?.slug ?? '—')}</FieldRow>
          <FieldRow label={t('director.website')}>{String(organization?.website ?? '—')}</FieldRow>
          <FieldRow label={t('director.address')}>{String(organization?.address ?? '—')}</FieldRow>
          <FieldRow label={t('director.phone')}>{String(organization?.phone ?? '—')}</FieldRow>
          <FieldRow label={t('director.email')}>{String(organization?.email ?? '—')}</FieldRow>
        </dl>
      </Card>
      <Card>
        <CardHeader title={t('director.campaignsInScope')} />
        {campaigns.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="rounded-lg border border-line-soft p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-navy">{campaign.name}</span>
                  <Badge tone={statusTone(campaign.status)}>{campaign.status}</Badge>
                </div>
                <p className="mt-2 text-sm text-ink-muted">
                  {campaign.description ?? t('director.noDescription')}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-muted">{t('director.noCampaigns')}</p>
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
  const { t } = useTranslation();
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [capacities, setCapacities] = useState<Map<string, TeamCapacity>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const page = await listTeams({ limit: 100 }, signal);
        const capacityEntries = await Promise.all(
          page.items.map(
            async (team) => [team.id, await getTeamCapacity(team.id, signal)] as const,
          ),
        );
        if (!signal?.aborted) {
          setTeams(page.items);
          setCapacities(new Map(capacityEntries));
          setError(null);
        }
      } catch (caught) {
        if (!signal?.aborted)
          setError(describeError(caught, t('director.loadTeamsError'), t('director.scopeError')));
      }
    },
    [t],
  );
  useLiveRefresh(load);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t('director.teams.title')}
        subtitle={t('director.teams.subtitle')}
        action={
          <Button
            variant="secondary"
            leadingIcon={<RefreshCw className="size-4" />}
            onClick={() => void load()}
          >
            {t('director.refresh')}
          </Button>
        }
      />
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Card padding="none" className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[13px]">
            <thead className="bg-surface-muted text-[11px] uppercase tracking-[0.08em] text-ink-muted">
              <tr>
                <th className="px-5 py-3">{t('director.team')}</th>
                <th className="px-3 py-3">{t('director.organization')}</th>
                <th className="px-3 py-3">{t('director.members')}</th>
                <th className="px-3 py-3">{t('director.assignedProspects')}</th>
                <th className="px-3 py-3">{t('director.paused')}</th>
                <th className="px-5 py-3 text-right">{t('director.status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {teams === null ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-ink-muted">
                    {t('director.loadingCapacity')}
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
      <Alert tone="info" title={t('director.readOnlyAccess')}>
        {t('director.teamsNotice')}
      </Alert>
    </div>
  );
}
