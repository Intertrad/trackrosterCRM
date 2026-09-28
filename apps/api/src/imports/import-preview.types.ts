import type { EstablishmentCategory } from '../database/schema/establishments.js';

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

  /* The business taxonomy, when the source file carries it. Null keeps an
     uncategorised import valid rather than rejecting the row. */
  category: EstablishmentCategory | null;
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
