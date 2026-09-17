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
] as const;

export const REQUIRED_IMPORT_HEADERS = ['name', 'country_code'] as const;

export const MAX_IMPORT_ROWS = 10_000;

export const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024;

export type ImportHeader = (typeof IMPORT_HEADERS)[number];

export type ImportRowStatus = 'valid' | 'warning' | 'invalid';

export type ImportIssueSeverity = 'warning' | 'error';

export interface ImportIssue {
  field?: string;

  code: string;

  message: string;

  severity: ImportIssueSeverity;
}

export interface ImportPreviewEstablishment {
  externalReference: string | null;

  name: string;

  addressLine1: string | null;

  postalCode: string | null;

  city: string | null;

  countryCode: string;

  phone: string | null;

  website: string | null;

  latitude: number | null;

  longitude: number | null;
}

export interface ImportPreviewContact {
  name: string | null;

  jobTitle: string | null;

  email: string | null;

  phone: string | null;

  isPrimary: boolean;
}

export interface ImportPreviewRow {
  rowNumber: number;

  status: ImportRowStatus;

  establishment: ImportPreviewEstablishment | null;

  contact: ImportPreviewContact | null;

  issues: ImportIssue[];
}

export interface ImportPreviewSummary {
  totalRows: number;

  validRows: number;

  warningRows: number;

  invalidRows: number;
}

export interface ImportPreviewResult {
  summary: ImportPreviewSummary;

  rows: ImportPreviewRow[];
}

export type ImportExecutionRowStatus = 'created' | 'reused' | 'skipped' | 'failed';

export interface ImportExecutionRowResult {
  rowNumber: number;

  status: ImportExecutionRowStatus;

  establishmentId: string | null;

  contactId: string | null;

  reason: string | null;
}

export interface ImportExecutionSummary {
  totalRows: number;

  createdEstablishments: number;

  reusedEstablishments: number;

  createdContacts: number;

  skippedRows: number;

  failedRows: number;
}

export interface ImportExecutionResult {
  summary: ImportExecutionSummary;

  rows: ImportExecutionRowResult[];
}
