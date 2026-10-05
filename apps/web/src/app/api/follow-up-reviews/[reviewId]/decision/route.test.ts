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

import { POST } from './route';

describe('POST /api/follow-up-reviews/:reviewId/decision', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    unauthenticatedResponseMock.mockReturnValue(new Response(null, { status: 401 }));
    apiErrorResponseMock.mockReturnValue(new Response(null, { status: 502 }));
  });

  it('forwards the manager decision and idempotency key', async () => {
    authenticatedBackendJsonMock.mockResolvedValue({ id: 'review-1', decision: 'approved' });

    const response = await POST(
      new Request('http://localhost/api/follow-up-reviews/review-1/decision', {
        method: 'POST',
        headers: { 'idempotency-key': 'decision-1', 'content-type': 'application/json' },
        body: JSON.stringify({
          decision: 'approved',
          reason: 'The new date was agreed with the prospect.',
        }),
      }),
      { params: Promise.resolve({ reviewId: 'review-1' }) },
    );

    expect(response.status).toBe(200);
    expect(authenticatedBackendJsonMock).toHaveBeenCalledWith(
      '/follow-up-reviews/review-1/decision',
      expect.objectContaining({
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': 'decision-1' },
      }),
    );
  });
});
