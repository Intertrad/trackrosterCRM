import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';

import { ImportPreviewService } from './import-preview.service.js';

describe('ImportPreviewService', () => {
  let service: ImportPreviewService;

  beforeEach(() => {
    service = new ImportPreviewService();
  });

  it('previews and normalizes valid CSV rows', () => {
    const csv = [
      'external_reference,name,address_line1,postal_code,city,country_code,phone,website,latitude,longitude,contact_name,contact_job_title,contact_email,contact_phone,is_primary',

      'REST-001,Restaurant Paris,12 Rue Example,75001,Paris,fr,+33123456789,https://example.com,48.8566,2.3522,Marie Dupont,Manager,MARIE@EXAMPLE.COM,+33111111111,true',
    ].join('\n');

    const result = service.previewCsv(csv);

    expect(result.summary).toEqual({
      totalRows: 1,
      validRows: 1,
      warningRows: 0,
      invalidRows: 0,
    });

    expect(result.rows[0]).toMatchObject({
      rowNumber: 2,
      status: 'valid',

      establishment: {
        externalReference: 'REST-001',

        name: 'Restaurant Paris',

        countryCode: 'FR',

        latitude: 48.8566,
        longitude: 2.3522,
      },

      contact: {
        name: 'Marie Dupont',
        email: 'marie@example.com',

        isPrimary: true,
      },

      issues: [],
    });
  });

  it('marks a row invalid when name is missing', () => {
    const csv = ['name,country_code', ',FR'].join('\n');

    const result = service.previewCsv(csv);

    expect(result.summary.invalidRows).toBe(1);

    expect(result.rows[0]?.status).toBe('invalid');

    expect(result.rows[0]?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'name',
          code: 'required',
        }),
      ]),
    );
  });

  it('normalizes country codes', () => {
    const csv = ['name,country_code', 'Restaurant Paris,fr'].join('\n');

    const result = service.previewCsv(csv);

    expect(result.rows[0]?.establishment?.countryCode).toBe('FR');
  });

  it('rejects latitude without longitude', () => {
    const csv = ['name,country_code,latitude,longitude', 'Restaurant Paris,FR,48.8566,'].join('\n');

    const result = service.previewCsv(csv);

    expect(result.rows[0]?.status).toBe('invalid');

    expect(result.rows[0]?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'coordinate_pair_required',
        }),
      ]),
    );
  });

  it('rejects invalid contact email', () => {
    const csv = ['name,country_code,contact_email', 'Restaurant Paris,FR,not-an-email'].join('\n');

    const result = service.previewCsv(csv);

    expect(result.rows[0]?.status).toBe('invalid');

    expect(result.rows[0]?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'contact_email',

          code: 'invalid_email',
        }),
      ]),
    );
  });

  it('rejects a missing required CSV header', () => {
    const csv = ['name,city', 'Restaurant Paris,Paris'].join('\n');

    expect(() => service.previewCsv(csv)).toThrow(BadRequestException);
  });

  it('rejects unsupported columns', () => {
    const csv = ['name,country_code,password', 'Restaurant Paris,FR,secret'].join('\n');

    expect(() => service.previewCsv(csv)).toThrow(BadRequestException);
  });

  it('rejects an empty CSV', () => {
    expect(() => service.previewCsv('   ')).toThrow(BadRequestException);
  });
});
