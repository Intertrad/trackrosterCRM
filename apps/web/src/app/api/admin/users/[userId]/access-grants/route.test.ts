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

describe('/api/admin/users/:userId/access-grants', () => {
  const backendGrant = {
    id: '44444444-4444-4444-8444-444444444444',
    tenantId: 'internal-tenant',
    userId: '11111111-1111-4111-8111-111111111111',
    role: 'manager' as const,
    scopeType: 'team' as const,
    organizationId: '22222222-2222-4222-8222-222222222222',
    teamId: '33333333-3333-4333-8333-333333333333',
    createdAt: '2026-09-17T08:00:00.000Z',
    updatedAt: '2026-09-17T08:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists sanitized access grants through the encoded user route', async () => {
    authenticatedBackendJsonMock.mockResolvedValue([
      {
        ...backendGrant,
        internalActorId: 'hidden',
      },
    ]);

    const context = {
      params: Promise.resolve({
        userId: 'user/id',
      }),
    };

    const response = await GET(new Request('http://localhost/api/example'), context);

    const body = await response.json();

    expect(authenticatedBackendJsonMock).toHaveBeenCalledWith('/users/user%2Fid/access-grants', {
      method: 'GET',
    });

    expect(body[0]).not.toHaveProperty('tenantId');
    expect(body[0]).not.toHaveProperty('internalActorId');
  });

  it('forwards only allowed access-grant fields', async () => {
    authenticatedBackendJsonMock.mockResolvedValue(backendGrant);

    const request = new Request('http://localhost/api/example', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': 'must-not-cross',
      },
      body: JSON.stringify({
        role: 'manager',
        scopeType: 'team',
        organizationId: backendGrant.organizationId,
        teamId: backendGrant.teamId,
        tenantId: 'browser-tenant',
        actorUserId: 'browser-actor',
        userId: 'browser-target',
        grantId: 'browser-grant',
      }),
    });

    const context = {
      params: Promise.resolve({
        userId: backendGrant.userId,
      }),
    };

    const response = await POST(request, context);

    expect(authenticatedBackendJsonMock).toHaveBeenCalledWith(
      `/users/${backendGrant.userId}/access-grants`,
      {
        method: 'POST',
        body: JSON.stringify({
          role: 'manager',
          scopeType: 'team',
          organizationId: backendGrant.organizationId,
          teamId: backendGrant.teamId,
        }),
      },
    );

    expect(response.status).toBe(201);
  });
});
