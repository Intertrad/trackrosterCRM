import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthGuard } from './auth.guard.js';
import { AuthenticatedRequest } from './auth.types.js';
import { TokenService } from './token.service.js';

describe('AuthGuard', () => {
  let tokenService: TokenService;
  let guard: AuthGuard;

  beforeEach(() => {
    tokenService = {
      verifyAccessToken: vi.fn(),
    } as unknown as TokenService;

    guard = new AuthGuard(tokenService);
  });

  function createContext(request: AuthenticatedRequest): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  it('authenticates a valid bearer access token', async () => {
    const request: AuthenticatedRequest = {
      headers: {
        authorization: 'Bearer access-token',
      },
    };

    vi.mocked(tokenService.verifyAccessToken).mockResolvedValue({
      sub: 'user-id',
      tenantId: 'tenant-id',
      type: 'access',
    });

    const result = await guard.canActivate(createContext(request));

    expect(result).toBe(true);

    expect(request.auth).toEqual({
      userId: 'user-id',
      tenantId: 'tenant-id',
    });
  });

  it('rejects requests without an authorization header', async () => {
    const request: AuthenticatedRequest = {
      headers: {},
    };

    await expect(guard.canActivate(createContext(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects malformed authorization headers', async () => {
    const request: AuthenticatedRequest = {
      headers: {
        authorization: 'access-token',
      },
    };

    await expect(guard.canActivate(createContext(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects invalid or expired access tokens', async () => {
    const request: AuthenticatedRequest = {
      headers: {
        authorization: 'Bearer invalid-token',
      },
    };

    vi.mocked(tokenService.verifyAccessToken).mockRejectedValue(new Error('Invalid token'));

    await expect(guard.canActivate(createContext(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
