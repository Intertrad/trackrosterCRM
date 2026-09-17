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

describe('/api/admin/organizations', () => {
  const backendOrganization = {
    id: '11111111-1111-4111-8111-111111111111',
    tenantId: 'internal-tenant',
    name: 'France Sales',
    slug: 'france-sales',
    status: 'active' as const,
    createdAt: '2026-09-17T08:00:00.000Z',
    updatedAt: '2026-09-17T08:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    unauthenticatedResponseMock.mockReturnValue(
      Response.json(
        {
          statusCode: 401,
          message: 'Authentication required',
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
          message: 'Backend failure',
        },
        {
          status: 500,
        },
      ),
    );
  });

  it('lists sanitized organizations without tenant data', async () => {
    authenticatedBackendJsonMock.mockResolvedValue([
      {
        ...backendOrganization,
        internalSecret: 'must-not-leak',
      },
    ]);

    const response = await GET();
    const body = await response.json();

    expect(authenticatedBackendJsonMock).toHaveBeenCalledWith('/organizations', {
      method: 'GET',
    });

    expect(body).toEqual([
      {
        id: backendOrganization.id,
        name: 'France Sales',
        slug: 'france-sales',
        status: 'active',
        createdAt: backendOrganization.createdAt,
        updatedAt: backendOrganization.updatedAt,
      },
    ]);

    expect(body[0]).not.toHaveProperty('tenantId');
    expect(body[0]).not.toHaveProperty('internalSecret');
  });

  it('creates an organization using only allowed browser fields', async () => {
    authenticatedBackendJsonMock.mockResolvedValue(backendOrganization);

    const request = new Request('http://localhost/api/admin/organizations', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': 'browser-key-must-not-be-forwarded',
      },
      body: JSON.stringify({
        name: 'France Sales',
        slug: 'france-sales',
        tenantId: 'browser-tenant',
        userId: 'browser-user',
        role: 'client_admin',
        unexpected: 'value',
      }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(authenticatedBackendJsonMock).toHaveBeenCalledWith('/organizations', {
      method: 'POST',
      body: JSON.stringify({
        name: 'France Sales',
        slug: 'france-sales',
      }),
    });

    expect(response.status).toBe(201);
    expect(body).not.toHaveProperty('tenantId');
  });

  it('returns the standard unauthenticated response', async () => {
    authenticatedBackendJsonMock.mockResolvedValue(null);

    const response = await GET();

    expect(unauthenticatedResponseMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(401);
  });

  it('delegates backend failures to apiErrorResponse', async () => {
    const error = new Error('Backend unavailable');

    authenticatedBackendJsonMock.mockRejectedValue(error);

    const response = await GET();

    expect(apiErrorResponseMock).toHaveBeenCalledWith(error);
    expect(response.status).toBe(500);
  });
});
