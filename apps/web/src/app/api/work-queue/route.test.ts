import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { WorkQueueResponse } from '@/lib/api/work-queue-types';

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

describe('GET /api/work-queue', () => {
  const teamId = '11111111-1111-4111-8111-111111111111';

  const campaignId = '22222222-2222-4222-8222-222222222222';

  const responseBody: WorkQueueResponse = {
    items: [
      {
        campaignProspectId: '33333333-3333-4333-8333-333333333333',

        lifecycleStage: 'in_progress',

        latestActivity: {
          type: 'call',

          occurredAt: '2026-09-19T08:00:00.000Z',
        },

        nextFollowUp: {
          id: '77777777-7777-4777-8777-777777777777',

          dueAt: '2026-09-20T10:00:00.000Z',
        },

        campaign: {
          id: campaignId,
          name: 'Paris Expansion',
        },

        assignment: {
          id: '44444444-4444-4444-8444-444444444444',

          organizationId: '55555555-5555-4555-8555-555555555555',

          teamId,

          assignedAt: '2026-09-16T08:00:00.000Z',
        },

        establishment: {
          id: '66666666-6666-4666-8666-666666666666',

          regionId: null,

          name: 'Paris Clinic',

          addressLine1: '10 Rue de Rivoli',

          postalCode: '75001',

          city: 'Paris',

          countryCode: 'FR',

          latitude: 49.1596,

          longitude: 5.3828,

          phone: null,

          website: null,

          status: 'active',
        },
      },
    ],

    page: {
      limit: 25,

      hasMore: false,

      nextCursor: null,
    },
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

  it('forwards only supported work queue query parameters', async () => {
    const request = new Request(
      'http://localhost:3000/api/work-queue' +
        `?teamId=${teamId}` +
        `&campaignId=${campaignId}` +
        '&lifecycleStage=follow_up' +
        '&q=Paris%20Clinic' +
        '&cursor=cursor-value' +
        '&limit=20' +
        '&tenantId=malicious-tenant' +
        '&userId=malicious-user' +
        '&status=converted' +
        '&unexpected=value',
    );

    const response = await GET(request);

    expect(authenticatedBackendJsonMock).toHaveBeenCalledTimes(1);

    expect(authenticatedBackendJsonMock).toHaveBeenCalledWith(
      '/work-queue' +
        `?teamId=${teamId}` +
        `&campaignId=${campaignId}` +
        '&lifecycleStage=follow_up' +
        '&q=Paris+Clinic' +
        '&cursor=cursor-value' +
        '&limit=20',
    );

    expect(response.status).toBe(200);

    await expect(response.json()).resolves.toEqual(responseBody);
  });

  it('does not forward browser-controlled tenant or user identity', async () => {
    const request = new Request(
      'http://localhost:3000/api/work-queue' +
        `?teamId=${teamId}` +
        '&tenantId=another-tenant' +
        '&userId=another-user',
    );

    await GET(request);

    expect(authenticatedBackendJsonMock).toHaveBeenCalledWith(`/work-queue?teamId=${teamId}`);
  });

  it('forwards the base work queue path when no query parameters are supplied', async () => {
    const request = new Request('http://localhost:3000/api/work-queue');

    await GET(request);

    expect(authenticatedBackendJsonMock).toHaveBeenCalledWith('/work-queue');
  });

  it('returns the standard unauthenticated response when the session cannot be restored', async () => {
    authenticatedBackendJsonMock.mockResolvedValue(null);

    const request = new Request('http://localhost:3000/api/work-queue' + `?teamId=${teamId}`);

    const response = await GET(request);

    expect(unauthenticatedResponseMock).toHaveBeenCalledTimes(1);

    expect(apiErrorResponseMock).not.toHaveBeenCalled();

    expect(response.status).toBe(401);

    await expect(response.json()).resolves.toMatchObject({
      statusCode: 401,

      code: 'UNAUTHORIZED',
    });
  });

  it('delegates backend authorization errors to the shared API error response', async () => {
    const backendError = new Error('prospector workspace forbidden');

    authenticatedBackendJsonMock.mockRejectedValue(backendError);

    const request = new Request('http://localhost:3000/api/work-queue' + `?teamId=${teamId}`);

    const response = await GET(request);

    expect(apiErrorResponseMock).toHaveBeenCalledWith(backendError);

    expect(response.status).toBe(403);

    await expect(response.json()).resolves.toMatchObject({
      statusCode: 403,

      code: 'FORBIDDEN',
    });
  });
});
