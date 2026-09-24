import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { WorkQueueProspectDetail } from '@/lib/api/work-queue-types';

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

describe('GET /api/work-queue/:campaignId/:prospectId/collision-decision', () => {
  const campaignId = '11111111-1111-4111-8111-111111111111';

  const prospectId = '22222222-2222-4222-8222-222222222222';

  const teamId = '33333333-3333-4333-8333-333333333333';

  const detailPath = `/work-queue/${campaignId}/${prospectId}` + `?teamId=${teamId}`;

  const collisionPath =
    `/campaigns/${campaignId}` + `/prospects/${prospectId}` + '/collision-decision';

  const detailResponse: WorkQueueProspectDetail = {
    campaignProspectId: prospectId,

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

      phone: '+33100000000',

      website: 'https://paris-clinic.example',

      status: 'active',
    },
  };

  const context = {
    params: Promise.resolve({
      campaignId,

      prospectId,
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();

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

          message: 'Prospect unavailable',

          error: 'Forbidden',
        },
        {
          status: 403,
        },
      ),
    );
  });

  it('checks the personal work queue before requesting the collision decision', async () => {
    authenticatedBackendJsonMock.mockResolvedValueOnce(detailResponse).mockResolvedValueOnce({
      decision: 'allow',

      reasonCode: 'NO_COLLISION',

      establishmentId: 'internal-establishment',

      conflict: null,
    });

    const request = new Request(
      'http://localhost:3000' +
        `/api/work-queue/${campaignId}/${prospectId}/collision-decision` +
        `?teamId=${teamId}`,
    );

    const response = await GET(request, context);

    expect(authenticatedBackendJsonMock).toHaveBeenCalledTimes(2);

    expect(authenticatedBackendJsonMock).toHaveBeenNthCalledWith(1, detailPath);

    expect(authenticatedBackendJsonMock).toHaveBeenNthCalledWith(2, collisionPath);

    expect(response.status).toBe(200);

    await expect(response.json()).resolves.toEqual({
      decision: 'allow',

      reasonCode: 'NO_COLLISION',

      conflict: null,
    });
  });

  it('strips establishmentId from the browser response', async () => {
    authenticatedBackendJsonMock.mockResolvedValueOnce(detailResponse).mockResolvedValueOnce({
      decision: 'block',

      reasonCode: 'RECENT_CONTACT',

      establishmentId: '77777777-7777-4777-8777-777777777777',

      conflict: {
        expiresAt: '2026-09-16T11:00:00.000Z',
      },
    });

    const request = new Request(
      'http://localhost:3000' +
        `/api/work-queue/${campaignId}/${prospectId}/collision-decision` +
        `?teamId=${teamId}`,
    );

    const response = await GET(request, context);

    const body = (await response.json()) as Record<string, unknown>;

    expect(body).toEqual({
      decision: 'block',

      reasonCode: 'RECENT_CONTACT',

      conflict: {
        expiresAt: '2026-09-16T11:00:00.000Z',
      },
    });

    expect(body).not.toHaveProperty('establishmentId');
  });

  it('returns unauthenticated without requesting collision state when the personal queue session cannot be restored', async () => {
    authenticatedBackendJsonMock.mockResolvedValueOnce(null);

    const request = new Request(
      'http://localhost:3000' +
        `/api/work-queue/${campaignId}/${prospectId}/collision-decision` +
        `?teamId=${teamId}`,
    );

    const response = await GET(request, context);

    expect(authenticatedBackendJsonMock).toHaveBeenCalledTimes(1);

    expect(authenticatedBackendJsonMock).toHaveBeenCalledWith(detailPath);

    expect(unauthenticatedResponseMock).toHaveBeenCalledTimes(1);

    expect(apiErrorResponseMock).not.toHaveBeenCalled();

    expect(response.status).toBe(401);
  });

  it('delegates personal work queue authorization errors to the shared API error response', async () => {
    const queueError = new Error('prospect unavailable');

    authenticatedBackendJsonMock.mockRejectedValueOnce(queueError);

    const request = new Request(
      'http://localhost:3000' +
        `/api/work-queue/${campaignId}/${prospectId}/collision-decision` +
        `?teamId=${teamId}`,
    );

    const response = await GET(request, context);

    expect(authenticatedBackendJsonMock).toHaveBeenCalledTimes(1);

    expect(apiErrorResponseMock).toHaveBeenCalledWith(queueError);

    expect(response.status).toBe(403);
  });

  it('delegates collision-decision errors after the personal queue check', async () => {
    const collisionError = new Error('collision decision failed');

    authenticatedBackendJsonMock
      .mockResolvedValueOnce(detailResponse)
      .mockRejectedValueOnce(collisionError);

    const request = new Request(
      'http://localhost:3000' +
        `/api/work-queue/${campaignId}/${prospectId}/collision-decision` +
        `?teamId=${teamId}`,
    );

    const response = await GET(request, context);

    expect(authenticatedBackendJsonMock).toHaveBeenCalledTimes(2);

    expect(apiErrorResponseMock).toHaveBeenCalledWith(collisionError);

    expect(response.status).toBe(403);
  });

  it('URL-encodes the personal queue and collision route segments', async () => {
    authenticatedBackendJsonMock.mockResolvedValueOnce(detailResponse).mockResolvedValueOnce({
      decision: 'allow',

      reasonCode: 'NO_COLLISION',

      establishmentId: 'internal-establishment',

      conflict: null,
    });

    const encodedContext = {
      params: Promise.resolve({
        campaignId: 'campaign id',

        prospectId: 'prospect?id',
      }),
    };

    const request = new Request(
      'http://localhost:3000/api/work-queue/example/example/collision-decision' +
        `?teamId=${teamId}`,
    );

    await GET(request, encodedContext);

    expect(authenticatedBackendJsonMock).toHaveBeenNthCalledWith(
      1,
      '/work-queue/campaign%20id/prospect%3Fid' + `?teamId=${teamId}`,
    );

    expect(authenticatedBackendJsonMock).toHaveBeenNthCalledWith(
      2,
      '/campaigns/campaign%20id' + '/prospects/prospect%3Fid' + '/collision-decision',
    );
  });
});
