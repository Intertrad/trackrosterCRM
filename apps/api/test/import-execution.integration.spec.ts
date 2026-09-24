import { randomUUID } from 'node:crypto';

import { NestFactory } from '@nestjs/core';

import { and, eq } from 'drizzle-orm';
import { EstablishmentContactService } from '../src/establishment-contacts/establishment-contact.service.js';

import { AppModule } from '../src/app.module.js';
import type { Database } from '../src/database/database.types.js';
import { establishmentContacts } from '../src/database/schema/establishment-contacts.js';
import { establishments } from '../src/database/schema/establishments.js';
import { tenants } from '../src/database/schema/tenants.js';
import { ImportExecutionService } from '../src/imports/import-execution.service.js';
import { TenantService } from '../src/tenants/tenant.service.js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getSeedDatabase } from './support/seed.js';

describe('Import execution PostgreSQL integration', () => {
  let database: Database | undefined;

  let application: Awaited<ReturnType<typeof NestFactory.createApplicationContext>> | undefined;

  let executionService: ImportExecutionService | undefined;

  let tenantId = '';

  function getExecutionService(): ImportExecutionService {
    if (!executionService) {
      throw new Error('Import execution service has not been initialized');
    }

    return executionService;
  }

  function getDatabase(): Database {
    if (!database) {
      throw new Error('Database has not been initialized');
    }

    return database;
  }

  beforeAll(async () => {
    application = await NestFactory.createApplicationContext(AppModule, {
      logger: false,
      abortOnError: false,
    });

    database = getSeedDatabase();

    executionService = application.get(ImportExecutionService);

    const tenantService = application.get(TenantService);

    const suffix = randomUUID().replaceAll('-', '').slice(0, 10);

    const tenant = await tenantService.create({
      name: `Import Execution Tenant ${suffix}`,

      slug: `import-execution-${suffix}`,
    });

    tenantId = tenant.id;
  });

  afterAll(async () => {
    try {
      if (database && tenantId) {
        await database
          .delete(establishmentContacts)
          .where(eq(establishmentContacts.tenantId, tenantId));

        await database.delete(establishments).where(eq(establishments.tenantId, tenantId));

        await database.delete(tenants).where(eq(tenants.id, tenantId));
      }
    } finally {
      if (application) {
        await application.close();
      }
    }
  });

  it('creates an establishment and contact on the first import', async () => {
    const csv = [
      'external_reference,name,postal_code,city,country_code,contact_name,contact_job_title,contact_email,is_primary',

      'REST-001,Restaurant Paris,75001,Paris,FR,Marie Dupont,Purchasing Manager,MARIE@EXAMPLE.COM,true',
    ].join('\n');

    const result = await getExecutionService().executeCsv(tenantId, csv);

    expect(result.summary).toEqual({
      totalRows: 1,

      createdEstablishments: 1,
      reusedEstablishments: 0,

      createdContacts: 1,

      skippedRows: 0,
      failedRows: 0,
    });

    expect(result.rows[0]?.status).toBe('created');

    const storedEstablishments = await getDatabase()
      .select()
      .from(establishments)
      .where(eq(establishments.tenantId, tenantId));

    expect(storedEstablishments).toHaveLength(1);

    expect(storedEstablishments[0]).toMatchObject({
      externalReference: 'REST-001',

      normalizedName: 'restaurant paris',

      postalCode: '75001',

      city: 'Paris',

      countryCode: 'FR',

      source: 'import',
    });

    const storedContacts = await getDatabase()
      .select()
      .from(establishmentContacts)
      .where(eq(establishmentContacts.tenantId, tenantId));

    expect(storedContacts).toHaveLength(1);

    expect(storedContacts[0]).toMatchObject({
      name: 'Marie Dupont',

      email: 'marie@example.com',

      isPrimary: true,

      source: 'import',
    });
  });

  it('rolls back establishment creation when contact creation fails', async () => {
    if (!application) {
      throw new Error('Application has not been initialized');
    }

    const contactService = application.get(EstablishmentContactService);

    const externalReference = `ROLLBACK-${randomUUID().replaceAll('-', '').slice(0, 10)}`;

    const contactEmail = `rollback-${randomUUID().replaceAll('-', '').slice(0, 10)}@example.com`;

    const createContactSpy = vi.spyOn(contactService, 'create');

    createContactSpy.mockRejectedValueOnce(new Error('Forced contact creation failure'));

    try {
      const csv = [
        'external_reference,name,country_code,contact_name,contact_email',

        `${externalReference},Rollback Restaurant,FR,Rollback Contact,${contactEmail}`,
      ].join('\n');

      const result = await getExecutionService().executeCsv(tenantId, csv);

      /*
       * The row failed.
       */
      expect(result.summary).toEqual({
        totalRows: 1,

        createdEstablishments: 0,
        reusedEstablishments: 0,

        createdContacts: 0,

        skippedRows: 0,
        failedRows: 1,
      });

      expect(result.rows[0]).toMatchObject({
        status: 'failed',

        establishmentId: null,
        contactId: null,

        reason: 'Import row failed',
      });

      /*
       * Most important assertion:
       *
       * establishmentService.create()
       * ran before contact creation failed,
       * but PostgreSQL must have rolled
       * the establishment INSERT back.
       */
      const storedEstablishments = await getDatabase()
        .select()
        .from(establishments)
        .where(
          and(
            eq(establishments.tenantId, tenantId),
            eq(establishments.externalReference, externalReference),
          ),
        );

      expect(storedEstablishments).toHaveLength(0);

      /*
       * No contact should remain either.
       */
      const storedContacts = await getDatabase()
        .select()
        .from(establishmentContacts)
        .where(
          and(
            eq(establishmentContacts.tenantId, tenantId),
            eq(establishmentContacts.email, contactEmail),
          ),
        );

      expect(storedContacts).toHaveLength(0);
    } finally {
      createContactSpy.mockRestore();
    }
  });

  it('reuses the establishment and contact when importing the same CSV again', async () => {
    const csv = [
      'external_reference,name,postal_code,city,country_code,contact_name,contact_job_title,contact_email,is_primary',

      'REST-001,Restaurant Paris,75001,Paris,FR,Marie Dupont,Purchasing Manager,MARIE@EXAMPLE.COM,true',
    ].join('\n');

    const result = await getExecutionService().executeCsv(tenantId, csv);

    expect(result.summary).toEqual({
      totalRows: 1,

      createdEstablishments: 0,
      reusedEstablishments: 1,

      createdContacts: 0,

      skippedRows: 0,
      failedRows: 0,
    });

    expect(result.rows[0]?.status).toBe('reused');

    const storedEstablishments = await getDatabase()
      .select()
      .from(establishments)
      .where(eq(establishments.tenantId, tenantId));

    const storedContacts = await getDatabase()
      .select()
      .from(establishmentContacts)
      .where(eq(establishmentContacts.tenantId, tenantId));

    /*
     * This is the important dedup proof.
     */
    expect(storedEstablishments).toHaveLength(1);

    expect(storedContacts).toHaveLength(1);
  });

  it('deduplicates an establishment by normalized identity when external reference is absent', async () => {
    const firstCsv = ['name,postal_code,city,country_code', 'Hotel Lyon,69001,Lyon,FR'].join('\n');

    const firstResult = await getExecutionService().executeCsv(tenantId, firstCsv);

    expect(firstResult.summary.createdEstablishments).toBe(1);

    const secondCsv = ['name,postal_code,city,country_code', '  HOTEL   LYON  ,69001,LYON,fr'].join(
      '\n',
    );

    const secondResult = await getExecutionService().executeCsv(tenantId, secondCsv);

    expect(secondResult.summary.createdEstablishments).toBe(0);

    expect(secondResult.summary.reusedEstablishments).toBe(1);

    const tenantEstablishments = await getDatabase()
      .select()
      .from(establishments)
      .where(eq(establishments.tenantId, tenantId));

    /*
     * Restaurant Paris + Hotel Lyon
     */
    expect(tenantEstablishments).toHaveLength(2);
  });

  it('skips invalid and duplicate-in-file rows while importing valid rows', async () => {
    const csv = [
      'external_reference,name,country_code',

      'REST-002,Restaurant Nice,FR',

      ',,FR',

      'REST-002,Restaurant Nice Duplicate,FR',

      'REST-003,Restaurant Lille,FR',
    ].join('\n');

    const result = await getExecutionService().executeCsv(tenantId, csv);

    expect(result.summary.totalRows).toBe(4);

    expect(result.summary.createdEstablishments).toBe(2);

    expect(result.summary.skippedRows).toBe(2);

    expect(result.summary.failedRows).toBe(0);

    expect(result.rows.map((row) => row.status)).toEqual([
      'created',
      'skipped',
      'skipped',
      'created',
    ]);
  });

  it('prevents duplicate establishments during concurrent imports', async () => {
    const suffix = randomUUID().replaceAll('-', '').slice(0, 10);

    const externalReference = `CONCURRENT-${suffix}`;

    const contactEmail = `concurrent-${suffix}@example.com`;

    const csv = [
      'external_reference,name,postal_code,city,country_code,contact_name,contact_email',
      `${externalReference},Concurrent Restaurant,75008,Paris,FR,Concurrent Contact,${contactEmail}`,
    ].join('\n');

    /*
     * Start both imports without awaiting
     * the first one.
     *
     * They now compete for the same
     * establishment identity.
     */
    const [firstResult, secondResult] = await Promise.all([
      getExecutionService().executeCsv(tenantId, csv),

      getExecutionService().executeCsv(tenantId, csv),
    ]);

    /*
     * We do not know which request will
     * acquire the PostgreSQL advisory lock
     * first.
     *
     * Therefore assert the combined result:
     *
     * one request creates
     * one request reuses
     */
    expect(
      firstResult.summary.createdEstablishments + secondResult.summary.createdEstablishments,
    ).toBe(1);

    expect(
      firstResult.summary.reusedEstablishments + secondResult.summary.reusedEstablishments,
    ).toBe(1);

    expect(firstResult.summary.createdContacts + secondResult.summary.createdContacts).toBe(1);

    expect(firstResult.summary.failedRows + secondResult.summary.failedRows).toBe(0);

    /*
     * Verify PostgreSQL itself contains
     * exactly one establishment.
     */
    const storedEstablishments = await getDatabase()
      .select()
      .from(establishments)
      .where(
        and(
          eq(establishments.tenantId, tenantId),
          eq(establishments.externalReference, externalReference),
        ),
      );

    expect(storedEstablishments).toHaveLength(1);

    const storedEstablishment = storedEstablishments[0];

    if (!storedEstablishment) {
      throw new Error('Concurrent establishment was not created');
    }

    const storedContacts = await getDatabase()
      .select()
      .from(establishmentContacts)
      .where(
        and(
          eq(establishmentContacts.tenantId, tenantId),
          eq(establishmentContacts.establishmentId, storedEstablishment.id),
          eq(establishmentContacts.email, contactEmail),
        ),
      );

    expect(storedContacts).toHaveLength(1);
  });
});
