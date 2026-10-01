import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api/api-error';

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

const notification = {
  id: 'notification-1',
  type: 'import_completed_with_anomalies',
  severity: 'info' as const,
  title: 'Import completed',
  message: 'One record needs review.',
  followUpId: null,
  scheduledFor: null,
  readAt: null,
  createdAt: '2026-10-01T10:00:00.000Z',
};

describe('GET /api/notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticatedBackendJsonMock.mockResolvedValue({ items: [notification], nextCursor: null });
    unauthenticatedResponseMock.mockReturnValue(new Response(null, { status: 401 }));
    apiErrorResponseMock.mockReturnValue(new Response(null, { status: 503 }));
  });

  it('uses the versioned cursor-aware endpoint and forwards supported filters', async () => {
    const response = await GET(
      new Request('https://app.test/api/notifications?readState=unread&limit=25&tenantId=other'),
    );

    expect(response.status).toBe(200);
    expect(authenticatedBackendJsonMock).toHaveBeenCalledWith(
      '/api/v1/notifications?readState=unread&limit=25',
    );
  });

  it('falls back to the neutral endpoint when an older API has no v1 route', async () => {
    authenticatedBackendJsonMock
      .mockRejectedValueOnce(
        new ApiError({
          statusCode: 404,
          code: 'NOT_FOUND',
          message: 'Not found',
          error: 'Not Found',
        }),
      )
      .mockResolvedValueOnce([notification]);

    const response = await GET(new Request('https://app.test/api/notifications'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [notification], nextCursor: null });
    expect(authenticatedBackendJsonMock).toHaveBeenNthCalledWith(1, '/api/v1/notifications');
    expect(authenticatedBackendJsonMock).toHaveBeenNthCalledWith(2, '/notifications');
  });

  it('preserves a missing session as 401', async () => {
    authenticatedBackendJsonMock.mockResolvedValue(null);

    const response = await GET(new Request('https://app.test/api/notifications'));

    expect(response.status).toBe(401);
  });

  it('passes upstream failures to the shared error mapper', async () => {
    const failure = new Error('notification service unavailable');
    authenticatedBackendJsonMock.mockRejectedValue(failure);

    const response = await GET(new Request('https://app.test/api/notifications'));

    expect(apiErrorResponseMock).toHaveBeenCalledWith(failure);
    expect(response.status).toBe(503);
  });
});
