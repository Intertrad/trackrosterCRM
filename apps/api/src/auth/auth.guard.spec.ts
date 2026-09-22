import { PermissionService } from '../permissions/permission.service.js';
import {
  ExecutionContext,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthSessionRepository } from './auth-session.repository.js';
import { AuthGuard } from './auth.guard.js';
import { AuthenticatedRequest } from './auth.types.js';
import { TokenService } from './token.service.js';

const identityId = '11111111-1111-4111-8111-111111111111';
const membershipId = '22222222-2222-4222-8222-222222222222';
const tenantId = '33333333-3333-4333-8333-333333333333';
const sessionId = '44444444-4444-4444-8444-444444444444';
const tokenId = '55555555-5555-4555-8555-555555555555';

describe('AuthGuard', () => {
  let tokenService: TokenService;
  let authSessionRepository: AuthSessionRepository;
  let guard: AuthGuard;

  beforeEach(() => {
    tokenService = {
      verifyAccessToken: vi.fn(),
    } as unknown as TokenService;

    authSessionRepository = {
      findActiveById: vi.fn(),
    } as unknown as AuthSessionRepository;

    guard = new AuthGuard(tokenService, authSessionRepository, {
      enforceRequest: vi.fn(),
    } as unknown as PermissionService);
  });

  function createContext(request: AuthenticatedRequest): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  function mockValidToken(): void {
    vi.mocked(tokenService.verifyAccessToken).mockResolvedValue({
      sub: identityId,
      membershipId,
      tenantId,
      sid: sessionId,
      jti: tokenId,
      ver: 2,
      type: 'access',
    });
  }

  it('authenticates only a bearer token backed by its exact active database session', async () => {
    const request: AuthenticatedRequest = {
      headers: {
        authorization: 'Bearer access-token',
      },
    };

    mockValidToken();
    vi.mocked(authSessionRepository.findActiveById).mockResolvedValue({} as never);

    const result = await guard.canActivate(createContext(request));

    expect(result).toBe(true);
    expect(authSessionRepository.findActiveById).toHaveBeenCalledWith({
      sessionId,
      identityId,
      membershipId,
      tenantId,
    });
    expect(request.auth).toEqual({
      identityId,
      membershipId,
      tenantId,
      sessionId,
      tokenId,
      userId: membershipId,
    });
  });

  it('rejects requests without an authorization header', async () => {
    const request: AuthenticatedRequest = {
      headers: {},
    };

    await expect(guard.canActivate(createContext(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(tokenService.verifyAccessToken).not.toHaveBeenCalled();
    expect(authSessionRepository.findActiveById).not.toHaveBeenCalled();
  });

  it.each([
    'access-token',
    'Basic access-token',
    'Bearer',
    'Bearer access-token extra',
    'Bearer  access-token',
  ])('rejects malformed authorization header %s', async (authorization) => {
    const request: AuthenticatedRequest = {
      headers: { authorization },
    };

    await expect(guard.canActivate(createContext(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(authSessionRepository.findActiveById).not.toHaveBeenCalled();
  });

  it('rejects invalid or expired access tokens before a database read', async () => {
    const request: AuthenticatedRequest = {
      headers: {
        authorization: 'Bearer invalid-token',
      },
    };

    vi.mocked(tokenService.verifyAccessToken).mockRejectedValue(new Error('Invalid token'));

    await expect(guard.canActivate(createContext(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(authSessionRepository.findActiveById).not.toHaveBeenCalled();
  });

  it('rejects a cryptographically valid access token after its session is revoked or expired', async () => {
    const request: AuthenticatedRequest = {
      headers: {
        authorization: 'Bearer access-token',
      },
    };

    mockValidToken();
    vi.mocked(authSessionRepository.findActiveById).mockResolvedValue(null);

    await expect(guard.canActivate(createContext(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(request.auth).toBeUndefined();
  });

  it('fails closed with service unavailable when authentication state cannot be read', async () => {
    const request: AuthenticatedRequest = {
      headers: {
        authorization: 'Bearer access-token',
      },
    };

    mockValidToken();
    vi.mocked(authSessionRepository.findActiveById).mockRejectedValue(
      new Error('Database unavailable'),
    );

    await expect(guard.canActivate(createContext(request))).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(request.auth).toBeUndefined();
  });
});
