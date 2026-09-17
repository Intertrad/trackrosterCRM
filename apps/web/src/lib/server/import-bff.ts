import type { ImportExecutionResult, ImportPreviewResult } from '@/lib/api/import-types';

export function getImportMultipartRequestOptions(request: Request, body: ArrayBuffer): RequestInit {
  const headers = new Headers();

  const contentType = request.headers.get('content-type');

  if (contentType) {
    headers.set('content-type', contentType);
  }

  return {
    method: 'POST',

    headers,

    body,
  };
}

export function toBrowserImportPreview(input: ImportPreviewResult): ImportPreviewResult {
  return {
    summary: {
      totalRows: input.summary.totalRows,

      validRows: input.summary.validRows,

      warningRows: input.summary.warningRows,

      invalidRows: input.summary.invalidRows,
    },

    rows: input.rows.map((row) => ({
      rowNumber: row.rowNumber,

      status: row.status,

      establishment:
        row.establishment === null
          ? null
          : {
              externalReference: row.establishment.externalReference,

              name: row.establishment.name,

              addressLine1: row.establishment.addressLine1,

              postalCode: row.establishment.postalCode,

              city: row.establishment.city,

              countryCode: row.establishment.countryCode,

              phone: row.establishment.phone,

              website: row.establishment.website,

              latitude: row.establishment.latitude,

              longitude: row.establishment.longitude,
            },

      contact:
        row.contact === null
          ? null
          : {
              name: row.contact.name,

              jobTitle: row.contact.jobTitle,

              email: row.contact.email,

              phone: row.contact.phone,

              isPrimary: row.contact.isPrimary,
            },

      issues: row.issues.map((issue) => ({
        ...(issue.field !== undefined
          ? {
              field: issue.field,
            }
          : {}),

        code: issue.code,

        message: issue.message,

        severity: issue.severity,
      })),
    })),
  };
}

export function toBrowserImportExecution(input: ImportExecutionResult): ImportExecutionResult {
  return {
    summary: {
      totalRows: input.summary.totalRows,

      createdEstablishments: input.summary.createdEstablishments,

      reusedEstablishments: input.summary.reusedEstablishments,

      createdContacts: input.summary.createdContacts,

      skippedRows: input.summary.skippedRows,

      failedRows: input.summary.failedRows,
    },

    rows: input.rows.map((row) => ({
      rowNumber: row.rowNumber,

      status: row.status,

      establishmentId: row.establishmentId,

      contactId: row.contactId,

      reason: row.reason,
    })),
  };
}
