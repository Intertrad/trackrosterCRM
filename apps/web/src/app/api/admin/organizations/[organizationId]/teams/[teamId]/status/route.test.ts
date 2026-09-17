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

describe('PATCH team status BFF', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('URL-encodes organization and team ids and forwards only status', async () => {
    authenticatedBackendJsonMock.mockResolvedValue({
      id: 'team-id',
      tenantId: 'internal-tenant',
      organizationId: 'organization-id',
      name: 'Paris Prospecting',
      slug: 'paris-prospecting',
      status: 'inactive',
      createdAt: '2026-09-17T08:00:00.000Z',
      updatedAt: '2026-09-17T09:00:00.000Z',
    });

    const request = new Request('http://localhost/api/example', {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        status: 'inactive',
        tenantId: 'browser-tenant',
        teamId: 'browser-team',
      }),
    });

    const context = {
      params: Promise.resolve({
        organizationId: 'organization/id',
        teamId: 'team?id',
      }),
    };

    const response = await PATCH(request, context);

    const body = await response.json();

    expect(authenticatedBackendJsonMock).toHaveBeenCalledWith(
      '/organizations/organization%2Fid/teams/team%3Fid/status',
      {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'inactive',
        }),
      },
    );

    expect(body).not.toHaveProperty('tenantId');
  });
});
