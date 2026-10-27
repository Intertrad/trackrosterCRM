export const IMPORT_HEADERS = [
  'external_reference',
  'name',
  'address_line1',
  'postal_code',
  'city',
  'country_code',
  'phone',
  'website',
  'latitude',
  'longitude',
  'contact_name',
  'contact_job_title',
  'contact_email',
  'contact_phone',
  'is_primary',

  /* The business taxonomy. Optional: a file without it imports uncategorised
     rows, which the dispatch filters then simply do not match. */
  'category',
] as const;

/* A name is enough to stage an import. Country is optional because many
 * spreadsheets are sourced from a single local list and do not carry it. The
 * preview marks missing country data as a warning and stores it as ZZ (unknown)
 * so the existing non-null database column remains safe. */
export const REQUIRED_IMPORT_HEADERS = ['name'] as const;
export const UNKNOWN_IMPORT_COUNTRY_CODE = 'ZZ' as const;

export type ImportHeader = (typeof IMPORT_HEADERS)[number];
export const MAX_IMPORT_ROWS = 10_000;
export const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024;
