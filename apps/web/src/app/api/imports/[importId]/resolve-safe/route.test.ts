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

const importId = '44444444-4444-4444-8444-444444444444';

describe('POST /api/imports/:importId/resolve-safe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticatedBackendJsonMock.mockResolvedValue({ id: importId, status: 'validated' });
  });

  it('forwards the safe resolution request and write headers', async () => {
    const response = await POST(
      new Request(`https://app.test/api/imports/${importId}/resolve-safe`, {
        method: 'POST',
        headers: { 'if-match': 'etag-1', 'idempotency-key': 'safe-1' },
        body: '{}',
      }),
      { params: Promise.resolve({ importId }) },
    );

    expect(response.status).toBe(200);
    expect(authenticatedBackendJsonMock.mock.calls[0]?.[0]).toBe(
      `/imports/${importId}/resolve-safe`,
    );
    expect(authenticatedBackendJsonMock.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      body: '{}',
    });
  });
});
