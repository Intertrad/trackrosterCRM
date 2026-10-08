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

describe('GET /api/actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticatedBackendJsonMock.mockResolvedValue({ items: [], nextCursor: null });
  });

  it('forwards activity filters to the backend', async () => {
    const query = new URLSearchParams({
      channel: 'call',
      outcomeCode: 'contacted',
      periodDays: '7',
      status: 'completed',
      limit: '100',
    });

    const response = await GET(new Request(`https://app.test/api/actions?${query.toString()}`));

    expect(response.status).toBe(200);
    const forwarded = new URL(
      `https://api.test${String(authenticatedBackendJsonMock.mock.calls[0]?.[0])}`,
    );

    for (const [key, value] of query) {
      expect(forwarded.searchParams.get(key), `${key} should reach the API`).toBe(value);
    }
  });

  it('does not forward tenant-owned or unsupported query parameters', async () => {
    await GET(new Request('https://app.test/api/actions?tenantId=other&offset=500'));

    const forwarded = String(authenticatedBackendJsonMock.mock.calls[0]?.[0]);
    expect(forwarded).not.toContain('tenantId');
    expect(forwarded).not.toContain('offset');
  });
});
