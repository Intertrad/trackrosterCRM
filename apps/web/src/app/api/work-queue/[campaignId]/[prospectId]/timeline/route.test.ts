import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProspectTimelinePage, WorkQueueProspectDetail } from '@/lib/api/work-queue-types';

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

describe('GET /api/work-queue/:campaignId/:prospectId/timeline', () => {
  const campaignId = '11111111-1111-4111-8111-111111111111';

  const prospectId = '22222222-2222-4222-8222-222222222222';

  const teamId = '33333333-3333-4333-8333-333333333333';

  const detail: WorkQueueProspectDetail = {
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

      phone: null,

      website: null,

      status: 'active',
    },
  };

  const timeline: ProspectTimelinePage = {
    items: [
      {
        kind: 'activity',

        id: '77777777-7777-4777-8777-777777777777',

        occurredAt: '2026-09-16T09:30:00.000Z',

        activityType: 'call',

        actor: {
          userId: '88888888-8888-4888-8888-888888888888',
        },

        context: {
          campaignId,

          campaignProspectId: prospectId,

          establishmentId: detail.establishment.id,

          assignmentId: detail.assignment.id,
        },
      },
    ],

    nextCursor: 'timeline-cursor',
  };

  const context = {
    params: Promise.resolve({
      campaignId,

      prospectId,
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    /*
     * First call:
     * Work Queue detail authorization.
     *
     * Second call:
     * Timeline retrieval.
     */
    authenticatedBackendJsonMock.mockResolvedValueOnce(detail).mockResolvedValueOnce(timeline);

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
          statusCode: 404,

          code: 'NOT_FOUND',

          message: 'Work queue prospect not found',

          error: 'Not Found',
        },
        {
          status: 404,
        },
      ),
    );
  });

  it('authorizes through Work Queue detail before loading the timeline', async () => {
    const request = new Request(
      'http://localhost:3000' +
        `/api/work-queue/${campaignId}/${prospectId}/timeline` +
        `?teamId=${teamId}` +
        '&limit=25' +
        '&cursor=older-events',
    );

    const response = await GET(request, context);

    expect(authenticatedBackendJsonMock).toHaveBeenCalledTimes(2);

    expect(authenticatedBackendJsonMock).toHaveBeenNthCalledWith(
      1,
      `/work-queue/${campaignId}/${prospectId}` + `?teamId=${teamId}`,
    );

    expect(authenticatedBackendJsonMock).toHaveBeenNthCalledWith(
      2,
      `/campaigns/${campaignId}` +
        `/prospects/${prospectId}` +
        '/timeline' +
        '?limit=25&cursor=older-events',
    );

    expect(response.status).toBe(200);

    await expect(response.json()).resolves.toEqual(timeline);
  });

  it('forwards only timeline pagination parameters after detail authorization', async () => {
    const request = new Request(
      'http://localhost:3000' +
        `/api/work-queue/${campaignId}/${prospectId}/timeline` +
        `?teamId=${teamId}` +
        '&limit=50' +
        '&cursor=cursor-value' +
        '&tenantId=malicious-tenant' +
        '&userId=malicious-user' +
        '&assignedUserId=malicious-assignee' +
        '&organizationId=malicious-org' +
        '&role=client_admin' +
        '&scopeType=tenant' +
        '&unexpected=value',
    );

    await GET(request, context);

    expect(authenticatedBackendJsonMock).toHaveBeenNthCalledWith(
      1,
      `/work-queue/${campaignId}/${prospectId}` + `?teamId=${teamId}`,
    );

    expect(authenticatedBackendJsonMock).toHaveBeenNthCalledWith(
      2,
      `/campaigns/${campaignId}` +
        `/prospects/${prospectId}` +
        '/timeline' +
        '?limit=50&cursor=cursor-value',
    );
  });

  it('does not forward teamId to the Nest timeline endpoint', async () => {
    const request = new Request(
      'http://localhost:3000' +
        `/api/work-queue/${campaignId}/${prospectId}/timeline` +
        `?teamId=${teamId}` +
        '&limit=25',
    );

    await GET(request, context);

    expect(authenticatedBackendJsonMock).toHaveBeenNthCalledWith(
      2,
      `/campaigns/${campaignId}` + `/prospects/${prospectId}` + '/timeline?limit=25',
    );
  });

  it('does not load the timeline when Work Queue detail authorization cannot restore a session', async () => {
    authenticatedBackendJsonMock.mockReset();

    authenticatedBackendJsonMock.mockResolvedValueOnce(null);

    const request = new Request(
      'http://localhost:3000' +
        `/api/work-queue/${campaignId}/${prospectId}/timeline` +
        `?teamId=${teamId}` +
        '&limit=25',
    );

    const response = await GET(request, context);

    expect(authenticatedBackendJsonMock).toHaveBeenCalledTimes(1);

    expect(unauthenticatedResponseMock).toHaveBeenCalledTimes(1);

    expect(response.status).toBe(401);
  });

  it('does not load the timeline when Work Queue detail authorization fails', async () => {
    const authorizationError = new Error('work queue prospect not found');

    authenticatedBackendJsonMock.mockReset();

    authenticatedBackendJsonMock.mockRejectedValueOnce(authorizationError);

    const request = new Request(
      'http://localhost:3000' +
        `/api/work-queue/${campaignId}/${prospectId}/timeline` +
        `?teamId=${teamId}` +
        '&limit=25',
    );

    const response = await GET(request, context);

    expect(authenticatedBackendJsonMock).toHaveBeenCalledTimes(1);

    expect(apiErrorResponseMock).toHaveBeenCalledWith(authorizationError);

    expect(response.status).toBe(404);
  });

  it('returns the standard unauthenticated response when the timeline session cannot be restored', async () => {
    authenticatedBackendJsonMock.mockReset();

    authenticatedBackendJsonMock.mockResolvedValueOnce(detail).mockResolvedValueOnce(null);

    const request = new Request(
      'http://localhost:3000' +
        `/api/work-queue/${campaignId}/${prospectId}/timeline` +
        `?teamId=${teamId}`,
    );

    const response = await GET(request, context);

    expect(authenticatedBackendJsonMock).toHaveBeenCalledTimes(2);

    expect(unauthenticatedResponseMock).toHaveBeenCalledTimes(1);

    expect(response.status).toBe(401);
  });

  it('delegates timeline backend errors to the shared API error response', async () => {
    const timelineError = new Error('timeline unavailable');

    authenticatedBackendJsonMock.mockReset();

    authenticatedBackendJsonMock.mockResolvedValueOnce(detail).mockRejectedValueOnce(timelineError);

    const request = new Request(
      'http://localhost:3000' +
        `/api/work-queue/${campaignId}/${prospectId}/timeline` +
        `?teamId=${teamId}`,
    );

    const response = await GET(request, context);

    expect(authenticatedBackendJsonMock).toHaveBeenCalledTimes(2);

    expect(apiErrorResponseMock).toHaveBeenCalledWith(timelineError);

    expect(response.status).toBe(404);
  });
});
