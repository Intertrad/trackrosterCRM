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

import { GET } from './route';

describe('GET /api/follow-up-reviews', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    unauthenticatedResponseMock.mockReturnValue(new Response(null, { status: 401 }));
    apiErrorResponseMock.mockReturnValue(new Response(null, { status: 502 }));
  });

  it('loads manager reviews from the authenticated API', async () => {
    authenticatedBackendJsonMock.mockResolvedValue([{ id: 'review-1' }]);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(authenticatedBackendJsonMock).toHaveBeenCalledWith('/follow-up-reviews');
    expect(await response.json()).toEqual([{ id: 'review-1' }]);
  });
});
