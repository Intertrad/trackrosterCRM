import { beforeEach, describe, expect, it, vi } from 'vitest';

const { backendJsonMock, apiErrorResponseMock } = vi.hoisted(() => ({
  backendJsonMock: vi.fn(),
  apiErrorResponseMock: vi.fn(),
}));

vi.mock('@/lib/server/backend-json', () => ({ backendJson: backendJsonMock }));
vi.mock('@/lib/server/api-error-response', () => ({ apiErrorResponse: apiErrorResponseMock }));

import { POST } from './route';

describe('POST /api/invitations/:token/accept', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    backendJsonMock.mockResolvedValue({ membershipId: 'membership-1' });
  });

  it('forwards the token and acceptance payload to the backend', async () => {
    const response = await POST(
      new Request('https://app.test/api/invitations/token-123/accept', {
        method: 'POST',
        body: JSON.stringify({ password: 'StrongPassword123!' }),
      }),
      { params: Promise.resolve({ token: 'token-123' }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ membershipId: 'membership-1' });
    expect(backendJsonMock).toHaveBeenCalledWith('/invitations/token-123/accept', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'StrongPassword123!' }),
    });
  });
});
