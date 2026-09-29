import { Inject, Injectable } from '@nestjs/common';

import { DATABASE } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import { currentTenantExecutor } from '../database/request-tenant-executor.js';
import { withTenantContext } from '../database/tenant-context.js';
import { EstablishmentContactRepository } from '../establishment-contacts/establishment-contact.repository.js';
import { EstablishmentContactService } from '../establishment-contacts/establishment-contact.service.js';
import { EstablishmentService } from '../establishments/establishment.service.js';
import { ImportDeduplicationService } from './import-deduplication.service.js';
import type { ImportExecutionResult, ImportExecutionRowResult } from './import-execution.types.js';
import { ImportPreviewService } from './import-preview.service.js';
import type { ImportPreviewRow } from './import-preview.types.js';

interface ImportRowTransactionResult {
  row: ImportExecutionRowResult;

  createdEstablishment: boolean;
  reusedEstablishment: boolean;
  createdContact: boolean;
}

@Injectable()
export class ImportExecutionService {
  constructor(
    @Inject(DATABASE)
    private readonly database: Database,

    private readonly previewService: ImportPreviewService,

    private readonly deduplicationService: ImportDeduplicationService,

    private readonly establishmentService: EstablishmentService,

    private readonly contactService: EstablishmentContactService,

    private readonly contactRepository: EstablishmentContactRepository,
  ) {}

  async executeCsv(tenantId: string, csvContent: string): Promise<ImportExecutionResult> {
    if (!currentTenantExecutor())
      return withTenantContext(this.database, tenantId, () =>
        this.executeCsv(tenantId, csvContent),
      );
    /*
     * Never trust preview data returned
     * by the frontend.
     *
     * The server parses and validates
     * the CSV again before writing.
     */
    const preview = this.previewService.previewCsv(csvContent);

    const result: ImportExecutionResult = {
      summary: {
        totalRows: preview.summary.totalRows,

        createdEstablishments: 0,
        reusedEstablishments: 0,

        createdContacts: 0,

        skippedRows: 0,
        failedRows: 0,
      },

      rows: [],
    };

    for (const row of preview.rows) {
      const rowResult = await this.executeRow(tenantId, row, result);

      result.rows.push(rowResult);
    }

    return result;
  }

  private async executeRow(
    tenantId: string,
    row: ImportPreviewRow,
    result: ImportExecutionResult,
  ): Promise<ImportExecutionRowResult> {
    /*
     * Invalid rows never enter a
     * database transaction.
     */
    if (row.status === 'invalid' || !row.establishment) {
      result.summary.skippedRows += 1;

      return {
        rowNumber: row.rowNumber,

        status: 'skipped',

        establishmentId: null,
        contactId: null,

        reason: 'Row is invalid',
      };
    }

    /*
     * The preview service already marks
     * later duplicate rows inside the
     * same CSV.
     */
    const duplicateInFile = row.issues.some((issue) => issue.code === 'duplicate_in_file');

    if (duplicateInFile) {
      result.summary.skippedRows += 1;

      return {
        rowNumber: row.rowNumber,

        status: 'skipped',

        establishmentId: null,
        contactId: null,

        reason: 'Duplicate row in uploaded CSV',
      };
    }

    /*
     * Capture these after the null check.
     * This also gives TypeScript stable
     * values inside the transaction
     * callback.
     */
    const previewEstablishment = row.establishment;

    const previewContact = row.contact;

    try {
      const transactionResult = await this.database.transaction(async (transaction) => {
        await this.deduplicationService.acquireExecutionLock(
          tenantId,
          previewEstablishment,
          transaction,
        );

        let establishment = await this.deduplicationService.findExisting(
          tenantId,
          previewEstablishment,
          transaction,
        );

        let createdEstablishment = false;
        let reusedEstablishment = false;

        let rowStatus: 'created' | 'reused';

        if (establishment) {
          reusedEstablishment = true;
          rowStatus = 'reused';
        } else {
          establishment = await this.establishmentService.create(
            {
              tenantId,

              externalReference: previewEstablishment.externalReference,
              name: previewEstablishment.name,
              addressLine1: previewEstablishment.addressLine1,
              postalCode: previewEstablishment.postalCode,
              city: previewEstablishment.city,
              countryCode: previewEstablishment.countryCode,
              phone: previewEstablishment.phone,
              website: previewEstablishment.website,
              latitude: previewEstablishment.latitude,
              longitude: previewEstablishment.longitude,
              category: previewEstablishment.category,

              source: 'import',
            },
            transaction,
          );

          createdEstablishment = true;
          rowStatus = 'created';
        }

        let contactId: string | null = null;
        let createdContact = false;

        if (previewContact) {
          const existingContact = await this.contactRepository.findImportDuplicate(
            tenantId,
            establishment.id,
            {
              email: previewContact.email,
              phone: previewContact.phone,
              name: previewContact.name,
            },
            transaction,
          );

          if (existingContact) {
            contactId = existingContact.id;
          } else {
            const contact = await this.contactService.create(
              {
                tenantId,
                establishmentId: establishment.id,

                name: previewContact.name,
                jobTitle: previewContact.jobTitle,
                email: previewContact.email,
                phone: previewContact.phone,
                isPrimary: previewContact.isPrimary,

                source: 'import',
              },
              transaction,
            );

            contactId = contact.id;
            createdContact = true;
          }
        }

        return {
          row: {
            rowNumber: row.rowNumber,
            status: rowStatus,
            establishmentId: establishment.id,
            contactId,

            reason: rowStatus === 'reused' ? 'Existing establishment reused' : null,
          },

          createdEstablishment,
          reusedEstablishment,
          createdContact,
        } satisfies ImportRowTransactionResult;
      });

      this.applyTransactionSummary(result, transactionResult);

      return transactionResult.row;
    } catch {
      result.summary.failedRows += 1;

      return {
        rowNumber: row.rowNumber,
        status: 'failed',
        establishmentId: null,
        contactId: null,
        reason: 'Import row failed',
      };
    }
  }

  private applyTransactionSummary(
    result: ImportExecutionResult,
    transactionResult: ImportRowTransactionResult,
  ): void {
    if (transactionResult.createdEstablishment) {
      result.summary.createdEstablishments += 1;
    }

    if (transactionResult.reusedEstablishment) {
      result.summary.reusedEstablishments += 1;
    }

    if (transactionResult.createdContact) {
      result.summary.createdContacts += 1;
    }
  }
}
