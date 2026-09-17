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

const boundary = '----TrackRosterExecuteBoundary';

const multipartBody = [
  `--${boundary}\r\n`,
  'Content-Disposition: form-data; name="file"; filename="prospects.csv"\r\n',
  'Content-Type: text/csv\r\n',
  '\r\n',
  'name,country_code\r\n',
  'Restaurant Paris,FR\r\n',
  `--${boundary}--\r\n`,
].join('');

const backendExecution = {
  summary: {
    totalRows: 1,

    createdEstablishments: 1,

    reusedEstablishments: 0,

    createdContacts: 1,

    skippedRows: 0,

    failedRows: 0,

    backendOnly: 'strip-me',
  },

  rows: [
    {
      rowNumber: 2,

      status: 'created',

      establishmentId: '11111111-1111-4111-8111-111111111111',

      contactId: '22222222-2222-4222-8222-222222222222',

      reason: null,

      backendOnly: 'strip-me',
    },
  ],

  backendOnly: 'strip-me',
};

describe('POST /api/imports/execute', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    authenticatedBackendJsonMock.mockResolvedValue(backendExecution);

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

  it('forwards multipart execution bytes and preserves the boundary', async () => {
    const request = new Request('http://localhost/api/imports/execute', {
      method: 'POST',

      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },

      body: multipartBody,
    });

    await POST(request);

    const [path, options] = authenticatedBackendJsonMock.mock.calls[0] as [string, RequestInit];

    expect(path).toBe('/imports/execute');

    expect(options.method).toBe('POST');

    const headers = new Headers(options.headers);

    expect(headers.get('content-type')).toBe(`multipart/form-data; boundary=${boundary}`);

    expect(new TextDecoder().decode(options.body as ArrayBuffer)).toBe(multipartBody);
  });

  it('does not forward browser-controlled authority headers', async () => {
    const request = new Request('http://localhost/api/imports/execute', {
      method: 'POST',

      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,

        authorization: 'Bearer browser-controlled',

        cookie: 'fake=true',

        'x-tenant-id': 'fake-tenant',

        role: 'client_admin',
      },

      body: multipartBody,
    });

    await POST(request);

    const options = authenticatedBackendJsonMock.mock.calls[0]?.[1] as RequestInit;

    const headers = new Headers(options.headers);

    expect(Array.from(headers.keys())).toEqual(['content-type']);
  });

  it('sanitizes the execution response before returning it to the browser', async () => {
    const request = new Request('http://localhost/api/imports/execute', {
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

        createdEstablishments: 1,

        reusedEstablishments: 0,

        createdContacts: 1,

        skippedRows: 0,

        failedRows: 0,
      },

      rows: [
        {
          rowNumber: 2,

          status: 'created',

          establishmentId: '11111111-1111-4111-8111-111111111111',

          contactId: '22222222-2222-4222-8222-222222222222',

          reason: null,
        },
      ],
    });
  });

  it('returns the shared unauthenticated response when authentication cannot be restored', async () => {
    authenticatedBackendJsonMock.mockResolvedValue(null);

    const request = new Request('http://localhost/api/imports/execute', {
      method: 'POST',

      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },

      body: multipartBody,
    });

    const response = await POST(request);

    expect(unauthenticatedResponseMock).toHaveBeenCalledTimes(1);

    expect(response.status).toBe(401);
  });

  it('maps Nest execution errors through apiErrorResponse', async () => {
    const error = new Error('execution failed');

    authenticatedBackendJsonMock.mockRejectedValue(error);

    const request = new Request('http://localhost/api/imports/execute', {
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
