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

/** A user-managed label on an establishment. */
export interface ProspectTag {
  id: string;
  name: string;
  color: string | null;
}

/**
 * `GET /prospects/:id` — the establishment plus what the tenant has added to it.
 *
 * `customFields` is keyed by the tenant's own field keys and already filtered by
 * what the caller may see, so the page renders whatever arrives rather than
 * deciding visibility again.
 *
 * `mergedIntoId` is set when this record was merged into another, which means the
 * page is showing a superseded establishment. That has to be visible: acting on a
 * merged record is how work gets recorded against the wrong establishment.
 */
export interface ProspectDetail extends Prospect {
  tags: ProspectTag[];
  customFields: Record<string, string>;
  mergedIntoId: string | null;
  mergedSourceIds: string[];
}

/**
 * What one campaign has made of this establishment.
 *
 * The référentiel is tenant-level and organization-neutral, so an establishment
 * has no owner. An organization reaches it only through a campaign, which is why
 * this is a list rather than a field: the same establishment held by OFTI and by
 * GFTIJ is two memberships, and that is enrolment, not a conflict. Collision is
 * decided later, when one of them tries to reserve it.
 *
 * `campaignProspectId` is the point of the whole shape. Activities, follow-ups,
 * assignments and reservations are all keyed to it, so it is what turns an
 * establishment id into a way of reaching the existing scoped endpoints.
 */
export interface ProspectCampaignMembership {
  campaignProspectId: string;

  campaign: { id: string; name: string; status: string };

  /** Reached through the campaign, never a property of the establishment. */
  organization: { id: string; name: string };

  membership: {
    /** `active` or `excluded`; a deliberate exclusion stays visible. */
    status: string;
    lifecycleStage: string;
    includedAt: string;
    updatedAt: string;
  };

  /** The one assignment that has not ended, or null when nobody owns it. */
  assignment: {
    id: string;
    status: string;
    priority: string;
    assignedAt: string;
    teamId: string;
    teamName: string | null;
    assignedUserId: string | null;
    assignedUserName: string | null;
  } | null;

  latestActivity: { id: string; type: string; occurredAt: string } | null;

  nextFollowUp: { id: string; dueAt: string; category: string; status: string } | null;
}

export interface ProspectCampaignMembershipPage {
  items: ProspectCampaignMembership[];
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
  postalCode?: string;
  city?: string;
  address?: string;
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
