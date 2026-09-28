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

export const REQUIRED_IMPORT_HEADERS = ['name', 'country_code'] as const;

export type ImportHeader = (typeof IMPORT_HEADERS)[number];
export const MAX_IMPORT_ROWS = 10_000;
export const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024;
