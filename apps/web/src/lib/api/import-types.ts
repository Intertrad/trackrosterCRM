/*
 * The import job state machine, mirrored from the API.
 *
 *   draft -> uploaded -> validated -> committed
 *                    \-> cancelled
 *
 * Two transitions are easy to get wrong in a wizard and are called out where
 * they bite:
 *
 *  - correcting a row rewinds the job to "uploaded" and deletes every parsed
 *    row, so the file must be re-validated before it can be committed;
 *  - commit is all-or-nothing. It refuses while any row is invalid, is a
 *    duplicate of another row in the same file, or matches an existing
 *    establishment without an explicit "reuse" decision.
 */
export type ImportStatus = 'draft' | 'uploaded' | 'validated' | 'committed' | 'cancelled';

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

export type ImportHeader = (typeof IMPORT_HEADERS)[number];

export const REQUIRED_IMPORT_HEADERS: readonly ImportHeader[] = ['name', 'country_code'];

export const MAX_IMPORT_ROWS = 10_000;

export const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024;

export interface ImportSummary {
  totalRows?: number;
  validRows?: number;
  warningRows?: number;
  invalidRows?: number;
  issueCount?: number;
  existingDuplicates?: number;
  createdEstablishments?: number;
  reusedEstablishments?: number;
  createdContacts?: number;
  skippedRows?: number;
}

export interface ImportJob {
  id: string;
  tenantId: string;
  requesterId: string;
  status: ImportStatus;
  filename: string | null;
  fileHash: string | null;
  headers: string[];
  mapping: Record<string, string>;
  summary: ImportSummary;
  rowCount: number;
  createdAt: string;
  updatedAt: string;
  etag: string;
}

export interface ImportJobPage {
  items: ImportJob[];
  nextCursor: string | null;
}

export type ImportRowStatus = 'valid' | 'warning' | 'invalid';

export type ImportIssueSeverity = 'warning' | 'error';

export interface ImportIssue {
  field?: string;
  code: string;
  message: string;
  severity: ImportIssueSeverity;
}

/*
 * The business taxonomy, mirroring the database enum. Kept as a union rather
 * than a bare string so a typo in a filter is a compile error here as well as a
 * 400 from the API.
 */
export type EstablishmentCategory =
  | 'prospection'
  | 'justice_enquetes'
  | 'sante'
  | 'asile_social'
  | 'douanes_onaf'
  | 'cra'
  | 'prescripteurs';

export const ESTABLISHMENT_CATEGORIES: readonly EstablishmentCategory[] = [
  'prospection',
  'justice_enquetes',
  'sante',
  'asile_social',
  'douanes_onaf',
  'cra',
  'prescripteurs',
];

export interface ImportRowEstablishment {
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
  category: EstablishmentCategory | null;
}

export interface ImportRowContact {
  name: string | null;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
}

export interface ImportRowData {
  rowNumber: number;
  status: ImportRowStatus;
  establishment: ImportRowEstablishment | null;
  contact: ImportRowContact | null;
  issues: ImportIssue[];
}

export type ImportResolution = 'skip' | 'reuse' | 'correct';

export interface ImportRow {
  id: string;
  tenantId: string;
  importId: string;
  rowNumber: number;
  data: ImportRowData;
  resolution: 'skip' | 'reuse' | null;
  existingId: string | null;
  establishmentId: string | null;
  contactId: string | null;
  result: 'created' | 'reused' | 'skipped' | null;
}

export interface ImportRowPage {
  items: ImportRow[];
  nextAfterRow: number | null;
}

export interface ImportIssueRecord {
  id: string;
  tenantId: string;
  importId: string;
  rowId: string;
  code: string;
  severity: ImportIssueSeverity;
  message: string;
  resolvedAt: string | null;
}

export interface ImportIssuePage {
  items: ImportIssueRecord[];
  nextCursor: string | null;
}

export type ImportStepId = 'upload' | 'map' | 'normalize' | 'deduplicate' | 'validate';

export interface ImportStep {
  id: ImportStepId;
  label: string;
  state: 'complete' | 'active' | 'pending';
}

/*
 * The design shows five steps. The API exposes three transitions, because it
 * normalizes and de-duplicates inside validate rather than as separate calls.
 * Steps 3 and 4 therefore track validate rather than pretending to be
 * independently actionable.
 */
export function importSteps(job: ImportJob | null): ImportStep[] {
  const status = job?.status ?? 'draft';

  const uploaded = Boolean(job?.fileHash);

  const mapped =
    uploaded && REQUIRED_IMPORT_HEADERS.every((header) => Boolean(job?.mapping[header]));

  const validated = status === 'validated' || status === 'committed';

  const order: Array<{ id: ImportStepId; label: string; done: boolean }> = [
    { id: 'upload', label: 'Upload', done: uploaded },
    { id: 'map', label: 'Map', done: mapped },
    { id: 'normalize', label: 'Normalize', done: validated },
    { id: 'deduplicate', label: 'Deduplicate', done: validated },
    { id: 'validate', label: 'Validate', done: status === 'committed' },
  ];

  const activeIndex = order.findIndex((step) => !step.done);

  return order.map((step, index) => ({
    id: step.id,
    label: step.label,
    state: step.done ? 'complete' : index === activeIndex ? 'active' : 'pending',
  }));
}

/** Why the API would refuse a commit right now, in the operator's words. */
export function commitBlockers(rows: ImportRow[]): string[] {
  const blockers: string[] = [];

  const invalid = rows.filter(
    (row) => row.resolution !== 'skip' && row.data.status === 'invalid',
  ).length;

  const duplicatedInFile = rows.filter(
    (row) =>
      row.resolution !== 'skip' &&
      row.data.issues.some((issue) => issue.code === 'duplicate_in_file'),
  ).length;

  const undecidedMatches = rows.filter(
    (row) => row.resolution !== 'skip' && row.existingId !== null && row.resolution !== 'reuse',
  ).length;

  if (invalid > 0) {
    blockers.push(
      `${invalid} row${invalid === 1 ? '' : 's'} still have errors. Correct or skip each one.`,
    );
  }

  if (duplicatedInFile > 0) {
    blockers.push(
      `${duplicatedInFile} row${duplicatedInFile === 1 ? '' : 's'} duplicate another row in this file. Correct or skip each one.`,
    );
  }

  if (undecidedMatches > 0) {
    blockers.push(
      `${undecidedMatches} row${undecidedMatches === 1 ? '' : 's'} match an existing establishment. Choose reuse or skip for each.`,
    );
  }

  return blockers;
}
