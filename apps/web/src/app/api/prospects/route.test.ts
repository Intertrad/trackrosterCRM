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

/*
 * The référentiel is 14,649 rows, so every filter has to reach the API. This route
 * forwards an allowlist, and a parameter missing from it is dropped in silence:
 * the page answers 200 with unfiltered rows and the filter merely looks broken.
 * Asserting on what reaches the API is the only place that failure is visible.
 */
describe('GET /api/prospects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticatedBackendJsonMock.mockResolvedValue({ items: [], nextCursor: null });
  });

  it('forwards every filter, page and ordering parameter the API accepts', async () => {
    const query = new URLSearchParams({
      search: 'brigade',
      category: 'prospection',
      department: '974',
      city: 'Lyon',
      regionId: '11111111-1111-4111-8111-111111111111',
      campaignId: '22222222-2222-4222-8222-222222222222',
      status: 'all',
      sort: 'createdAt',
      direction: 'desc',
      cursor: '33333333-3333-4333-8333-333333333333',
      limit: '50',
    });

    const response = await GET(new Request(`https://app.test/api/prospects?${query.toString()}`));

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');

    const forwarded = new URL(
      `https://api.test${String(authenticatedBackendJsonMock.mock.calls[0]?.[0])}`,
    );

    for (const [key, value] of query) {
      expect(forwarded.searchParams.get(key), `${key} should reach the API`).toBe(value);
    }
  });

  it('drops a parameter the API does not accept rather than passing it through', async () => {
    await GET(new Request('https://app.test/api/prospects?search=x&tenantId=other&offset=500'));

    const forwarded = String(authenticatedBackendJsonMock.mock.calls[0]?.[0]);

    expect(forwarded).toContain('search=x');
    /* Tenant comes from the session, and the API pages by cursor, not offset. */
    expect(forwarded).not.toContain('tenantId');
    expect(forwarded).not.toContain('offset');
  });

  it('asks for the bare listing when no filter is given', async () => {
    await GET(new Request('https://app.test/api/prospects'));

    expect(authenticatedBackendJsonMock.mock.calls[0]?.[0]).toBe('/prospects');
  });

  it('answers 401 rather than an empty page when the session has gone', async () => {
    authenticatedBackendJsonMock.mockResolvedValue(null);
    unauthenticatedResponseMock.mockReturnValue(new Response(null, { status: 401 }));

    const response = await GET(new Request('https://app.test/api/prospects'));

    expect(response.status).toBe(401);
  });

  it('hands an upstream failure to the shared error mapper', async () => {
    const failure = new Error('upstream refused');
    authenticatedBackendJsonMock.mockRejectedValue(failure);
    apiErrorResponseMock.mockReturnValue(new Response(null, { status: 400 }));

    const response = await GET(new Request('https://app.test/api/prospects?department=97'));

    expect(apiErrorResponseMock).toHaveBeenCalledWith(failure);
    expect(response.status).toBe(400);
  });
});
