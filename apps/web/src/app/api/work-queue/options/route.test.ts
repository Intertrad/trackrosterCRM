import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { WorkQueueOptionsResponse } from '@/lib/api/work-queue-types';

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

import { GET } from './route';

describe('GET /api/work-queue/options', () => {
  const teamId = '11111111-1111-4111-8111-111111111111';

  const responseBody: WorkQueueOptionsResponse = {
    campaigns: [
      {
        id: '22222222-2222-4222-8222-222222222222',
        name: 'Paris Expansion',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    authenticatedBackendJsonMock.mockResolvedValue(responseBody);

    unauthenticatedResponseMock.mockReturnValue(
      Response.json(
        {
          statusCode: 401,
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          error: 'Unauthorized',
        },
        {
          status: 401,
        },
      ),
    );

    apiErrorResponseMock.mockReturnValue(
      Response.json(
        {
          statusCode: 403,
          code: 'FORBIDDEN',
          message: 'User does not have access to this prospector workspace',
          error: 'Forbidden',
        },
        {
          status: 403,
        },
      ),
    );
  });

  it('forwards only teamId to the authenticated backend', async () => {
    const request = new Request(
      'http://localhost:3000/api/work-queue/options' +
        `?teamId=${teamId}` +
        '&tenantId=malicious-tenant' +
        '&userId=malicious-user' +
        '&authenticatedUserId=malicious-authenticated-user' +
        '&organizationId=malicious-organization' +
        '&role=client_admin' +
        '&scopeType=tenant' +
        '&campaignId=malicious-campaign' +
        '&q=malicious-search' +
        '&cursor=malicious-cursor' +
        '&limit=999' +
        '&unexpected=value',
    );

    const response = await GET(request);

    expect(authenticatedBackendJsonMock).toHaveBeenCalledTimes(1);

    expect(authenticatedBackendJsonMock).toHaveBeenCalledWith(
      `/work-queue/options?teamId=${teamId}`,
    );

    expect(response.status).toBe(200);

    await expect(response.json()).resolves.toEqual(responseBody);
  });

  it('forwards the base options path when teamId is missing so Nest performs validation', async () => {
    const request = new Request(
      'http://localhost:3000/api/work-queue/options' +
        '?tenantId=malicious-tenant' +
        '&userId=malicious-user' +
        '&unexpected=value',
    );

    await GET(request);

    expect(authenticatedBackendJsonMock).toHaveBeenCalledWith('/work-queue/options');
  });

  it('returns the standard unauthenticated response when the session cannot be restored', async () => {
    authenticatedBackendJsonMock.mockResolvedValue(null);

    const request = new Request(
      'http://localhost:3000/api/work-queue/options' + `?teamId=${teamId}`,
    );

    const response = await GET(request);

    expect(authenticatedBackendJsonMock).toHaveBeenCalledWith(
      `/work-queue/options?teamId=${teamId}`,
    );

    expect(unauthenticatedResponseMock).toHaveBeenCalledTimes(1);
    expect(apiErrorResponseMock).not.toHaveBeenCalled();

    expect(response.status).toBe(401);

    await expect(response.json()).resolves.toMatchObject({
      statusCode: 401,
      code: 'UNAUTHORIZED',
    });
  });

  it('delegates backend errors to the shared API error response', async () => {
    const backendError = new Error('prospector workspace forbidden');

    authenticatedBackendJsonMock.mockRejectedValue(backendError);

    const request = new Request(
      'http://localhost:3000/api/work-queue/options' + `?teamId=${teamId}`,
    );

    const response = await GET(request);

    expect(apiErrorResponseMock).toHaveBeenCalledWith(backendError);
    expect(unauthenticatedResponseMock).not.toHaveBeenCalled();

    expect(response.status).toBe(403);

    await expect(response.json()).resolves.toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN',
    });
  });
});
