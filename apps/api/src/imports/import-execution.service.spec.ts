import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Database, DatabaseTransaction } from '../database/database.types.js';
import type { EstablishmentContact } from '../database/schema/establishment-contacts.js';
import type { Establishment } from '../database/schema/establishments.js';
import { EstablishmentContactRepository } from '../establishment-contacts/establishment-contact.repository.js';
import { EstablishmentContactService } from '../establishment-contacts/establishment-contact.service.js';
import { EstablishmentService } from '../establishments/establishment.service.js';
import { ImportDeduplicationService } from './import-deduplication.service.js';
import { ImportExecutionService } from './import-execution.service.js';
import { ImportPreviewService } from './import-preview.service.js';
import type { ImportPreviewResult, ImportPreviewRow } from './import-preview.types.js';

describe('ImportExecutionService', () => {
  let previewService: {
    previewCsv: ReturnType<typeof vi.fn>;
  };

  let deduplicationService: {
    acquireExecutionLock: ReturnType<typeof vi.fn>;
    findExisting: ReturnType<typeof vi.fn>;
  };

  let establishmentService: {
    create: ReturnType<typeof vi.fn>;
  };

  let database: {
    transaction: ReturnType<typeof vi.fn>;
  };

  let transaction: DatabaseTransaction;

  let contactService: {
    create: ReturnType<typeof vi.fn>;
  };

  let contactRepository: {
    findImportDuplicate: ReturnType<typeof vi.fn>;
  };

  let service: ImportExecutionService;

  const tenantId = '11111111-1111-4111-8111-111111111111';

  const establishment: Establishment = {
    id: '22222222-2222-4222-8222-222222222222',
    regionId: null,

    tenantId,

    externalReference: 'REST-001',

    name: 'Restaurant Paris',

    normalizedName: 'restaurant paris',

    addressLine1: null,
    postalCode: '75001',
    city: 'Paris',
    countryCode: 'FR',

    phone: null,
    website: null,

    latitude: null,
    longitude: null,
    category: null,

    status: 'active',
    source: 'import',

    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const contact: EstablishmentContact = {
    id: '33333333-3333-4333-8333-333333333333',

    tenantId,

    establishmentId: establishment.id,

    name: 'Marie Dupont',
    jobTitle: 'Manager',

    email: 'marie@example.com',

    phone: null,

    isPrimary: true,

    status: 'active',
    source: 'import',

    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const validRow: ImportPreviewRow = {
    rowNumber: 2,

    status: 'valid',

    establishment: {
      externalReference: 'REST-001',

      name: 'Restaurant Paris',

      addressLine1: null,
      postalCode: '75001',
      city: 'Paris',
      countryCode: 'FR',

      phone: null,
      website: null,

      latitude: null,
      longitude: null,
      category: null,
    },

    contact: {
      name: 'Marie Dupont',

      jobTitle: 'Manager',

      email: 'marie@example.com',

      phone: null,

      isPrimary: true,
    },

    issues: [],
  };

  function preview(rows: ImportPreviewRow[]): ImportPreviewResult {
    return {
      summary: {
        totalRows: rows.length,

        validRows: rows.filter((row) => row.status === 'valid').length,

        warningRows: rows.filter((row) => row.status === 'warning').length,

        invalidRows: rows.filter((row) => row.status === 'invalid').length,
      },

      rows,
    };
  }

  /*
   * executeCsv opens one transaction of its own before any row is touched: with
   * no ambient tenant scope it wraps itself in withTenantContext and recurses,
   * which is what `feat(imports): scope execution to tenant context` added and
   * what these cases were never updated for. Row transactions are therefore
   * every call after that first one. Asserting on this rather than on the raw
   * count keeps each case about per-row behaviour, which is what it is testing.
   */
  const rowTransactions = () => database.transaction.mock.calls.length - 1;

  beforeEach(() => {
    transaction = {
      __testTransaction: true,

      /*
       * The deduplication service takes the tenant mutex with a raw
       * `transaction.execute(...)` before it matches anything, so the double
       * needs it: without it every case here fails with "executor.execute is not
       * a function" long before reaching the behaviour under test. It resolves
       * empty because nothing in this spec asserts on the mutex, only that the
       * work inside the transaction happens.
       */
      execute: vi.fn(async () => ({ rows: [] })),
    } as unknown as DatabaseTransaction;

    database = {
      transaction: vi.fn(async (callback: (transaction: DatabaseTransaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };

    previewService = {
      previewCsv: vi.fn(),
    };

    deduplicationService = {
      acquireExecutionLock: vi.fn(),
      findExisting: vi.fn(),
    };

    establishmentService = {
      create: vi.fn(),
    };

    contactService = {
      create: vi.fn(),
    };

    contactRepository = {
      findImportDuplicate: vi.fn(),
    };

    service = new ImportExecutionService(
      database as unknown as Database,

      previewService as unknown as ImportPreviewService,

      deduplicationService as unknown as ImportDeduplicationService,

      establishmentService as unknown as EstablishmentService,

      contactService as unknown as EstablishmentContactService,

      contactRepository as unknown as EstablishmentContactRepository,
    );
  });

  it('creates a new establishment and contact', async () => {
    previewService.previewCsv.mockReturnValue(preview([validRow]));

    deduplicationService.findExisting.mockResolvedValue(null);

    establishmentService.create.mockResolvedValue(establishment);

    contactRepository.findImportDuplicate.mockResolvedValue(null);

    contactService.create.mockResolvedValue(contact);

    const result = await service.executeCsv(tenantId, 'csv');

    expect(rowTransactions()).toBe(1);

    expect(deduplicationService.acquireExecutionLock).toHaveBeenCalledWith(
      tenantId,
      validRow.establishment,
      transaction,
    );

    expect(deduplicationService.findExisting).toHaveBeenCalledWith(
      tenantId,
      validRow.establishment,
      transaction,
    );

    expect(establishmentService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,

        externalReference: 'REST-001',

        source: 'import',
      }),
      transaction,
    );

    expect(contactRepository.findImportDuplicate).toHaveBeenCalledWith(
      tenantId,
      establishment.id,
      {
        email: 'marie@example.com',
        phone: null,
        name: 'Marie Dupont',
      },
      transaction,
    );

    expect(contactService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,

        establishmentId: establishment.id,

        email: 'marie@example.com',

        source: 'import',
      }),
      transaction,
    );

    expect(result.summary).toEqual({
      totalRows: 1,
      createdEstablishments: 1,
      reusedEstablishments: 0,
      createdContacts: 1,
      skippedRows: 0,
      failedRows: 0,
    });

    expect(result.rows[0]).toMatchObject({
      status: 'created',

      establishmentId: establishment.id,

      contactId: contact.id,
    });
  });

  it('reuses an existing establishment and contact', async () => {
    previewService.previewCsv.mockReturnValue(preview([validRow]));

    deduplicationService.findExisting.mockResolvedValue(establishment);

    contactRepository.findImportDuplicate.mockResolvedValue(contact);

    const result = await service.executeCsv(tenantId, 'csv');

    expect(rowTransactions()).toBe(1);

    expect(deduplicationService.acquireExecutionLock).toHaveBeenCalledWith(
      tenantId,
      validRow.establishment,
      transaction,
    );

    expect(deduplicationService.findExisting).toHaveBeenCalledWith(
      tenantId,
      validRow.establishment,
      transaction,
    );

    expect(establishmentService.create).not.toHaveBeenCalled();

    expect(contactRepository.findImportDuplicate).toHaveBeenCalledWith(
      tenantId,
      establishment.id,
      {
        email: 'marie@example.com',
        phone: null,
        name: 'Marie Dupont',
      },
      transaction,
    );

    expect(contactService.create).not.toHaveBeenCalled();

    expect(result.summary).toEqual({
      totalRows: 1,
      createdEstablishments: 0,
      reusedEstablishments: 1,
      createdContacts: 0,
      skippedRows: 0,
      failedRows: 0,
    });

    expect(result.rows[0]).toMatchObject({
      status: 'reused',

      establishmentId: establishment.id,

      contactId: contact.id,
    });
  });

  it('skips invalid rows', async () => {
    const invalidRow: ImportPreviewRow = {
      rowNumber: 2,

      status: 'invalid',

      establishment: null,
      contact: null,

      issues: [
        {
          field: 'name',
          code: 'required',
          message: 'Establishment name is required',
          severity: 'error',
        },
      ],
    };

    previewService.previewCsv.mockReturnValue(preview([invalidRow]));

    const result = await service.executeCsv(tenantId, 'csv');

    expect(result.summary.skippedRows).toBe(1);

    expect(result.rows[0]?.status).toBe('skipped');

    expect(rowTransactions()).toBe(0);

    expect(deduplicationService.acquireExecutionLock).not.toHaveBeenCalled();

    expect(deduplicationService.findExisting).not.toHaveBeenCalled();
  });

  it('skips duplicate rows from the uploaded CSV', async () => {
    const duplicateRow: ImportPreviewRow = {
      ...validRow,

      rowNumber: 3,
      status: 'warning',

      issues: [
        {
          code: 'duplicate_in_file',

          message: 'Possible duplicate of CSV row 2',

          severity: 'warning',
        },
      ],
    };

    previewService.previewCsv.mockReturnValue(preview([duplicateRow]));

    const result = await service.executeCsv(tenantId, 'csv');

    expect(result.summary.skippedRows).toBe(1);

    expect(rowTransactions()).toBe(0);

    expect(deduplicationService.acquireExecutionLock).not.toHaveBeenCalled();

    expect(deduplicationService.findExisting).not.toHaveBeenCalled();
  });

  it('continues after a row fails', async () => {
    previewService.previewCsv.mockReturnValue(
      preview([
        validRow,
        {
          ...validRow,

          rowNumber: 3,

          establishment: {
            ...validRow.establishment!,

            externalReference: 'REST-002',
          },
        },
      ]),
    );

    deduplicationService.findExisting
      .mockRejectedValueOnce(new Error('Database failure'))
      .mockResolvedValueOnce(establishment);

    contactRepository.findImportDuplicate.mockResolvedValue(contact);

    const result = await service.executeCsv(tenantId, 'csv');

    /*
     * Both executable rows received
     * their own transaction.
     */
    expect(rowTransactions()).toBe(2);

    expect(deduplicationService.acquireExecutionLock).toHaveBeenCalledTimes(2);

    expect(result.summary.failedRows).toBe(1);

    expect(result.summary.reusedEstablishments).toBe(1);

    expect(result.rows[0]?.status).toBe('failed');

    expect(result.rows[1]?.status).toBe('reused');
  });
});
