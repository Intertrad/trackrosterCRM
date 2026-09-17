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

describe('PATCH user status BFF', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('URL-encodes user id and forwards only status', async () => {
    authenticatedBackendJsonMock.mockResolvedValue({
      id: 'user-id',
      tenantId: 'internal-tenant',
      email: 'manager@example.com',
      status: 'suspended',
      createdAt: '2026-09-17T08:00:00.000Z',
      updatedAt: '2026-09-17T09:00:00.000Z',
    });

    const request = new Request('http://localhost/api/example', {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        status: 'suspended',
        tenantId: 'browser-tenant',
        userId: 'browser-user',
      }),
    });

    const context = {
      params: Promise.resolve({
        userId: 'user/id ?',
      }),
    };

    const response = await PATCH(request, context);

    const body = await response.json();

    expect(authenticatedBackendJsonMock).toHaveBeenCalledWith('/users/user%2Fid%20%3F/status', {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'suspended',
      }),
    });

    expect(body).not.toHaveProperty('tenantId');
  });
});
