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
import { useTranslation } from '@/lib/i18n/i18n-context';
import { text } from '@/lib/workspace/copy';

export default function CampaignsPage() {
  const { language } = useTranslation();
  const l = (en: string, fr: string) => text(en, fr, language);
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
            setError(describeCampaignError(caught, language));
          }
        }),
    [language, status],
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
        title={l('Campaigns', 'Campagnes')}
        subtitle={l(
          'Scope, staff and run your prospecting campaigns',
          'Cadrez, équipez et pilotez vos campagnes de prospection',
        )}
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" className="mr-2 size-4" />
            {l('New campaign', 'Nouvelle campagne')}
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
          label={l('Active', 'Actives')}
        />

        <StatTile
          icon={<Megaphone aria-hidden="true" className="size-5" />}
          tone="brand"
          value={campaigns === null ? null : counts.draft}
          label={l('Draft', 'Brouillons')}
        />

        <StatTile
          icon={<Megaphone aria-hidden="true" className="size-5" />}
          tone={counts.paused > 0 ? 'warning' : 'neutral'}
          value={campaigns === null ? null : counts.paused}
          label={l('Paused', 'En pause')}
        />

        <StatTile
          icon={<Megaphone aria-hidden="true" className="size-5" />}
          tone="neutral"
          value={campaigns === null ? null : counts.total}
          label={l('Shown', 'Affichées')}
        />
      </div>

      <Card>
        <CardHeader
          title={l('All campaigns', 'Toutes les campagnes')}
          action={
            <FilterSelect
              label={l('Status', 'Statut')}
              value={status}
              options={[
                { value: 'all', label: l('All', 'Toutes') },
                { value: 'draft', label: l('Draft', 'Brouillon') },
                { value: 'active', label: l('Active', 'Active') },
                { value: 'paused', label: l('Paused', 'En pause') },
                { value: 'completed', label: l('Completed', 'Terminée') },
                { value: 'archived', label: l('Archived', 'Archivée') },
              ]}
              onChange={(value) => setStatus(value as CampaignStatus | 'all')}
            />
          }
        />

        <SearchInput
          label={l('Search campaigns', 'Rechercher des campagnes')}
          placeholder={l('Search by name…', 'Rechercher par nom…')}
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
              ? l(
                  'No campaigns yet. Create one to start assigning prospects.',
                  'Aucune campagne. Créez-en une pour commencer à attribuer des prospects.',
                )
              : l(
                  'No campaigns match this search.',
                  'Aucune campagne ne correspond à cette recherche.',
                )}
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
                      {formatWindow(campaign.startsAt, campaign.endsAt, language)}
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
          setNotice(`${campaign.name} ${l('created as a draft.', 'a été créée comme brouillon.')}`);
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
  const { language } = useTranslation();
  const l = (en: string, fr: string) => text(en, fr, language);
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
    <Drawer open={open} title={l('New campaign', 'Nouvelle campagne')} onClose={onClose}>
      <div className="flex flex-col gap-5">
        {organizations !== null && organizations.length === 0 ? (
          <Alert
            tone="warning"
            title={l('No organization is available.', 'Aucune organisation disponible.')}
          >
            {l(
              'A campaign belongs to an organization. Ask an administrator to create one first.',
              'Une campagne appartient à une organisation. Demandez d’abord à un administrateur d’en créer une.',
            )}
          </Alert>
        ) : null}

        <TextField
          label={l('Name', 'Nom')}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Q4 Outreach"
          maxLength={255}
          disabled={busy}
          required
        />

        <SelectField
          label={l('Organization', 'Organisation')}
          value={organizationId}
          disabled={busy || !organizations?.length}
          onChange={(event) => setOrganizationId(event.target.value)}
          options={
            organizations === null
              ? [{ value: '', label: l('Loading…', 'Chargement…') }]
              : organizations.map((organization) => ({
                  value: organization.id,
                  label: organization.name,
                }))
          }
        />

        <TextField
          label={l('Description (optional)', 'Description (facultatif)')}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder={l('What this campaign is for', 'Objet de cette campagne')}
          maxLength={10000}
          disabled={busy}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={l('Starts (optional)', 'Début (facultatif)')}
            type="date"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
            disabled={busy}
          />

          <TextField
            label={l('Ends (optional)', 'Fin (facultatif)')}
            type="date"
            value={endsAt}
            onChange={(event) => setEndsAt(event.target.value)}
            error={
              dateInvalid
                ? l('End date is before the start date', 'La date de fin précède la date de début')
                : null
            }
            disabled={busy}
          />
        </div>

        {error ? <Alert tone="danger">{error}</Alert> : null}

        <Alert
          tone="info"
          title={l('Campaigns start as a draft.', 'Les campagnes commencent comme brouillon.')}
        >
          {l(
            'Nothing is assigned until you activate it from the campaign page.',
            'Aucun prospect n’est attribué avant l’activation depuis la page de campagne.',
          )}
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
              .catch((caught: unknown) => setError(describeCampaignError(caught, language)))
              .finally(() => setBusy(false));
          }}
        >
          {l('Create campaign', 'Créer la campagne')}
        </Button>
      </div>
    </Drawer>
  );
}

function formatWindow(startsAt: string | null, endsAt: string | null, language: string): string {
  const l = (en: string, fr: string) => text(en, fr, language);
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
    return l('No dates set', 'Aucune date définie');
  }

  if (from && to) {
    return `${from} – ${to}`;
  }

  return from ? `${l('From', 'Du')} ${from}` : `${l('Until', 'Jusqu’au')} ${to}`;
}
