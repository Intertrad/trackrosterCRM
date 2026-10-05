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

describe('POST /api/.../reschedule-review', () => {
  const context = {
    params: Promise.resolve({
      campaignId: 'campaign-1',
      campaignProspectId: 'prospect-1',
      followUpId: 'follow-up-1',
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    unauthenticatedResponseMock.mockReturnValue(new Response(null, { status: 401 }));
    apiErrorResponseMock.mockReturnValue(new Response(null, { status: 502 }));
  });

  it('forwards the request body and idempotency key to the API', async () => {
    authenticatedBackendJsonMock.mockResolvedValue({ id: 'review-1' });

    const response = await POST(
      new Request(
        'http://localhost/api/campaigns/campaign-1/prospects/prospect-1/follow-ups/follow-up-1/reschedule-review',
        {
          method: 'POST',
          headers: { 'idempotency-key': 'request-1', 'content-type': 'application/json' },
          body: JSON.stringify({
            dueAt: '2026-10-10T09:30:00.000Z',
            reason: 'The prospect moved the appointment.',
          }),
        },
      ),
      context,
    );

    expect(response.status).toBe(201);
    expect(authenticatedBackendJsonMock).toHaveBeenCalledWith(
      '/campaigns/campaign-1/prospects/prospect-1/follow-ups/follow-up-1/reschedule-review',
      expect.objectContaining({
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': 'request-1' },
        body: JSON.stringify({
          dueAt: '2026-10-10T09:30:00.000Z',
          reason: 'The prospect moved the appointment.',
        }),
      }),
    );
  });

  it('preserves an unauthenticated backend response', async () => {
    authenticatedBackendJsonMock.mockResolvedValue(null);

    const response = await POST(
      new Request('http://localhost/api/review', { method: 'POST', body: '{}' }),
      context,
    );

    expect(response.status).toBe(401);
  });
});
