import { browserJson } from './browser-json';

export interface ScopeOption {
  value: string;
  label: string;
}

interface NamedRecord {
  id: string;
  name: string;
}

/*
 * Scope pill options come from the real directories rather than a fixture.
 * A failure returns an empty list so a filter bar degrades to "All" instead
 * of taking the screen down.
 */
async function loadOptions(path: string, signal?: AbortSignal): Promise<ScopeOption[]> {
  try {
    const result = await browserJson<NamedRecord[] | { items: NamedRecord[] }>(path, {
      cache: 'no-store',
      signal,
    });

    const rows = Array.isArray(result) ? result : (result?.items ?? []);

    return rows
      .filter((row) => row && typeof row.id === 'string')
      .map((row) => ({ value: row.id, label: row.name ?? row.id }));
  } catch {
    return [];
  }
}

export const listTeamOptions = (signal?: AbortSignal) => loadOptions('/api/teams', signal);

export const listCampaignOptions = (signal?: AbortSignal) => loadOptions('/api/campaigns', signal);

export const listTerritoryOptions = (signal?: AbortSignal) =>
  loadOptions('/api/territories', signal);
