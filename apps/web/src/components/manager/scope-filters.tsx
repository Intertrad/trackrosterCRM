'use client';

import { useEffect, useState } from 'react';

import { FilterSelect } from '@/components/ui/filter-select';
import {
  listCampaignOptions,
  listTeamOptions,
  listTerritoryOptions,
  type ScopeOption,
} from '@/lib/api/scope-client';

export interface ManagerScope {
  team: string;
  campaign: string;
  territory: string;
  organization: string;
  status: string;
}

export const DEFAULT_SCOPE: ManagerScope = {
  team: 'all',
  campaign: 'all',
  territory: 'all',
  organization: 'all',
  status: 'active',
};

type ScopeField = keyof ManagerScope;

const ALL: ScopeOption = { value: 'all', label: 'All' };

const STATUS_OPTIONS: ScopeOption[] = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
];

const LABELS: Record<ScopeField, string> = {
  team: 'Team',
  campaign: 'Campaign',
  territory: 'Territory',
  organization: 'Organization',
  status: 'Status',
};

/*
 * Scope pills backed by the real directories. Each list is loaded once and a
 * failure leaves just "All", so a filter bar degrades rather than blocking the
 * screen behind it.
 */
export function ScopeFilters({
  scope,
  fields,
  onChange,
}: {
  scope: ManagerScope;
  fields: ScopeField[];
  onChange: (next: ManagerScope) => void;
}) {
  const [teams, setTeams] = useState<ScopeOption[]>([]);
  const [campaigns, setCampaigns] = useState<ScopeOption[]>([]);
  const [territories, setTerritories] = useState<ScopeOption[]>([]);

  useEffect(() => {
    const controller = new AbortController();

    if (fields.includes('team')) {
      void listTeamOptions(controller.signal).then(setTeams);
    }

    if (fields.includes('campaign')) {
      void listCampaignOptions(controller.signal).then(setCampaigns);
    }

    if (fields.includes('territory')) {
      void listTerritoryOptions(controller.signal).then(setTerritories);
    }

    return () => controller.abort();
  }, [fields]);

  function optionsFor(field: ScopeField): ScopeOption[] {
    switch (field) {
      case 'team':
        return [ALL, ...teams];
      case 'campaign':
        return [ALL, ...campaigns];
      case 'territory':
        return [ALL, ...territories];
      case 'status':
        return STATUS_OPTIONS;
      case 'organization':
        return [ALL];
    }
  }

  return (
    <>
      {fields.map((field) => (
        <FilterSelect
          key={field}
          label={LABELS[field]}
          value={scope[field]}
          options={optionsFor(field)}
          onChange={(value) => onChange({ ...scope, [field]: value })}
        />
      ))}
    </>
  );
}
