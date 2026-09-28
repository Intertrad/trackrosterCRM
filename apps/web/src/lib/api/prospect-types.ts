import type { EstablishmentCategory } from './import-types';

export type ProspectStatus = 'active' | 'inactive' | 'archived';

/**
 * A row of the shared référentiel, as `GET /prospects` returns it.
 *
 * The establishment is tenant-level and organization-neutral — there is no
 * organization column on it — so all five entities read one base and take slices
 * of it through campaigns. An establishment outside every campaign is visible
 * only to a tenant-scoped grant, which is why this listing is an administration
 * screen.
 */
export interface Prospect {
  id: string;
  tenantId: string;
  regionId: string | null;
  externalReference: string | null;
  name: string;
  normalizedName: string;
  addressLine1: string | null;
  postalCode: string | null;
  city: string | null;
  countryCode: string;
  phone: string | null;
  website: string | null;
  latitude: number | null;
  longitude: number | null;
  status: ProspectStatus;
  source: 'manual' | 'import' | 'api';
  category: EstablishmentCategory | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProspectPage {
  items: Prospect[];
  nextCursor: string | null;
}

/*
 * Applied by the database, never in the browser. The names are deliberately the
 * dispatch queue's and bulk enrolment's, because all three resolve through one
 * shared filter helper upstream: "secteur = prospection, département = 974" has
 * to mean one population on every screen.
 */
export interface ProspectQuery {
  search?: string;
  category?: EstablishmentCategory;
  /** Two digits, or three for the overseas 97x/98x codes. */
  department?: string;
  city?: string;
  regionId?: string;
  campaignId?: string;
  status?: ProspectStatus | 'all';
  sort?: 'name' | 'createdAt';
  direction?: 'asc' | 'desc';
  cursor?: string;
  limit?: number;
}

/** The API's own ceiling; a larger value is a 400. */
export const PROSPECT_PAGE_SIZE = 50;

/** A department is two digits, or three overseas. `97` alone is neither. */
export const DEPARTMENT_SHAPE = /^(?:0[1-9]|[1-8]\d|9[0-6]|9[78]\d)$/;

/**
 * The department the API derives from a postal code, recomputed for display only.
 *
 * Five digits or nothing: the base holds a code with the letter O typed for a
 * zero and one cell containing a commune name, and neither yields a department.
 * Corsica reads `20` rather than 2A/2B, which is the API's rule — the usual
 * postal split misfiles real communes.
 */
export function prospectDepartment(postalCode: string | null): string | null {
  if (!postalCode || !/^[0-9]{5}$/.test(postalCode)) {
    return null;
  }

  return postalCode.startsWith('97') || postalCode.startsWith('98')
    ? postalCode.slice(0, 3)
    : postalCode.slice(0, 2);
}
