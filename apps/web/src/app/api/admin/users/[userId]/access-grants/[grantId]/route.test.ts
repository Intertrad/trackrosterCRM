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

import { DELETE } from './route';

describe('DELETE access grant BFF', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    unauthenticatedResponseMock.mockReturnValue(
      Response.json(
        {
          statusCode: 401,
          message: 'Authentication required',
        },
        {
          status: 401,
        },
      ),
    );

    apiErrorResponseMock.mockReturnValue(
      Response.json(
        {
          statusCode: 409,
          message: 'Unable to revoke grant',
        },
        {
          status: 409,
        },
      ),
    );
  });

  it('URL-encodes user and grant ids and returns 204', async () => {
    authenticatedBackendJsonMock.mockResolvedValue(undefined);

    const context = {
      params: Promise.resolve({
        userId: 'user/id',
        grantId: 'grant?id',
      }),
    };

    const response = await DELETE(
      new Request('http://localhost/api/example', {
        method: 'DELETE',
        headers: {
          'idempotency-key': 'must-not-cross',
        },
      }),
      context,
    );

    expect(authenticatedBackendJsonMock).toHaveBeenCalledWith(
      '/users/user%2Fid/access-grants/grant%3Fid',
      {
        method: 'DELETE',
      },
    );

    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
  });

  it('returns 401 when authentication cannot be restored', async () => {
    authenticatedBackendJsonMock.mockResolvedValue(null);

    const context = {
      params: Promise.resolve({
        userId: 'user-id',
        grantId: 'grant-id',
      }),
    };

    const response = await DELETE(
      new Request('http://localhost/api/example', {
        method: 'DELETE',
      }),
      context,
    );

    expect(unauthenticatedResponseMock).toHaveBeenCalledTimes(1);

    expect(response.status).toBe(401);
  });

  it('delegates backend errors to apiErrorResponse', async () => {
    const backendError = new Error('Revoke failed');

    authenticatedBackendJsonMock.mockRejectedValue(backendError);

    const context = {
      params: Promise.resolve({
        userId: 'user-id',
        grantId: 'grant-id',
      }),
    };

    const response = await DELETE(
      new Request('http://localhost/api/example', {
        method: 'DELETE',
      }),
      context,
    );

    expect(apiErrorResponseMock).toHaveBeenCalledWith(backendError);

    expect(response.status).toBe(409);
  });
});
