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

const prospectId = '44444444-4444-4444-8444-444444444444';

const request = new Request(`https://app.test/api/prospects/${prospectId}/campaign-memberships`);

function context(id = prospectId) {
  return { params: Promise.resolve({ prospectId: id }) };
}

/*
 * The API filters per membership rather than per establishment, and answers 404 for
 * an establishment the caller may not see at all. Both decisions must survive the
 * proxy untouched — reshaping either would move authorisation into a BFF.
 */
describe('GET /api/prospects/:prospectId/campaign-memberships', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticatedBackendJsonMock.mockResolvedValue({ items: [] });
  });

  it('forwards the id and returns the body unchanged', async () => {
    authenticatedBackendJsonMock.mockResolvedValue({
      items: [{ campaignProspectId: 'cp-1', organization: { id: 'o', name: 'OFTI' } }],
    });

    const response = await GET(request, context());

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(authenticatedBackendJsonMock).toHaveBeenCalledWith(
      `/prospects/${prospectId}/campaign-memberships`,
    );
    expect(await response.json()).toEqual({
      items: [{ campaignProspectId: 'cp-1', organization: { id: 'o', name: 'OFTI' } }],
    });
  });

  it('passes an empty list through as a success', async () => {
    const response = await GET(request, context());

    /* Not enrolled anywhere is a normal state, not a missing record. */
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [] });
  });

  it('encodes the id rather than interpolating it', async () => {
    await GET(request, context('a b/../secrets'));

    expect(authenticatedBackendJsonMock).toHaveBeenCalledWith(
      '/prospects/a%20b%2F..%2Fsecrets/campaign-memberships',
    );
  });

  it('answers 401 rather than an empty list when the session has gone', async () => {
    authenticatedBackendJsonMock.mockResolvedValue(null);
    unauthenticatedResponseMock.mockReturnValue(new Response(null, { status: 401 }));

    expect((await GET(request, context())).status).toBe(401);
  });

  it.each([403, 404, 500])('passes %i through to the shared error mapper', async (status) => {
    const failure = Object.assign(new Error('upstream'), { statusCode: status });
    authenticatedBackendJsonMock.mockRejectedValue(failure);
    apiErrorResponseMock.mockReturnValue(new Response(null, { status }));

    const response = await GET(request, context());

    expect(apiErrorResponseMock).toHaveBeenCalledWith(failure);
    expect(response.status).toBe(status);
  });
});
