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

function context() {
  return { params: Promise.resolve({ importId }) };
}

function multipartRequest(
  url = `https://app.test/api/imports/${importId}/file?sheet=Liste%20consolidee`,
) {
  const form = new FormData();
  form.append('file', new Blob(['name,country_code\nExample,FR']), 'example.csv');
  return new Request(url, { method: 'POST', body: form });
}

describe('POST /api/imports/:importId/file', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authenticatedBackendJsonMock.mockResolvedValue({ id: importId, status: 'uploaded' });
  });

  it('forwards the selected worksheet to the backend', async () => {
    const response = await POST(multipartRequest(), context());

    expect(response.status).toBe(200);
    expect(authenticatedBackendJsonMock.mock.calls[0]?.[0]).toBe(
      `/imports/${importId}/file?sheet=Liste%20consolidee`,
    );
  });

  it('rejects non-multipart requests before calling the backend', async () => {
    const response = await POST(
      new Request(`https://app.test/api/imports/${importId}/file`, {
        method: 'POST',
        body: '{}',
      }),
      context(),
    );

    expect(response.status).toBe(400);
    expect(authenticatedBackendJsonMock).not.toHaveBeenCalled();
  });
});
