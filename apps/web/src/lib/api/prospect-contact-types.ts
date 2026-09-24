/**
 * Named contacts and postal addresses held against an establishment.
 *
 * These come from `GET /prospects/:establishmentId/contacts` and
 * `/addresses`. Despite the path segment, the API keys both on the
 * establishment id — the work-queue detail response already carries it.
 *
 * Both reads are guarded by authentication alone; the write paths on the same
 * controller add `ProspectWriteGuard`, which is why only the reads are
 * surfaced here.
 */
export type ProspectContactStatus = 'active' | 'inactive' | 'archived';

export type ProspectContactSource = 'manual' | 'import' | 'api';

export interface ProspectContact {
  id: string;
  establishmentId: string;

  /** Any one of name, email or phone may be null; the row cannot be empty. */
  name: string | null;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;

  isPrimary: boolean;
  status: ProspectContactStatus;
  source: ProspectContactSource;

  createdAt: string;
  updatedAt: string;
}

export interface ProspectAddress {
  id: string;
  prospectId: string;

  label: string | null;
  line1: string;
  line2: string | null;
  postalCode: string | null;
  city: string | null;
  region: string | null;
  countryCode: string;

  latitude: number | null;
  longitude: number | null;

  isPrimary: boolean;
}

export interface ProspectContactPage {
  items: ProspectContact[];
  nextCursor: string | null;
}

export interface ProspectAddressPage {
  items: ProspectAddress[];
  nextCursor: string | null;
}

/** The label a contact is listed under when no name was recorded. */
export function contactDisplayName(contact: ProspectContact, fallback = 'Unnamed contact'): string {
  const name = contact.name?.trim();

  if (name) {
    return name;
  }

  /* A contact must carry at least one of name, email or phone, so falling
   * back to whichever exists is always something rather than a blank row. */
  return contact.email?.trim() || contact.phone?.trim() || fallback;
}

/** One line of postal address, skipping the parts that were never captured. */
export function formatAddress(address: ProspectAddress): string {
  return [address.line1, address.line2, address.postalCode, address.city, address.region]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(', ');
}

/**
 * Primary contact first, then by name.
 *
 * The API orders by id, which is random — useful for cursor paging, useless
 * to a prospector deciding who to call.
 */
export function sortContacts(contacts: ProspectContact[]): ProspectContact[] {
  return [...contacts].sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) {
      return a.isPrimary ? -1 : 1;
    }

    return contactDisplayName(a).localeCompare(contactDisplayName(b));
  });
}
