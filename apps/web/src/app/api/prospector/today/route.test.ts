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

import { GET } from './route';

describe('GET /api/prospector/today', () => {
  const teamId = '11111111-1111-4111-8111-111111111111';

  const backendResponse = {
    generatedAt: '2026-09-20T10:00:00.000Z',
    day: {
      date: '2026-09-20',
      timeZone: 'Europe/Paris',
      startsAt: '2026-09-19T22:00:00.000Z',
      endsAt: '2026-09-20T22:00:00.000Z',
      internalBoundary: 'remove-me',
    },
    summary: {
      actionsLeft: 1,
      toDo: 0,
      followUps: 0,
      meetings: 0,
      overdue: 1,
      internalTotal: 99,
    },
    completed: [],
    priorities: [
      {
        id: '22222222-2222-4222-8222-222222222222',
        campaignId: '33333333-3333-4333-8333-333333333333',
        campaignProspectId: '44444444-4444-4444-8444-444444444444',
        dueAt: '2026-09-20T09:00:00.000Z',
        isOverdue: true,
        category: 'follow_up',
        channel: 'call',
        assignedUserId: 'internal-user',
        tenantId: 'internal-tenant',
        establishment: {
          id: '55555555-5555-4555-8555-555555555555',
          name: 'Nancy central police station',
          city: 'Nancy',
          privateNote: 'remove-me',
        },
      },
    ],
    internalScope: 'remove-me',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    authenticatedBackendJsonMock.mockResolvedValue(backendResponse);

    unauthenticatedResponseMock.mockReturnValue(
      Response.json(
        {
          statusCode: 401,
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          error: 'Unauthorized',
        },
        { status: 401 },
      ),
    );

    apiErrorResponseMock.mockReturnValue(
      Response.json(
        {
          statusCode: 503,
          code: 'SERVICE_UNAVAILABLE',
          message: 'Prospector today view is unavailable',
          error: 'Service Unavailable',
        },
        { status: 503 },
      ),
    );
  });

  it('forwards only the selected team and timezone', async () => {
    const request = new Request(
      'http://localhost:3000/api/prospector/today' +
        `?teamId=${teamId}` +
        '&timeZone=Europe%2FParis' +
        '&tenantId=malicious-tenant' +
        '&userId=malicious-user' +
        '&role=client_admin' +
        '&unexpected=value',
    );

    const response = await GET(request);

    expect(authenticatedBackendJsonMock).toHaveBeenCalledWith(
      `/prospector/today?teamId=${teamId}&timeZone=Europe%2FParis`,
    );
    expect(response.status).toBe(200);
  });

  it('lets Nest validate missing required query fields', async () => {
    await GET(new Request('http://localhost:3000/api/prospector/today?userId=malicious'));

    expect(authenticatedBackendJsonMock).toHaveBeenCalledWith('/prospector/today');
  });

  it('reconstructs the public response without internal fields', async () => {
    const response = await GET(
      new Request(`http://localhost:3000/api/prospector/today?teamId=${teamId}&timeZone=UTC`),
    );

    const body = (await response.json()) as Record<string, unknown>;
    const priorities = body.priorities as Array<Record<string, unknown>>;
    const day = body.day as Record<string, unknown>;
    const summary = body.summary as Record<string, unknown>;
    const establishment = priorities[0]?.establishment as Record<string, unknown>;

    expect(body).not.toHaveProperty('internalScope');
    expect(day).not.toHaveProperty('internalBoundary');
    expect(summary).not.toHaveProperty('internalTotal');
    expect(priorities[0]).not.toHaveProperty('tenantId');
    expect(priorities[0]).not.toHaveProperty('assignedUserId');
    expect(establishment).not.toHaveProperty('privateNote');

    expect(priorities[0]).toMatchObject({
      id: backendResponse.priorities[0]?.id,
      category: 'follow_up',
      channel: 'call',
      establishment: {
        name: 'Nancy central police station',
        city: 'Nancy',
      },
    });
  });

  it('returns the standard unauthenticated response when session restoration fails', async () => {
    authenticatedBackendJsonMock.mockResolvedValue(null);

    const response = await GET(
      new Request(`http://localhost:3000/api/prospector/today?teamId=${teamId}&timeZone=UTC`),
    );

    expect(unauthenticatedResponseMock).toHaveBeenCalledTimes(1);
    expect(apiErrorResponseMock).not.toHaveBeenCalled();
    expect(response.status).toBe(401);
  });

  it('delegates backend errors to the shared API error response', async () => {
    const backendError = new Error('today unavailable');

    authenticatedBackendJsonMock.mockRejectedValue(backendError);

    const response = await GET(
      new Request(`http://localhost:3000/api/prospector/today?teamId=${teamId}&timeZone=UTC`),
    );

    expect(apiErrorResponseMock).toHaveBeenCalledWith(backendError);
    expect(unauthenticatedResponseMock).not.toHaveBeenCalled();
    expect(response.status).toBe(503);
  });
});
