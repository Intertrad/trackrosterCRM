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
