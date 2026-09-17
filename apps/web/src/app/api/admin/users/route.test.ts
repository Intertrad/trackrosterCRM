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

describe('/api/admin/users', () => {
  const backendUser = {
    id: '11111111-1111-4111-8111-111111111111',
    tenantId: 'internal-tenant',
    email: 'manager@example.com',
    status: 'active' as const,
    createdAt: '2026-09-17T08:00:00.000Z',
    updatedAt: '2026-09-17T08:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists users without tenant or password data', async () => {
    authenticatedBackendJsonMock.mockResolvedValue([
      {
        ...backendUser,
        passwordHash: 'must-not-leak',
        internalSecret: 'must-not-leak',
      },
    ]);

    const response = await GET();
    const body = await response.json();

    expect(authenticatedBackendJsonMock).toHaveBeenCalledWith('/users', {
      method: 'GET',
    });

    expect(body[0]).not.toHaveProperty('tenantId');
    expect(body[0]).not.toHaveProperty('passwordHash');
    expect(body[0]).not.toHaveProperty('internalSecret');
  });

  it('creates a user using only email and password', async () => {
    authenticatedBackendJsonMock.mockResolvedValue(backendUser);

    const request = new Request('http://localhost/api/admin/users', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'idempotency-key': 'must-not-cross',
      },
      body: JSON.stringify({
        email: 'manager@example.com',
        password: 'very-secure-password',
        tenantId: 'browser-tenant',
        status: 'disabled',
        role: 'client_admin',
      }),
    });

    const response = await POST(request);

    expect(authenticatedBackendJsonMock).toHaveBeenCalledWith('/users', {
      method: 'POST',
      body: JSON.stringify({
        email: 'manager@example.com',
        password: 'very-secure-password',
      }),
    });

    expect(response.status).toBe(201);
  });
});
