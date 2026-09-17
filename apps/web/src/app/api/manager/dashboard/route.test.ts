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

const backendDashboard = {
  generatedAt: '2026-09-17T08:00:00.000Z',

  range: {
    from: '2026-08-18T08:00:00.000Z',

    to: '2026-09-17T08:00:00.000Z',
  },

  scope: {
    authority: 'manager' as const,

    organizationId: '11111111-1111-4111-8111-111111111111',

    teamId: '22222222-2222-4222-8222-222222222222',
  },

  filters: {
    organizationId: null,

    teamId: null,

    userId: null,

    campaignId: null,
  },

  activities: {
    total: 12,

    byType: {
      call: 7,

      email: 5,
    },

    activeProspectors: 3,
  },

  assignments: {
    current: 8,

    individuallyAssigned: 6,

    teamOwned: 2,
  },

  followUps: {
    pending: 5,

    overdue: 2,

    dueInRange: 4,

    completedInRange: 9,

    cancelledInRange: 1,
  },

  byProspector: [
    {
      userId: '33333333-3333-4333-8333-333333333333',

      activities: 6,

      currentAssignments: 4,

      pendingFollowUps: 2,

      overdueFollowUps: 1,
    },
  ],
};

describe('GET /api/manager/dashboard', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    authenticatedBackendJsonMock.mockResolvedValue(backendDashboard);

    unauthenticatedResponseMock.mockReturnValue(
      Response.json(
        {
          statusCode: 401,
          message: 'Unauthorized',
        },
        {
          status: 401,
        },
      ),
    );

    apiErrorResponseMock.mockReturnValue(
      Response.json(
        {
          statusCode: 500,
          message: 'Internal error',
        },
        {
          status: 500,
        },
      ),
    );
  });

  it('requests the backend dashboard without query parameters', async () => {
    const response = await GET(new Request('http://localhost/api/manager/dashboard'));

    expect(authenticatedBackendJsonMock).toHaveBeenCalledTimes(1);

    expect(authenticatedBackendJsonMock).toHaveBeenCalledWith('/manager/dashboard');

    expect(response.status).toBe(200);
  });

  it('forwards only supported dashboard query parameters', async () => {
    const request = new Request(
      [
        'http://localhost/api/manager/dashboard',
        '?from=2026-09-01T00%3A00%3A00.000Z',
        '&to=2026-09-17T00%3A00%3A00.000Z',
        '&organizationId=11111111-1111-4111-8111-111111111111',
        '&teamId=22222222-2222-4222-8222-222222222222',
        '&userId=33333333-3333-4333-8333-333333333333',
        '&campaignId=44444444-4444-4444-8444-444444444444',
        '&tenantId=should-not-cross',
        '&role=client_admin',
        '&unexpected=value',
      ].join(''),
    );

    await GET(request);

    expect(authenticatedBackendJsonMock).toHaveBeenCalledWith(
      [
        '/manager/dashboard',
        '?from=2026-09-01T00%3A00%3A00.000Z',
        '&to=2026-09-17T00%3A00%3A00.000Z',
        '&organizationId=11111111-1111-4111-8111-111111111111',
        '&teamId=22222222-2222-4222-8222-222222222222',
        '&userId=33333333-3333-4333-8333-333333333333',
        '&campaignId=44444444-4444-4444-8444-444444444444',
      ].join(''),
    );
  });

  it('does not let browser authority fields cross the BFF boundary', async () => {
    await GET(
      new Request(
        [
          'http://localhost/api/manager/dashboard',
          '?tenantId=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          '&authenticatedUserId=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          '&authority=client_admin',
          '&scopeType=tenant',
        ].join(''),
      ),
    );

    expect(authenticatedBackendJsonMock).toHaveBeenCalledWith('/manager/dashboard');
  });

  it('returns the sanitized browser dashboard response', async () => {
    authenticatedBackendJsonMock.mockResolvedValue({
      ...backendDashboard,

      internalTenantId: 'should-not-leak',

      secretField: 'should-not-leak',

      scope: {
        ...backendDashboard.scope,

        internalGrantId: 'should-not-leak',
      },

      byProspector: [
        {
          ...backendDashboard.byProspector[0],

          email: 'should-not-leak@example.com',

          passwordHash: 'should-not-leak',
        },
      ],
    });

    const response = await GET(new Request('http://localhost/api/manager/dashboard'));

    const body = await response.json();

    expect(body).toEqual(backendDashboard);

    expect(body).not.toHaveProperty('internalTenantId');

    expect(body).not.toHaveProperty('secretField');

    expect(body.scope).not.toHaveProperty('internalGrantId');

    expect(body.byProspector[0]).not.toHaveProperty('email');

    expect(body.byProspector[0]).not.toHaveProperty('passwordHash');
  });

  it('preserves dynamic activity types without hard-coding them', async () => {
    authenticatedBackendJsonMock.mockResolvedValue({
      ...backendDashboard,

      activities: {
        ...backendDashboard.activities,

        byType: {
          call: 4,

          email: 3,

          linkedin_message: 2,

          custom_activity: 1,
        },
      },
    });

    const response = await GET(new Request('http://localhost/api/manager/dashboard'));

    const body = await response.json();

    expect(body.activities.byType).toEqual({
      call: 4,

      email: 3,

      linkedin_message: 2,

      custom_activity: 1,
    });
  });

  it('returns the standard unauthenticated response when no authenticated backend result exists', async () => {
    authenticatedBackendJsonMock.mockResolvedValue(null);

    const expectedResponse = Response.json(
      {
        statusCode: 401,

        message: 'Session expired',
      },
      {
        status: 401,
      },
    );

    unauthenticatedResponseMock.mockReturnValue(expectedResponse);

    const response = await GET(new Request('http://localhost/api/manager/dashboard'));

    expect(unauthenticatedResponseMock).toHaveBeenCalledTimes(1);

    expect(response).toBe(expectedResponse);
  });

  it('delegates backend failures to the standard API error response helper', async () => {
    const backendError = new Error('Reporting unavailable');

    authenticatedBackendJsonMock.mockRejectedValue(backendError);

    const expectedResponse = Response.json(
      {
        statusCode: 503,

        message: 'Reporting unavailable',
      },
      {
        status: 503,
      },
    );

    apiErrorResponseMock.mockReturnValue(expectedResponse);

    const response = await GET(new Request('http://localhost/api/manager/dashboard'));

    expect(apiErrorResponseMock).toHaveBeenCalledTimes(1);

    expect(apiErrorResponseMock).toHaveBeenCalledWith(backendError);

    expect(response).toBe(expectedResponse);
  });
});
