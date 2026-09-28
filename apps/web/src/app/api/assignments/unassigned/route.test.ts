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
 * This route forwards an allowlist, so a filter it does not name is dropped in
 * silence: the page answers 200 with unfiltered rows and the filter looks
 * broken rather than unsupported. The test therefore asserts on what reaches
 * the API, which is the only place that failure is visible.
 */
describe('GET /api/assignments/unassigned', () => {
  const campaignId = '22222222-2222-4222-8222-222222222222';

  const teamId = '11111111-1111-4111-8111-111111111111';

  beforeEach(() => {
    vi.clearAllMocks();
    authenticatedBackendJsonMock.mockResolvedValue({ items: [], nextCursor: null });
  });

  it('forwards every dispatch filter the API accepts', async () => {
    const query = new URLSearchParams({
      campaignId,
      teamId,
      search: 'brigade',
      category: 'prospection',
      department: '974',
      city: 'Lyon',
      lifecycleStage: 'to_contact',
      contactable: 'true',
      availability: 'uncontested',
      limit: '100',
    });

    const response = await GET(
      new Request(`https://app.test/api/assignments/unassigned?${query.toString()}`),
    );

    expect(response.status).toBe(200);

    const forwarded = new URL(
      `https://api.test${String(authenticatedBackendJsonMock.mock.calls[0]?.[0])}`,
    );

    for (const [key, value] of query) {
      expect(forwarded.searchParams.get(key), `${key} should reach the API`).toBe(value);
    }
  });

  it('drops a parameter the API does not accept rather than passing it through', async () => {
    await GET(
      new Request(
        `https://app.test/api/assignments/unassigned?campaignId=${campaignId}&sort=name&tenantId=other`,
      ),
    );

    const forwarded = String(authenticatedBackendJsonMock.mock.calls[0]?.[0]);

    expect(forwarded).toContain(`campaignId=${campaignId}`);
    expect(forwarded).not.toContain('sort=');
    expect(forwarded).not.toContain('tenantId=');
  });

  it('answers 400 without calling the API when no campaign is given', async () => {
    const response = await GET(new Request('https://app.test/api/assignments/unassigned'));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'CAMPAIGN_REQUIRED' });
    expect(authenticatedBackendJsonMock).not.toHaveBeenCalled();
  });
});
