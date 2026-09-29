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

import { POST as commit } from './route';
import { POST as preview } from './preview/route';

const campaignId = '22222222-2222-4222-8222-222222222222';

const params = Promise.resolve({ campaignId });

function enrolmentRequest(body: object, idempotencyKey?: string): Request {
  return new Request(`https://app.test/api/campaigns/${campaignId}/prospects/bulk`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/campaigns/:campaignId/prospects/bulk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticatedBackendJsonMock.mockResolvedValue({ mode: 'apply', enrolled: 2 });
  });

  it('forwards the selection body unchanged so the API decides what is valid', async () => {
    const selection = { category: 'prospection', department: '974', limit: 10000 };

    const response = await commit(enrolmentRequest(selection), { params });

    expect(response.status).toBe(200);

    const [path, init] = authenticatedBackendJsonMock.mock.calls[0] as [string, RequestInit];

    expect(path).toBe(`/campaigns/${campaignId}/prospects/bulk`);
    expect(init.method).toBe('POST');
    /*
     * Verbatim. Re-encoding the selection here would put a second, weaker copy of
     * the filter semantics in the proxy, which is exactly what the shared filter
     * helper upstream exists to prevent.
     */
    expect(JSON.parse(init.body as string)).toEqual(selection);
  });

  it('forwards the idempotency key, because a retry must not enrol twice', async () => {
    await commit(enrolmentRequest({ category: 'cra' }, 'fixed-key'), { params });

    const [, init] = authenticatedBackendJsonMock.mock.calls[0] as [string, RequestInit];

    expect((init.headers as Record<string, string>)['idempotency-key']).toBe('fixed-key');
  });

  it('routes the preview to the endpoint that writes nothing', async () => {
    authenticatedBackendJsonMock.mockResolvedValue({ mode: 'preview', enrolled: 0 });

    await preview(enrolmentRequest({ category: 'prospection' }), { params });

    expect(authenticatedBackendJsonMock.mock.calls[0]?.[0]).toBe(
      `/campaigns/${campaignId}/prospects/bulk/preview`,
    );
  });

  it('answers 401 rather than an empty body when the session has gone', async () => {
    authenticatedBackendJsonMock.mockResolvedValue(null);
    unauthenticatedResponseMock.mockReturnValue(new Response(null, { status: 401 }));

    const response = await commit(enrolmentRequest({ category: 'cra' }), { params });

    expect(response.status).toBe(401);
  });

  it('hands an upstream failure to the shared error mapper', async () => {
    const failure = new Error('upstream refused');
    authenticatedBackendJsonMock.mockRejectedValue(failure);
    apiErrorResponseMock.mockReturnValue(new Response(null, { status: 400 }));

    const response = await commit(enrolmentRequest({}), { params });

    expect(apiErrorResponseMock).toHaveBeenCalledWith(failure);
    expect(response.status).toBe(400);
  });
});
