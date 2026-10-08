import { browserJson } from './browser-json';

export interface OrganizationSummary {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  status: 'active' | 'inactive' | string;
  shortName?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  color?: string | null;
  currency?: string | null;
  argumentaire?: string | null;
  prospectedSectors?: string[];
}

export interface OrganizationPage {
  items: OrganizationSummary[];
  nextCursor: string | null;
}

export function listOrganizations(
  query: {
    status?: 'active' | 'inactive';
    search?: string;
    cursor?: string;
    limit?: number;
  } = {},
  signal?: AbortSignal,
): Promise<OrganizationPage> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const search = params.toString();
  return browserJson<OrganizationPage>(
    search ? `/api/organizations?${search}` : '/api/organizations',
    { cache: 'no-store', signal },
  );
}
