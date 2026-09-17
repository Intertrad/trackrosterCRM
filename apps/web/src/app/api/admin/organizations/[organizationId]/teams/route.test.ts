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

describe('/api/admin/organizations/:organizationId/teams', () => {
  const backendTeam = {
    id: '22222222-2222-4222-8222-222222222222',
    tenantId: 'internal-tenant',
    organizationId: '11111111-1111-4111-8111-111111111111',
    name: 'Paris Prospecting',
    slug: 'paris-prospecting',
    status: 'active' as const,
    createdAt: '2026-09-17T08:00:00.000Z',
    updatedAt: '2026-09-17T08:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists sanitized teams through the encoded organization route', async () => {
    authenticatedBackendJsonMock.mockResolvedValue([
      {
        ...backendTeam,
        internalSecret: 'hidden',
      },
    ]);

    const context = {
      params: Promise.resolve({
        organizationId: 'organization/id',
      }),
    };

    const response = await GET(new Request('http://localhost/api/example'), context);

    const body = await response.json();

    expect(authenticatedBackendJsonMock).toHaveBeenCalledWith(
      '/organizations/organization%2Fid/teams',
      {
        method: 'GET',
      },
    );

    expect(body[0]).not.toHaveProperty('tenantId');
    expect(body[0]).not.toHaveProperty('internalSecret');
  });

  it('creates a team using only name and slug', async () => {
    authenticatedBackendJsonMock.mockResolvedValue(backendTeam);

    const request = new Request('http://localhost/api/example', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': 'must-not-cross',
      },
      body: JSON.stringify({
        name: 'Paris Prospecting',
        slug: 'paris-prospecting',
        tenantId: 'browser-tenant',
        organizationId: 'browser-organization',
        teamId: 'browser-team',
      }),
    });

    const context = {
      params: Promise.resolve({
        organizationId: backendTeam.organizationId,
      }),
    };

    const response = await POST(request, context);

    expect(authenticatedBackendJsonMock).toHaveBeenCalledWith(
      `/organizations/${backendTeam.organizationId}/teams`,
      {
        method: 'POST',
        body: JSON.stringify({
          name: 'Paris Prospecting',
          slug: 'paris-prospecting',
        }),
      },
    );

    expect(response.status).toBe(201);
  });
});
