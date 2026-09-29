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

import { PATCH } from './route';

describe('follow-up reschedule BFF', () => {
  const campaignId = '11111111-1111-4111-8111-111111111111';

  const prospectId = '22222222-2222-4222-8222-222222222222';

  const teamId = '33333333-3333-4333-8333-333333333333';

  const followUpId = '44444444-4444-4444-8444-444444444444';

  const dueAt = '2026-09-21T14:00:00.000Z';

  const exactKey = 'reschedule-Exact-Key';

  const context = {
    params: Promise.resolve({
      campaignId,

      prospectId,

      followUpId,
    }),
  };

  const detailPath = `/work-queue/${campaignId}/${prospectId}` + `?teamId=${teamId}`;

  const actionPath =
    `/campaigns/${campaignId}` +
    `/prospects/${prospectId}` +
    `/follow-ups/${followUpId}/reschedule`;

  const backendFollowUp = {
    id: followUpId,

    campaignId,

    campaignProspectId: prospectId,

    establishmentId: '55555555-5555-4555-8555-555555555555',

    assignedUserId: 'internal-user',

    createdBy: 'internal-creator',

    dueAt,

    status: 'pending' as const,

    completedAt: null,

    cancelledAt: null,

    createdAt: '2026-09-16T10:00:00.000Z',

    updatedAt: '2026-09-16T11:00:00.000Z',
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
          statusCode: 409,
          code: 'CONFLICT',
          message: 'Follow-up is no longer pending',
          error: 'Conflict',
        },
        {
          status: 409,
        },
      ),
    );
  });

  it('checks work queue authorization then forwards only dueAt', async () => {
    authenticatedBackendJsonMock.mockResolvedValueOnce({}).mockResolvedValueOnce(backendFollowUp);

    const request = new Request(`http://localhost:3000/api/example?teamId=${teamId}`, {
      method: 'PATCH',

      headers: {
        'content-type': 'application/json',

        'idempotency-key': exactKey,
      },

      body: JSON.stringify({
        dueAt,

        assignedUserId: 'browser-user',

        status: 'completed',

        tenantId: 'browser-tenant',
      }),
    });

    const response = await PATCH(request, context);

    expect(authenticatedBackendJsonMock).toHaveBeenNthCalledWith(1, detailPath);

    expect(authenticatedBackendJsonMock).toHaveBeenNthCalledWith(2, actionPath, {
      method: 'PATCH',

      headers: {
        'idempotency-key': exactKey,
      },

      body: JSON.stringify({
        dueAt,
      }),
    });

    expect(response.status).toBe(200);
  });

  it('sanitizes the rescheduled follow-up response', async () => {
    authenticatedBackendJsonMock.mockResolvedValueOnce({}).mockResolvedValueOnce(backendFollowUp);

    const request = new Request(`http://localhost:3000/api/example?teamId=${teamId}`, {
      method: 'PATCH',

      headers: {
        'content-type': 'application/json',
      },

      body: JSON.stringify({
        dueAt,
      }),
    });

    const response = await PATCH(request, context);

    const body = (await response.json()) as Record<string, unknown>;

    expect(body).not.toHaveProperty('assignedUserId');
    expect(body).not.toHaveProperty('createdBy');

    expect(body.prospectId).toBe(prospectId);

    expect(body.ownership).toBe('user');
  });

  it('does not mutate when work queue authentication cannot be restored', async () => {
    authenticatedBackendJsonMock.mockResolvedValueOnce(null);

    const request = new Request(`http://localhost:3000/api/example?teamId=${teamId}`, {
      method: 'PATCH',
    });

    const response = await PATCH(request, context);

    expect(authenticatedBackendJsonMock).toHaveBeenCalledTimes(1);

    expect(response.status).toBe(401);
  });

  it('URL-encodes campaign, prospect, and follow-up IDs', async () => {
    authenticatedBackendJsonMock.mockResolvedValueOnce({}).mockResolvedValueOnce(backendFollowUp);

    const encodedContext = {
      params: Promise.resolve({
        campaignId: 'campaign id',

        prospectId: 'prospect?id',

        followUpId: 'follow/up id',
      }),
    };

    const request = new Request(`http://localhost:3000/api/example?teamId=${teamId}`, {
      method: 'PATCH',

      body: JSON.stringify({
        dueAt,
      }),
    });

    await PATCH(request, encodedContext);

    expect(authenticatedBackendJsonMock).toHaveBeenNthCalledWith(
      1,
      `/work-queue/campaign%20id/prospect%3Fid?teamId=${teamId}`,
    );

    expect(authenticatedBackendJsonMock).toHaveBeenNthCalledWith(
      2,
      '/campaigns/campaign%20id' +
        '/prospects/prospect%3Fid' +
        '/follow-ups/follow%2Fup%20id/reschedule',
      expect.any(Object),
    );
  });

  it('delegates mutation conflicts', async () => {
    const backendError = new Error('follow-up is no longer pending');

    authenticatedBackendJsonMock.mockResolvedValueOnce({}).mockRejectedValueOnce(backendError);

    const request = new Request(`http://localhost:3000/api/example?teamId=${teamId}`, {
      method: 'PATCH',

      body: JSON.stringify({
        dueAt,
      }),
    });

    const response = await PATCH(request, context);

    expect(apiErrorResponseMock).toHaveBeenCalledWith(backendError);

    expect(response.status).toBe(409);
  });
});
