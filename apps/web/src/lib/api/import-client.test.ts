import { beforeEach, describe, expect, it, vi } from 'vitest';

const { browserJsonMock } = vi.hoisted(() => ({
  browserJsonMock: vi.fn(),
}));

vi.mock('./browser-json', () => ({
  browserJson: browserJsonMock,
}));

import { executeImport, previewImport } from './import-client';

const previewResult = {
  summary: {
    totalRows: 1,
    validRows: 1,
    warningRows: 0,
    invalidRows: 0,
  },

  rows: [
    {
      rowNumber: 2,

      status: 'valid' as const,

      establishment: {
        externalReference: null,

        name: 'Restaurant Paris',

        addressLine1: null,
        postalCode: '75001',
        city: 'Paris',

        countryCode: 'FR',

        phone: null,
        website: null,

        latitude: null,
        longitude: null,
      },

      contact: null,

      issues: [],
    },
  ],
};

const executionResult = {
  summary: {
    totalRows: 1,

    createdEstablishments: 1,

    reusedEstablishments: 0,

    createdContacts: 0,

    skippedRows: 0,

    failedRows: 0,
  },

  rows: [
    {
      rowNumber: 2,

      status: 'created' as const,

      establishmentId: '11111111-1111-4111-8111-111111111111',

      contactId: null,

      reason: null,
    },
  ],
};

describe('import client', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('uploads the CSV to the preview BFF using the file multipart field', async () => {
    browserJsonMock.mockResolvedValue(previewResult);

    const file = new File(['name,country_code\nRestaurant Paris,FR'], 'prospects.csv', {
      type: 'text/csv',
    });

    const result = await previewImport(file);

    expect(browserJsonMock).toHaveBeenCalledTimes(1);

    const [path, options] = browserJsonMock.mock.calls[0] as [string, RequestInit];

    expect(path).toBe('/api/imports/preview');

    expect(options.method).toBe('POST');

    expect(options.body).toBeInstanceOf(FormData);

    const formData = options.body as FormData;

    expect(formData.get('file')).toBe(file);

    expect(Array.from(formData.keys())).toEqual(['file']);

    expect(result).toBe(previewResult);
  });

  it('does not manually set multipart content type for preview', async () => {
    browserJsonMock.mockResolvedValue(previewResult);

    const file = new File(['name,country_code\nA,FR'], 'preview.csv', {
      type: 'text/csv',
    });

    await previewImport(file);

    const options = browserJsonMock.mock.calls[0]?.[1] as RequestInit;

    expect(options.headers).toBeUndefined();
  });

  it('uploads the CSV to the execute BFF using the file multipart field', async () => {
    browserJsonMock.mockResolvedValue(executionResult);

    const file = new File(['name,country_code\nRestaurant Paris,FR'], 'prospects.csv', {
      type: 'text/csv',
    });

    const result = await executeImport(file);

    const [path, options] = browserJsonMock.mock.calls[0] as [string, RequestInit];

    expect(path).toBe('/api/imports/execute');

    expect(options.method).toBe('POST');

    expect(options.body).toBeInstanceOf(FormData);

    const formData = options.body as FormData;

    expect(formData.get('file')).toBe(file);

    expect(Array.from(formData.keys())).toEqual(['file']);

    expect(result).toBe(executionResult);
  });

  it('does not manually set multipart content type for execution', async () => {
    browserJsonMock.mockResolvedValue(executionResult);

    const file = new File(['name,country_code\nA,FR'], 'execute.csv', {
      type: 'text/csv',
    });

    await executeImport(file);

    const options = browserJsonMock.mock.calls[0]?.[1] as RequestInit;

    expect(options.headers).toBeUndefined();
  });

  it('propagates preview errors from browserJson', async () => {
    const error = new Error('preview failed');

    browserJsonMock.mockRejectedValue(error);

    const file = new File(['name,country_code'], 'preview.csv', {
      type: 'text/csv',
    });

    await expect(previewImport(file)).rejects.toBe(error);
  });

  it('propagates execution errors from browserJson', async () => {
    const error = new Error('execution failed');

    browserJsonMock.mockRejectedValue(error);

    const file = new File(['name,country_code'], 'execute.csv', {
      type: 'text/csv',
    });

    await expect(executeImport(file)).rejects.toBe(error);
  });
});
