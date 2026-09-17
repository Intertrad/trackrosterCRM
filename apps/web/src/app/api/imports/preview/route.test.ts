import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authenticatedBackendJsonMock, apiErrorResponseMock, unauthenticatedResponseMock } =
  vi.hoisted(() => ({
    authenticatedBackendJsonMock: vi.fn(),

    apiErrorResponseMock: vi.fn(),

    unauthenticatedResponseMock: vi.fn(),
  }));

vi.mock('@/lib/server/authenticated-backend-json', () => ({
  authenticatedBackendJson: authenticatedBackendJsonMock,
}));

vi.mock('@/lib/server/api-error-response', () => ({
  apiErrorResponse: apiErrorResponseMock,

  unauthenticatedResponse: unauthenticatedResponseMock,
}));

import { POST } from './route';

const boundary = '----TrackRosterPreviewBoundary';

const multipartBody = [
  `--${boundary}\r\n`,
  'Content-Disposition: form-data; name="file"; filename="prospects.csv"\r\n',
  'Content-Type: text/csv\r\n',
  '\r\n',
  'name,country_code\r\n',
  'Restaurant Paris,FR\r\n',
  `--${boundary}--\r\n`,
].join('');

const backendPreview = {
  summary: {
    totalRows: 1,
    validRows: 1,
    warningRows: 0,
    invalidRows: 0,

    backendOnly: 'strip-me',
  },

  rows: [
    {
      rowNumber: 2,
      status: 'valid',

      establishment: {
        externalReference: null,
        name: 'Restaurant Paris',
        addressLine1: null,
        postalCode: null,
        city: null,
        countryCode: 'FR',
        phone: null,
        website: null,
        latitude: null,
        longitude: null,

        backendOnly: 'strip-me',
      },

      contact: null,

      issues: [],

      backendOnly: 'strip-me',
    },
  ],

  backendOnly: 'strip-me',
};

describe('POST /api/imports/preview', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    authenticatedBackendJsonMock.mockResolvedValue(backendPreview);

    unauthenticatedResponseMock.mockReturnValue(
      Response.json(
        {
          marker: 'unauthenticated',
        },
        {
          status: 401,
        },
      ),
    );

    apiErrorResponseMock.mockReturnValue(
      Response.json(
        {
          marker: 'api-error',
        },
        {
          status: 502,
        },
      ),
    );
  });

  it('forwards the exact multipart bytes and content type to the backend', async () => {
    const request = new Request('http://localhost/api/imports/preview', {
      method: 'POST',

      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },

      body: multipartBody,
    });

    await POST(request);

    expect(authenticatedBackendJsonMock).toHaveBeenCalledTimes(1);

    const [path, options] = authenticatedBackendJsonMock.mock.calls[0] as [string, RequestInit];

    expect(path).toBe('/imports/preview');

    expect(options.method).toBe('POST');

    const headers = new Headers(options.headers);

    expect(headers.get('content-type')).toBe(`multipart/form-data; boundary=${boundary}`);

    expect(new TextDecoder().decode(options.body as ArrayBuffer)).toBe(multipartBody);
  });

  it('does not forward browser authority or cookie headers', async () => {
    const request = new Request('http://localhost/api/imports/preview', {
      method: 'POST',

      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,

        authorization: 'Bearer browser-controlled',

        cookie: 'trackroster=fake',

        'x-tenant-id': 'browser-tenant',

        'x-user-role': 'client_admin',

        'x-user-id': 'browser-user',
      },

      body: multipartBody,
    });

    await POST(request);

    const options = authenticatedBackendJsonMock.mock.calls[0]?.[1] as RequestInit;

    const headers = new Headers(options.headers);

    expect(headers.get('content-type')).toBe(`multipart/form-data; boundary=${boundary}`);

    expect(headers.has('authorization')).toBe(false);

    expect(headers.has('cookie')).toBe(false);

    expect(headers.has('x-tenant-id')).toBe(false);

    expect(headers.has('x-user-role')).toBe(false);

    expect(headers.has('x-user-id')).toBe(false);
  });

  it('sanitizes the preview response before returning it to the browser', async () => {
    const request = new Request('http://localhost/api/imports/preview', {
      method: 'POST',

      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },

      body: multipartBody,
    });

    const response = await POST(request);

    expect(response.status).toBe(200);

    await expect(response.json()).resolves.toEqual({
      summary: {
        totalRows: 1,
        validRows: 1,
        warningRows: 0,
        invalidRows: 0,
      },

      rows: [
        {
          rowNumber: 2,

          status: 'valid',

          establishment: {
            externalReference: null,

            name: 'Restaurant Paris',

            addressLine1: null,
            postalCode: null,
            city: null,

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
    });
  });

  it('returns the shared unauthenticated response when no authenticated session is available', async () => {
    authenticatedBackendJsonMock.mockResolvedValue(null);

    const request = new Request('http://localhost/api/imports/preview', {
      method: 'POST',

      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },

      body: multipartBody,
    });

    const response = await POST(request);

    expect(unauthenticatedResponseMock).toHaveBeenCalledTimes(1);

    expect(response.status).toBe(401);

    await expect(response.json()).resolves.toEqual({
      marker: 'unauthenticated',
    });
  });

  it('maps backend failures through apiErrorResponse', async () => {
    const error = new Error('preview failed');

    authenticatedBackendJsonMock.mockRejectedValue(error);

    const request = new Request('http://localhost/api/imports/preview', {
      method: 'POST',

      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },

      body: multipartBody,
    });

    const response = await POST(request);

    expect(apiErrorResponseMock).toHaveBeenCalledWith(error);

    expect(response.status).toBe(502);
  });
});
