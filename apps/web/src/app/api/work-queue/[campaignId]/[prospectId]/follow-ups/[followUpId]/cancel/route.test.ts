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

describe('follow-up cancel BFF', () => {
  const campaignId = '11111111-1111-4111-8111-111111111111';

  const prospectId = '22222222-2222-4222-8222-222222222222';

  const teamId = '33333333-3333-4333-8333-333333333333';

  const followUpId = '44444444-4444-4444-8444-444444444444';

  const exactKey = 'cancel-Exact-Key';

  const context = {
    params: Promise.resolve({
      campaignId,

      prospectId,

      followUpId,
    }),
  };

  const backendFollowUp = {
    id: followUpId,

    campaignId,

    campaignProspectId: prospectId,

    establishmentId: '55555555-5555-4555-8555-555555555555',

    assignedUserId: null,

    createdBy: 'internal-creator',

    dueAt: '2026-09-20T10:00:00.000Z',

    status: 'cancelled' as const,

    completedAt: null,

    cancelledAt: '2026-09-16T12:00:00.000Z',

    createdAt: '2026-09-16T10:00:00.000Z',

    updatedAt: '2026-09-16T12:00:00.000Z',
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

  it('checks authorization and cancels the exact follow-up', async () => {
    authenticatedBackendJsonMock.mockResolvedValueOnce({}).mockResolvedValueOnce(backendFollowUp);

    const request = new Request(`http://localhost:3000/api/example?teamId=${teamId}`, {
      method: 'POST',

      headers: {
        'idempotency-key': exactKey,
      },
    });

    const response = await POST(request, context);

    expect(authenticatedBackendJsonMock).toHaveBeenNthCalledWith(
      1,
      `/work-queue/${campaignId}/${prospectId}?teamId=${teamId}`,
    );

    expect(authenticatedBackendJsonMock).toHaveBeenNthCalledWith(
      2,
      `/campaigns/${campaignId}` + `/prospects/${prospectId}` + `/follow-ups/${followUpId}/cancel`,
      {
        method: 'POST',

        headers: {
          'idempotency-key': exactKey,
        },
      },
    );

    expect(response.status).toBe(200);
  });

  it('sanitizes cancelled team-owned follow-up response', async () => {
    authenticatedBackendJsonMock.mockResolvedValueOnce({}).mockResolvedValueOnce(backendFollowUp);

    const request = new Request(`http://localhost:3000/api/example?teamId=${teamId}`, {
      method: 'POST',
    });

    const response = await POST(request, context);

    const body = (await response.json()) as Record<string, unknown>;

    expect(body.status).toBe('cancelled');
    expect(body.ownership).toBe('team');

    expect(body).not.toHaveProperty('assignedUserId');
    expect(body).not.toHaveProperty('createdBy');
  });

  it('does not cancel when work queue authentication cannot be restored', async () => {
    authenticatedBackendJsonMock.mockResolvedValueOnce(null);

    const request = new Request(`http://localhost:3000/api/example?teamId=${teamId}`, {
      method: 'POST',
    });

    const response = await POST(request, context);

    expect(authenticatedBackendJsonMock).toHaveBeenCalledTimes(1);

    expect(response.status).toBe(401);
  });

  it('URL-encodes the cancel action route', async () => {
    authenticatedBackendJsonMock.mockResolvedValueOnce({}).mockResolvedValueOnce(backendFollowUp);

    const encodedContext = {
      params: Promise.resolve({
        campaignId: 'campaign id',

        prospectId: 'prospect?id',

        followUpId: 'follow/up id',
      }),
    };

    const request = new Request(`http://localhost:3000/api/example?teamId=${teamId}`, {
      method: 'POST',
    });

    await POST(request, encodedContext);

    expect(authenticatedBackendJsonMock).toHaveBeenNthCalledWith(
      2,
      '/campaigns/campaign%20id' +
        '/prospects/prospect%3Fid' +
        '/follow-ups/follow%2Fup%20id/cancel',
      {
        method: 'POST',

        headers: {},
      },
    );
  });
});
