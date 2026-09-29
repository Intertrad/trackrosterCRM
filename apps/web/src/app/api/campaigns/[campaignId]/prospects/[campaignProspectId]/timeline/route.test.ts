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

const campaignId = '11111111-1111-4111-8111-111111111111';
const campaignProspectId = '22222222-2222-4222-8222-222222222222';

const base = `https://app.test/api/campaigns/${campaignId}/prospects/${campaignProspectId}/timeline`;

function context(ids: { campaignId?: string; campaignProspectId?: string } = {}) {
  return {
    params: Promise.resolve({
      campaignId: ids.campaignId ?? campaignId,
      campaignProspectId: ids.campaignProspectId ?? campaignProspectId,
    }),
  };
}

/*
 * This proxy exists beside the work-queue one because that route pre-authorizes
 * with a teamId to keep a prospector inside their own assignment — a boundary an
 * administrator cannot satisfy. Neither route decides access: the API authorizes
 * through canViewTeam / canViewOrganization and masks a forbidden prospect as 404,
 * and both behaviours must survive the hop.
 */
describe('GET /api/campaigns/:campaignId/prospects/:campaignProspectId/timeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticatedBackendJsonMock.mockResolvedValue({ items: [], nextCursor: null });
  });

  it('forwards both ids and the pagination the API accepts', async () => {
    const response = await GET(new Request(`${base}?limit=20&cursor=abc`), context());

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(authenticatedBackendJsonMock).toHaveBeenCalledWith(
      `/campaigns/${campaignId}/prospects/${campaignProspectId}/timeline?limit=20&cursor=abc`,
    );
  });

  it('drops a parameter the API does not accept', async () => {
    await GET(new Request(`${base}?limit=20&teamId=sneaky&organizationId=other`), context());

    const forwarded = String(authenticatedBackendJsonMock.mock.calls[0]?.[0]);

    /* Scope comes from the session and the API's own checks, never the query. */
    expect(forwarded).toContain('limit=20');
    expect(forwarded).not.toContain('teamId');
    expect(forwarded).not.toContain('organizationId');
  });

  it('asks for the bare timeline when no pagination is given', async () => {
    await GET(new Request(base), context());

    expect(authenticatedBackendJsonMock).toHaveBeenCalledWith(
      `/campaigns/${campaignId}/prospects/${campaignProspectId}/timeline`,
    );
  });

  it('encodes both ids rather than interpolating them', async () => {
    await GET(new Request(base), context({ campaignId: 'a b', campaignProspectId: '../secrets' }));

    expect(authenticatedBackendJsonMock).toHaveBeenCalledWith(
      '/campaigns/a%20b/prospects/..%2Fsecrets/timeline',
    );
  });

  it('answers 401 rather than an empty timeline when the session has gone', async () => {
    authenticatedBackendJsonMock.mockResolvedValue(null);
    unauthenticatedResponseMock.mockReturnValue(new Response(null, { status: 401 }));

    expect((await GET(new Request(base), context())).status).toBe(401);
  });

  it.each([403, 404, 500])('passes %i through to the shared error mapper', async (status) => {
    const failure = Object.assign(new Error('upstream'), { statusCode: status });
    authenticatedBackendJsonMock.mockRejectedValue(failure);
    apiErrorResponseMock.mockReturnValue(new Response(null, { status }));

    /*
     * A campaign the caller cannot see answers 404 upstream, so changing the id in
     * the URL discloses nothing — the refusal is not translated here.
     */
    const response = await GET(new Request(base), context());

    expect(apiErrorResponseMock).toHaveBeenCalledWith(failure);
    expect(response.status).toBe(status);
  });
});
