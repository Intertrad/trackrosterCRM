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

import { GET, POST } from './route';

describe('prospect follow-up BFF', () => {
  const campaignId = '11111111-1111-4111-8111-111111111111';

  const prospectId = '22222222-2222-4222-8222-222222222222';

  const teamId = '33333333-3333-4333-8333-333333333333';

  const followUpId = '44444444-4444-4444-8444-444444444444';

  const establishmentId = '55555555-5555-4555-8555-555555555555';

  const idempotencyKey = 'follow-up-create-exact-key';

  const detailPath = `/work-queue/${campaignId}/${prospectId}` + `?teamId=${teamId}`;

  const followUpPath = `/campaigns/${campaignId}` + `/prospects/${prospectId}` + '/follow-ups';

  const context = {
    params: Promise.resolve({
      campaignId,

      prospectId,
    }),
  };

  const backendFollowUp = {
    id: followUpId,

    campaignId,

    campaignProspectId: prospectId,

    establishmentId,

    assignedUserId: 'internal-user',

    createdBy: 'internal-creator',

    dueAt: '2026-09-20T10:00:00.000Z',

    status: 'pending' as const,

    completedAt: null,

    cancelledAt: null,

    createdAt: '2026-09-16T10:00:00.000Z',

    updatedAt: '2026-09-16T10:00:00.000Z',
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
          message: 'Follow-up conflict',
          error: 'Conflict',
        },
        {
          status: 409,
        },
      ),
    );
  });

  it('checks the personal work queue before listing prospect follow-ups', async () => {
    authenticatedBackendJsonMock.mockResolvedValueOnce({}).mockResolvedValueOnce({
      items: [backendFollowUp],
    });

    const request = new Request(
      'http://localhost:3000' +
        `/api/work-queue/${campaignId}/${prospectId}/follow-ups` +
        `?teamId=${teamId}`,
    );

    const response = await GET(request, context);

    expect(authenticatedBackendJsonMock).toHaveBeenNthCalledWith(1, detailPath);

    expect(authenticatedBackendJsonMock).toHaveBeenNthCalledWith(2, followUpPath);

    expect(response.status).toBe(200);
  });

  it('sanitizes prospect follow-up history', async () => {
    authenticatedBackendJsonMock.mockResolvedValueOnce({}).mockResolvedValueOnce({
      items: [backendFollowUp],
    });

    const request = new Request(
      `http://localhost:3000/api/work-queue/x/y/follow-ups?teamId=${teamId}`,
    );

    const response = await GET(request, context);

    const body = (await response.json()) as {
      items: Array<Record<string, unknown>>;
    };

    expect(body.items[0]).toEqual({
      id: followUpId,

      campaignId,

      prospectId,

      establishmentId,

      dueAt: backendFollowUp.dueAt,

      status: 'pending',

      ownership: 'user',

      completedAt: null,

      cancelledAt: null,

      createdAt: backendFollowUp.createdAt,

      updatedAt: backendFollowUp.updatedAt,
    });

    expect(body.items[0]).not.toHaveProperty('assignedUserId');
    expect(body.items[0]).not.toHaveProperty('createdBy');
  });

  it('creates a caller-owned follow-up without forwarding arbitrary identity fields', async () => {
    authenticatedBackendJsonMock.mockResolvedValueOnce({}).mockResolvedValueOnce(backendFollowUp);

    const request = new Request(
      `http://localhost:3000/api/work-queue/x/y/follow-ups?teamId=${teamId}`,
      {
        method: 'POST',

        headers: {
          'content-type': 'application/json',

          'idempotency-key': idempotencyKey,
        },

        body: JSON.stringify({
          dueAt: backendFollowUp.dueAt,

          ownership: 'user',

          assignedUserId: 'browser-user',

          userId: 'browser-user',

          tenantId: 'browser-tenant',

          assignmentId: 'browser-assignment',
        }),
      },
    );

    const response = await POST(request, context);

    expect(authenticatedBackendJsonMock).toHaveBeenNthCalledWith(2, followUpPath, {
      method: 'POST',

      headers: {
        'idempotency-key': idempotencyKey,
      },

      body: JSON.stringify({
        dueAt: backendFollowUp.dueAt,
      }),
    });

    expect(response.status).toBe(201);
  });

  it('maps team ownership to assignedUserId null', async () => {
    authenticatedBackendJsonMock.mockResolvedValueOnce({}).mockResolvedValueOnce({
      ...backendFollowUp,

      assignedUserId: null,
    });

    const request = new Request(
      `http://localhost:3000/api/work-queue/x/y/follow-ups?teamId=${teamId}`,
      {
        method: 'POST',

        headers: {
          'content-type': 'application/json',

          'idempotency-key': idempotencyKey,
        },

        body: JSON.stringify({
          dueAt: backendFollowUp.dueAt,

          ownership: 'team',
        }),
      },
    );

    const response = await POST(request, context);

    expect(authenticatedBackendJsonMock).toHaveBeenNthCalledWith(2, followUpPath, {
      method: 'POST',

      headers: {
        'idempotency-key': idempotencyKey,
      },

      body: JSON.stringify({
        dueAt: backendFollowUp.dueAt,

        assignedUserId: null,
      }),
    });

    const body = (await response.json()) as Record<string, unknown>;

    expect(body.ownership).toBe('team');
  });

  it('rejects invalid browser ownership before calling the follow-up mutation', async () => {
    authenticatedBackendJsonMock.mockResolvedValueOnce({});

    const request = new Request(
      `http://localhost:3000/api/work-queue/x/y/follow-ups?teamId=${teamId}`,
      {
        method: 'POST',

        headers: {
          'content-type': 'application/json',

          'idempotency-key': idempotencyKey,
        },

        body: JSON.stringify({
          dueAt: backendFollowUp.dueAt,

          ownership: 'another-user',
        }),
      },
    );

    const response = await POST(request, context);

    expect(authenticatedBackendJsonMock).toHaveBeenCalledTimes(1);

    expect(response.status).toBe(400);
  });

  it('forwards the exact idempotency key unchanged', async () => {
    const exactKey = 'Case-Sensitive_FollowUp-Key-ABC';

    authenticatedBackendJsonMock.mockResolvedValueOnce({}).mockResolvedValueOnce(backendFollowUp);

    const request = new Request(
      `http://localhost:3000/api/work-queue/x/y/follow-ups?teamId=${teamId}`,
      {
        method: 'POST',

        headers: {
          'content-type': 'application/json',

          'Idempotency-Key': exactKey,
        },

        body: JSON.stringify({
          dueAt: backendFollowUp.dueAt,
        }),
      },
    );

    await POST(request, context);

    expect(authenticatedBackendJsonMock).toHaveBeenNthCalledWith(
      2,
      followUpPath,
      expect.objectContaining({
        headers: {
          'idempotency-key': exactKey,
        },
      }),
    );
  });

  it('does not invent an idempotency key when omitted', async () => {
    authenticatedBackendJsonMock.mockResolvedValueOnce({}).mockResolvedValueOnce(backendFollowUp);

    const request = new Request(
      `http://localhost:3000/api/work-queue/x/y/follow-ups?teamId=${teamId}`,
      {
        method: 'POST',

        headers: {
          'content-type': 'application/json',
        },

        body: JSON.stringify({
          dueAt: backendFollowUp.dueAt,
        }),
      },
    );

    await POST(request, context);

    expect(authenticatedBackendJsonMock).toHaveBeenNthCalledWith(
      2,
      followUpPath,
      expect.objectContaining({
        headers: {},
      }),
    );
  });

  it('does not mutate when personal work queue authentication cannot be restored', async () => {
    authenticatedBackendJsonMock.mockResolvedValueOnce(null);

    const request = new Request(
      `http://localhost:3000/api/work-queue/x/y/follow-ups?teamId=${teamId}`,
      {
        method: 'POST',
      },
    );

    const response = await POST(request, context);

    expect(authenticatedBackendJsonMock).toHaveBeenCalledTimes(1);

    expect(unauthenticatedResponseMock).toHaveBeenCalledTimes(1);

    expect(response.status).toBe(401);
  });

  it('URL-encodes campaign and prospect route segments', async () => {
    authenticatedBackendJsonMock.mockResolvedValueOnce({}).mockResolvedValueOnce({
      items: [],
    });

    const encodedContext = {
      params: Promise.resolve({
        campaignId: 'campaign id',

        prospectId: 'prospect?id',
      }),
    };

    const request = new Request(
      `http://localhost:3000/api/work-queue/x/y/follow-ups?teamId=${teamId}`,
    );

    await GET(request, encodedContext);

    expect(authenticatedBackendJsonMock).toHaveBeenNthCalledWith(
      1,
      `/work-queue/campaign%20id/prospect%3Fid?teamId=${teamId}`,
    );

    expect(authenticatedBackendJsonMock).toHaveBeenNthCalledWith(
      2,
      '/campaigns/campaign%20id/prospects/prospect%3Fid/follow-ups',
    );
  });

  it('delegates follow-up backend errors after the work queue check', async () => {
    const backendError = new Error('follow-up failed');

    authenticatedBackendJsonMock.mockResolvedValueOnce({}).mockRejectedValueOnce(backendError);

    const request = new Request(
      `http://localhost:3000/api/work-queue/x/y/follow-ups?teamId=${teamId}`,
    );

    const response = await GET(request, context);

    expect(apiErrorResponseMock).toHaveBeenCalledWith(backendError);

    expect(response.status).toBe(409);
  });
});
