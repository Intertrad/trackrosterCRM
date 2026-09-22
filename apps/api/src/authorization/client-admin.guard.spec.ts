import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthenticatedRequest } from '../auth/auth.types.js';
import { AuthorizationService } from './authorization.service.js';
import { ClientAdminGuard } from './client-admin.guard.js';

describe('ClientAdminGuard', () => {
  let authorizationService: AuthorizationService;

  let guard: ClientAdminGuard;

  beforeEach(() => {
    authorizationService = {
      isClientAdmin: vi.fn(),
    } as unknown as AuthorizationService;

    guard = new ClientAdminGuard(authorizationService);
  });

  function createContext(request: AuthenticatedRequest): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  it('allows a tenant client admin', async () => {
    const request: AuthenticatedRequest = {
      headers: {},
      auth: {
        identityId: 'identity-id',
        membershipId: 'user-id',
        sessionId: 'session-id',
        tokenId: 'token-id',
        userId: 'user-id',
        tenantId: 'tenant-id',
      },
    };

    vi.mocked(authorizationService.isClientAdmin).mockResolvedValue(true);

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
  });

  it('rejects an authenticated non-admin', async () => {
    const request: AuthenticatedRequest = {
      headers: {},
      auth: {
        identityId: 'identity-id',
        membershipId: 'user-id',
        sessionId: 'session-id',
        tokenId: 'token-id',
        userId: 'user-id',
        tenantId: 'tenant-id',
      },
    };

    vi.mocked(authorizationService.isClientAdmin).mockResolvedValue(false);

    await expect(guard.canActivate(createContext(request))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects missing authentication context', async () => {
    const request: AuthenticatedRequest = {
      headers: {},
    };

    await expect(guard.canActivate(createContext(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
