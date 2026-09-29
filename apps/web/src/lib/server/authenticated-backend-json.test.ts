import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../api/api-error';
const { backendJsonMock, clearAuthCookiesMock, getAccessTokenMock, refreshAuthSessionMock } =
  vi.hoisted(() => ({
    backendJsonMock: vi.fn(),

    clearAuthCookiesMock: vi.fn(),

    getAccessTokenMock: vi.fn(),

    refreshAuthSessionMock: vi.fn(),
  }));

vi.mock('./auth-cookies', () => ({
  clearAuthCookies: clearAuthCookiesMock,

  getAccessToken: getAccessTokenMock,
}));

vi.mock('./auth-refresh', () => ({
  refreshAuthSession: refreshAuthSessionMock,
}));

vi.mock('./backend-json', () => ({
  backendJson: backendJsonMock,
}));

import { authenticatedBackendJson } from './authenticated-backend-json';

function unauthorizedError(): ApiError {
  return new ApiError({
    statusCode: 401,

    code: 'UNAUTHORIZED',

    message: 'Unauthorized',

    error: 'Unauthorized',
  });
}

describe('authenticatedBackendJson', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    clearAuthCookiesMock.mockResolvedValue(undefined);
  });

  it('uses the existing access token for a normal request', async () => {
    getAccessTokenMock.mockResolvedValue('access-token');

    backendJsonMock.mockResolvedValue({
      ok: true,
    });

    await expect(authenticatedBackendJson<{ ok: boolean }>('/resource')).resolves.toEqual({
      ok: true,
    });

    expect(backendJsonMock).toHaveBeenCalledTimes(1);

    expect(backendJsonMock).toHaveBeenCalledWith('/resource', {
      accessToken: 'access-token',
    });

    expect(refreshAuthSessionMock).not.toHaveBeenCalled();
  });

  it('preserves mutation method body and headers when using the existing access token', async () => {
    getAccessTokenMock.mockResolvedValue('access-token');

    backendJsonMock.mockResolvedValue({
      created: true,
    });

    const options: RequestInit = {
      method: 'POST',

      headers: {
        'idempotency-key': 'activity-key-123',
      },

      body: JSON.stringify({
        type: 'call',
      }),
    };

    await expect(
      authenticatedBackendJson<{ created: boolean }>(
        '/campaigns/campaign/prospects/prospect/activities',
        options,
      ),
    ).resolves.toEqual({
      created: true,
    });

    expect(backendJsonMock).toHaveBeenCalledWith(
      '/campaigns/campaign/prospects/prospect/activities',
      {
        ...options,

        accessToken: 'access-token',
      },
    );
  });

  it('refreshes before the request when no access token is available', async () => {
    getAccessTokenMock.mockResolvedValue(null);

    refreshAuthSessionMock.mockResolvedValue({
      accessToken: 'refreshed-access-token',

      refreshToken: 'refreshed-refresh-token',
    });

    backendJsonMock.mockResolvedValue({
      ok: true,
    });

    await expect(
      authenticatedBackendJson<{ ok: boolean }>('/resource', {
        method: 'DELETE',
      }),
    ).resolves.toEqual({
      ok: true,
    });

    expect(refreshAuthSessionMock).toHaveBeenCalledTimes(1);

    expect(backendJsonMock).toHaveBeenCalledTimes(1);

    expect(backendJsonMock).toHaveBeenCalledWith('/resource', {
      method: 'DELETE',

      accessToken: 'refreshed-access-token',
    });
  });

  it('returns null when no authenticated session can be refreshed', async () => {
    getAccessTokenMock.mockResolvedValue(null);

    refreshAuthSessionMock.mockResolvedValue(null);

    await expect(authenticatedBackendJson('/resource')).resolves.toBeNull();

    expect(backendJsonMock).not.toHaveBeenCalled();
  });

  it('preserves mutation method body and idempotency key across a 401 refresh retry', async () => {
    getAccessTokenMock.mockResolvedValue('expired-access-token');

    refreshAuthSessionMock.mockResolvedValue({
      accessToken: 'refreshed-access-token',

      refreshToken: 'refreshed-refresh-token',
    });

    backendJsonMock.mockRejectedValueOnce(unauthorizedError()).mockResolvedValueOnce({
      id: 'activity-id',
    });

    const options: RequestInit = {
      method: 'POST',

      headers: {
        'idempotency-key': 'activity-key-456',
      },

      body: JSON.stringify({
        type: 'email',
      }),
    };

    await expect(
      authenticatedBackendJson<{ id: string }>(
        '/campaigns/campaign/prospects/prospect/activities',
        options,
      ),
    ).resolves.toEqual({
      id: 'activity-id',
    });

    expect(backendJsonMock).toHaveBeenCalledTimes(2);

    expect(backendJsonMock).toHaveBeenNthCalledWith(
      1,
      '/campaigns/campaign/prospects/prospect/activities',
      {
        ...options,

        accessToken: 'expired-access-token',
      },
    );

    expect(backendJsonMock).toHaveBeenNthCalledWith(
      2,
      '/campaigns/campaign/prospects/prospect/activities',
      {
        ...options,

        accessToken: 'refreshed-access-token',
      },
    );

    /*
     * Most importantly, the logical mutation identity
     * must not change during authentication recovery.
     */
    const firstOptions = backendJsonMock.mock.calls[0]?.[1] as RequestInit & {
      accessToken?: string;
    };

    const secondOptions = backendJsonMock.mock.calls[1]?.[1] as RequestInit & {
      accessToken?: string;
    };

    expect(firstOptions.method).toBe(secondOptions.method);

    expect(firstOptions.body).toBe(secondOptions.body);

    expect(firstOptions.headers).toEqual(secondOptions.headers);
  });

  it('clears authentication when a refreshed request also returns 401', async () => {
    getAccessTokenMock.mockResolvedValue('expired-access-token');

    refreshAuthSessionMock.mockResolvedValue({
      accessToken: 'refreshed-access-token',

      refreshToken: 'refreshed-refresh-token',
    });

    backendJsonMock
      .mockRejectedValueOnce(unauthorizedError())
      .mockRejectedValueOnce(unauthorizedError());

    await expect(authenticatedBackendJson('/resource')).resolves.toBeNull();

    expect(clearAuthCookiesMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry non-authentication backend failures', async () => {
    getAccessTokenMock.mockResolvedValue('access-token');

    const error = new ApiError({
      statusCode: 409,

      code: 'CONFLICT',

      message: 'Conflict',

      error: 'Conflict',
    });

    backendJsonMock.mockRejectedValue(error);

    await expect(
      authenticatedBackendJson('/resource', {
        method: 'POST',
      }),
    ).rejects.toBe(error);

    expect(backendJsonMock).toHaveBeenCalledTimes(1);

    expect(refreshAuthSessionMock).not.toHaveBeenCalled();
  });
});
