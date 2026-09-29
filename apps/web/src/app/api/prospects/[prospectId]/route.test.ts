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

const request = new Request(`https://app.test/api/prospects/${prospectId}`);

function context(id = prospectId) {
  return { params: Promise.resolve({ prospectId: id }) };
}

/*
 * The API decides who may read an establishment and answers 404 rather than 403
 * for anything else, which is it declining to disclose that the record exists.
 * This proxy must carry that through unchanged: turning a refusal into 200 with an
 * empty body would hide an authorisation result behind a working-looking page.
 */
describe('GET /api/prospects/:prospectId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticatedBackendJsonMock.mockResolvedValue({ id: prospectId, name: 'Brigade de Bastia' });
  });

  it('forwards the id to the real detail endpoint and returns the body unchanged', async () => {
    const response = await GET(request, context());

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(authenticatedBackendJsonMock).toHaveBeenCalledWith(`/prospects/${prospectId}`);
    expect(await response.json()).toEqual({ id: prospectId, name: 'Brigade de Bastia' });
  });

  it('encodes the id rather than interpolating it into the path', async () => {
    await GET(request, context('a b/../secrets'));

    expect(authenticatedBackendJsonMock).toHaveBeenCalledWith('/prospects/a%20b%2F..%2Fsecrets');
  });

  it('leaves id validation to the API instead of adding a second rule', async () => {
    /*
     * The API applies ParseUUIDPipe. A browser-side check here would be one more
     * thing to disagree with it, and it would answer a different status.
     */
    await GET(request, context('not-a-uuid'));

    expect(authenticatedBackendJsonMock).toHaveBeenCalledWith('/prospects/not-a-uuid');
  });

  it('answers 401 rather than an empty record when the session has gone', async () => {
    authenticatedBackendJsonMock.mockResolvedValue(null);
    unauthenticatedResponseMock.mockReturnValue(new Response(null, { status: 401 }));

    const response = await GET(request, context());

    expect(response.status).toBe(401);
  });

  it.each([
    [403, 'a refusal'],
    [404, 'a record that is not there or not yours'],
    [500, 'an upstream failure'],
  ])('passes %i through to the shared error mapper for %s', async (status) => {
    const failure = Object.assign(new Error('upstream'), { statusCode: status });
    authenticatedBackendJsonMock.mockRejectedValue(failure);
    apiErrorResponseMock.mockReturnValue(new Response(null, { status }));

    const response = await GET(request, context());

    expect(apiErrorResponseMock).toHaveBeenCalledWith(failure);
    expect(response.status).toBe(status);
  });
});
