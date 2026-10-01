'use client';

import { useLiveRefresh } from '@/lib/live/use-live-refresh';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Megaphone, Plus } from 'lucide-react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Drawer } from '@/components/ui/drawer';
import { FilterSelect } from '@/components/ui/filter-select';
import { PageHeader } from '@/components/ui/page-header';
import { SearchInput } from '@/components/ui/search-input';
import { SelectField } from '@/components/ui/select-field';
import { StatTile } from '@/components/ui/stat-tile';
import { TextField } from '@/components/ui/text-field';
import { describeCampaignError } from '@/lib/api/campaign-error';
import { createCampaign, listCampaigns } from '@/lib/api/campaign-client';
import {
  campaignStatusLabel,
  campaignStatusTone,
  type Campaign,
  type CampaignStatus,
} from '@/lib/api/campaign-types';

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [status, setStatus] = useState<CampaignStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(
    (signal?: AbortSignal): Promise<void> =>
      listCampaigns({ limit: 100, ...(status === 'all' ? {} : { status }) }, signal)
        .then((page) => {
          if (!signal?.aborted) {
            setCampaigns(page.items);
            setError(null);
          }
        })
        .catch((caught: unknown) => {
          if (!signal?.aborted) {
            setCampaigns([]);
            setError(describeCampaignError(caught));
          }
        }),
    [status],
  );

  useLiveRefresh(load);

  useEffect(() => {
    const controller = new AbortController();

    void load(controller.signal);

    return () => controller.abort();
  }, [load]);

  const visible = useMemo(() => {
    if (!campaigns) {
      return [];
    }

    const query = search.trim().toLowerCase();

    return query === ''
      ? campaigns
      : campaigns.filter((campaign) => campaign.name.toLowerCase().includes(query));
  }, [campaigns, search]);

  const counts = useMemo(() => {
    const all = campaigns ?? [];

    return {
      total: all.length,
      active: all.filter((campaign) => campaign.status === 'active').length,
      draft: all.filter((campaign) => campaign.status === 'draft').length,
      paused: all.filter((campaign) => campaign.status === 'paused').length,
    };
  }, [campaigns]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Campaigns"
        subtitle="Scope, staff and run your prospecting campaigns"
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" className="mr-2 size-4" />
            New campaign
          </Button>
        }
      />

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {notice ? <Alert tone="success">{notice}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={<Megaphone aria-hidden="true" className="size-5" />}
          tone="success"
          value={campaigns === null ? null : counts.active}
          label="Active"
        />

        <StatTile
          icon={<Megaphone aria-hidden="true" className="size-5" />}
          tone="brand"
          value={campaigns === null ? null : counts.draft}
          label="Draft"
        />

        <StatTile
          icon={<Megaphone aria-hidden="true" className="size-5" />}
          tone={counts.paused > 0 ? 'warning' : 'neutral'}
          value={campaigns === null ? null : counts.paused}
          label="Paused"
        />

        <StatTile
          icon={<Megaphone aria-hidden="true" className="size-5" />}
          tone="neutral"
          value={campaigns === null ? null : counts.total}
          label="Shown"
        />
      </div>

      <Card>
        <CardHeader
          title="All campaigns"
          action={
            <FilterSelect
              label="Status"
              value={status}
              options={[
                { value: 'all', label: 'All' },
                { value: 'draft', label: 'Draft' },
                { value: 'active', label: 'Active' },
                { value: 'paused', label: 'Paused' },
                { value: 'completed', label: 'Completed' },
                { value: 'archived', label: 'Archived' },
              ]}
              onChange={(value) => setStatus(value as CampaignStatus | 'all')}
            />
          }
        />

        <SearchInput
          label="Search campaigns"
          placeholder="Search by name…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        {campaigns === null ? (
          <div className="mt-5 flex flex-col gap-2" aria-busy="true">
            {[0, 1, 2].map((row) => (
              <div key={row} className="h-16 animate-pulse rounded-lg bg-line-soft" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <p className="py-12 text-center text-[15px] text-ink-muted">
            {campaigns.length === 0
              ? 'No campaigns yet. Create one to start assigning prospects.'
              : 'No campaigns match this search.'}
          </p>
        ) : (
          <ul className="mt-5 flex flex-col divide-y divide-line-soft">
            {visible.map((campaign) => (
              <li key={campaign.id}>
                <Link
                  href={`/manager/campaigns/${campaign.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3.5 hover:opacity-80"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-navy">
                      {campaign.name}
                    </span>

                    <span className="block truncate text-[13px] text-ink-muted">
                      {formatWindow(campaign.startsAt, campaign.endsAt)}
                    </span>
                  </span>

                  <Badge tone={campaignStatusTone(campaign.status)} dot>
                    {campaignStatusLabel(campaign.status)}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <CreateCampaignDrawer
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(campaign) => {
          setCreating(false);
          setNotice(`${campaign.name} created as a draft.`);
          void load();
        }}
      />
    </div>
  );
}

function CreateCampaignDrawer({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (campaign: Campaign) => void;
}) {
  const [name, setName] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [organizations, setOrganizations] = useState<Array<{ id: string; name: string }> | null>(
    null,
  );
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setName('');
    setDescription('');
    setStartsAt('');
    setEndsAt('');
    setError(null);

    const controller = new AbortController();

    /* A campaign must belong to an organization, so the picker is populated
     * from the ones this caller can actually see. */
    fetch('/api/organizations', { cache: 'no-store', signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
      .then((page: { items?: Array<{ id: string; name: string }> }) => {
        const items = page.items ?? [];

        setOrganizations(items);
        setOrganizationId(items[0]?.id ?? '');
      })
      .catch(() => setOrganizations([]));

    return () => controller.abort();
  }, [open]);

  const dateInvalid = startsAt !== '' && endsAt !== '' && new Date(endsAt) < new Date(startsAt);

  return (
    <Drawer open={open} title="New campaign" onClose={onClose}>
      <div className="flex flex-col gap-5">
        {organizations !== null && organizations.length === 0 ? (
          <Alert tone="warning" title="No organization is available.">
            A campaign belongs to an organization. Ask an administrator to create one first.
          </Alert>
        ) : null}

        <TextField
          label="Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Q4 Outreach"
          maxLength={255}
          disabled={busy}
          required
        />

        <SelectField
          label="Organization"
          value={organizationId}
          disabled={busy || !organizations?.length}
          onChange={(event) => setOrganizationId(event.target.value)}
          options={
            organizations === null
              ? [{ value: '', label: 'Loading…' }]
              : organizations.map((organization) => ({
                  value: organization.id,
                  label: organization.name,
                }))
          }
        />

        <TextField
          label="Description (optional)"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="What this campaign is for"
          maxLength={10000}
          disabled={busy}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Starts (optional)"
            type="date"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
            disabled={busy}
          />

          <TextField
            label="Ends (optional)"
            type="date"
            value={endsAt}
            onChange={(event) => setEndsAt(event.target.value)}
            error={dateInvalid ? 'End date is before the start date' : null}
            disabled={busy}
          />
        </div>

        {error ? <Alert tone="danger">{error}</Alert> : null}

        <Alert tone="info" title="Campaigns start as a draft.">
          Nothing is assigned until you activate it from the campaign page.
        </Alert>

        <Button
          fullWidth
          loading={busy}
          disabled={name.trim() === '' || organizationId === '' || dateInvalid}
          onClick={() => {
            setBusy(true);
            setError(null);

            createCampaign({
              organizationId,
              name: name.trim(),
              ...(description.trim() ? { description: description.trim() } : {}),
              /* Dates are sent as ISO instants; the API parses with @Type(() => Date). */
              ...(startsAt ? { startsAt: new Date(startsAt).toISOString() } : {}),
              ...(endsAt ? { endsAt: new Date(endsAt).toISOString() } : {}),
            })
              .then(onCreated)
              .catch((caught: unknown) => setError(describeCampaignError(caught)))
              .finally(() => setBusy(false));
          }}
        >
          Create campaign
        </Button>
      </div>
    </Drawer>
  );
}

function formatWindow(startsAt: string | null, endsAt: string | null): string {
  const format = (value: string | null) =>
    value
      ? new Date(value).toLocaleDateString(undefined, {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : null;

  const from = format(startsAt);
  const to = format(endsAt);

  if (!from && !to) {
    return 'No dates set';
  }

  if (from && to) {
    return `${from} – ${to}`;
  }

  return from ? `From ${from}` : `Until ${to}`;
}
