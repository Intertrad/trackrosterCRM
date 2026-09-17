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

describe('PATCH organization status BFF', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('URL-encodes the organization id and forwards only status', async () => {
    authenticatedBackendJsonMock.mockResolvedValue({
      id: 'organization-id',
      tenantId: 'internal-tenant',
      name: 'France Sales',
      slug: 'france-sales',
      status: 'inactive',
      createdAt: '2026-09-17T08:00:00.000Z',
      updatedAt: '2026-09-17T09:00:00.000Z',
    });

    const request = new Request('http://localhost/api/example', {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': 'must-not-cross',
      },
      body: JSON.stringify({
        status: 'inactive',
        tenantId: 'browser-tenant',
        organizationId: 'browser-organization',
      }),
    });

    const context = {
      params: Promise.resolve({
        organizationId: 'organization/id ?',
      }),
    };

    const response = await PATCH(request, context);

    const body = await response.json();

    expect(authenticatedBackendJsonMock).toHaveBeenCalledWith(
      '/organizations/organization%2Fid%20%3F/status',
      {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'inactive',
        }),
      },
    );

    expect(body.status).toBe('inactive');
    expect(body).not.toHaveProperty('tenantId');
  });
});
