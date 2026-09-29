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

describe('follow-up queue BFF', () => {
  const teamId = '11111111-1111-4111-8111-111111111111';

  const campaignId = '22222222-2222-4222-8222-222222222222';

  const prospectId = '33333333-3333-4333-8333-333333333333';

  const establishmentId = '44444444-4444-4444-8444-444444444444';

  const followUpId = '55555555-5555-4555-8555-555555555555';

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
          statusCode: 503,

          code: 'SERVICE_UNAVAILABLE',

          message: 'Follow-up service is unavailable',

          error: 'Service Unavailable',
        },
        {
          status: 503,
        },
      ),
    );
  });

  it('forwards only supported queue query parameters', async () => {
    authenticatedBackendJsonMock.mockResolvedValue({
      items: [],
    });

    const request = new Request(
      'http://localhost:3000/api/follow-ups' +
        `?teamId=${teamId}` +
        '&overdue=true' +
        '&limit=25' +
        '&tenantId=browser-tenant' +
        '&userId=browser-user' +
        '&role=client_admin',
    );

    const response = await GET(request);

    expect(authenticatedBackendJsonMock).toHaveBeenCalledWith(
      `/follow-ups?teamId=${teamId}&overdue=true&limit=25`,
    );

    expect(response.status).toBe(200);
  });

  it('does not invent optional queue filters', async () => {
    authenticatedBackendJsonMock.mockResolvedValue({
      items: [],
    });

    const request = new Request(`http://localhost:3000/api/follow-ups?teamId=${teamId}`);

    await GET(request);

    expect(authenticatedBackendJsonMock).toHaveBeenCalledWith(`/follow-ups?teamId=${teamId}`);
  });

  it('sanitizes queue ownership and preserves display context', async () => {
    authenticatedBackendJsonMock.mockResolvedValue({
      items: [
        {
          id: followUpId,

          campaignId,

          campaignProspectId: prospectId,

          establishmentId,

          assignedUserId: 'internal-user',

          createdBy: 'internal-creator',

          dueAt: '2026-09-20T10:00:00.000Z',

          status: 'pending',

          completedAt: null,

          cancelledAt: null,

          createdAt: '2026-09-16T10:00:00.000Z',

          updatedAt: '2026-09-16T10:00:00.000Z',

          campaignName: 'Paris Expansion',

          establishmentName: 'Paris Clinic',
        },
        {
          id: '66666666-6666-4666-8666-666666666666',

          campaignId,

          campaignProspectId: prospectId,

          establishmentId,

          assignedUserId: null,

          createdBy: 'internal-creator',

          dueAt: '2026-09-21T10:00:00.000Z',

          status: 'pending',

          completedAt: null,

          cancelledAt: null,

          createdAt: '2026-09-16T10:00:00.000Z',

          updatedAt: '2026-09-16T10:00:00.000Z',

          campaignName: 'Paris Expansion',

          establishmentName: 'Paris Clinic',
        },
      ],
    });

    const request = new Request(`http://localhost:3000/api/follow-ups?teamId=${teamId}`);

    const response = await GET(request);

    const body = (await response.json()) as {
      items: Array<Record<string, unknown>>;
    };

    expect(body.items[0]).toEqual({
      id: followUpId,

      campaignId,

      prospectId,

      establishmentId,

      dueAt: '2026-09-20T10:00:00.000Z',

      status: 'pending',

      ownership: 'user',

      completedAt: null,

      cancelledAt: null,

      createdAt: '2026-09-16T10:00:00.000Z',

      updatedAt: '2026-09-16T10:00:00.000Z',

      campaignName: 'Paris Expansion',

      establishmentName: 'Paris Clinic',
    });

    expect(body.items[1]?.ownership).toBe('team');

    expect(body.items[0]).not.toHaveProperty('assignedUserId');
    expect(body.items[0]).not.toHaveProperty('createdBy');
    expect(body.items[0]).not.toHaveProperty('tenantId');
    expect(body.items[0]).not.toHaveProperty('assignmentId');
  });

  it('returns unauthenticated response when the session cannot be restored', async () => {
    authenticatedBackendJsonMock.mockResolvedValue(null);

    const request = new Request(`http://localhost:3000/api/follow-ups?teamId=${teamId}`);

    const response = await GET(request);

    expect(unauthenticatedResponseMock).toHaveBeenCalledTimes(1);

    expect(response.status).toBe(401);
  });

  it('delegates backend queue errors', async () => {
    const backendError = new Error('follow-up queue unavailable');

    authenticatedBackendJsonMock.mockRejectedValue(backendError);

    const request = new Request(`http://localhost:3000/api/follow-ups?teamId=${teamId}`);

    const response = await GET(request);

    expect(apiErrorResponseMock).toHaveBeenCalledWith(backendError);

    expect(response.status).toBe(503);
  });
});
