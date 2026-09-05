import { UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { User } from '../database/schema/users.js';
import { UserRepository } from '../users/user.repository.js';
import { AuthSessionRepository } from './auth-session.repository.js';
import { AuthService } from './auth.service.js';
import { PasswordService } from './password.service.js';
import { TokenService } from './token.service.js';

describe('AuthService', () => {
  let userRepository: UserRepository;
  let passwordService: PasswordService;
  let tokenService: TokenService;
  let authSessionRepository: AuthSessionRepository;
  let service: AuthService;

  const user: User = {
    id: '11111111-1111-4111-8111-111111111111',
    tenantId: '22222222-2222-4222-8222-222222222222',
    email: 'admin@intertrad.com',
    passwordHash: '$argon2id$test-hash',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    userRepository = {
      create: vi.fn(),
      findByEmail: vi.fn(),
      findById: vi.fn(),
    } as unknown as UserRepository;

    passwordService = {
      hash: vi.fn(),
      verify: vi.fn(),
    } as unknown as PasswordService;

    tokenService = {
      createTokens: vi.fn(),
      hashRefreshToken: vi.fn(),
      getExpiration: vi.fn(),
      verifyAccessToken: vi.fn(),
      verifyRefreshToken: vi.fn(),
      matchesRefreshToken: vi.fn(),
    } as unknown as TokenService;

    authSessionRepository = {
      create: vi.fn(),
      findActiveById: vi.fn(),
      rotate: vi.fn(),
      revoke: vi.fn(),
    } as unknown as AuthSessionRepository;

    service = new AuthService(userRepository, passwordService, tokenService, authSessionRepository);
  });

  it('logs in an active user with valid credentials', async () => {
    const expiresAt = new Date('2026-09-11T12:00:00Z');

    vi.mocked(userRepository.findByEmail).mockResolvedValue(user);

    vi.mocked(passwordService.verify).mockResolvedValue(true);

    vi.mocked(tokenService.createTokens).mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });

    vi.mocked(tokenService.hashRefreshToken)
      .mockReturnValueOnce('a'.repeat(64))
      .mockReturnValueOnce('b'.repeat(64));

    vi.mocked(tokenService.getExpiration).mockReturnValue(expiresAt);

    vi.mocked(authSessionRepository.create).mockResolvedValue({
      id: '33333333-3333-4333-8333-333333333333',
      userId: user.id,
      refreshTokenHash: 'a'.repeat(64),
      expiresAt,
      revokedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.login({
      email: '  ADMIN@INTERTRAD.COM  ',
      password: 'StrongPassword123!',
    });

    expect(userRepository.findByEmail).toHaveBeenCalledWith('admin@intertrad.com');

    expect(passwordService.verify).toHaveBeenCalledWith(user.passwordHash, 'StrongPassword123!');

    expect(result).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });

    expect(authSessionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: user.id,
        refreshTokenHash: 'a'.repeat(64),
        expiresAt,
      }),
    );
  });

  it('rejects an unknown email', async () => {
    vi.mocked(userRepository.findByEmail).mockResolvedValue(null);

    await expect(
      service.login({
        email: 'unknown@example.com',
        password: 'Password123!',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(passwordService.verify).not.toHaveBeenCalled();
    expect(authSessionRepository.create).not.toHaveBeenCalled();
  });

  it('rejects an incorrect password', async () => {
    vi.mocked(userRepository.findByEmail).mockResolvedValue(user);

    vi.mocked(passwordService.verify).mockResolvedValue(false);

    await expect(
      service.login({
        email: user.email,
        password: 'WrongPassword!',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(authSessionRepository.create).not.toHaveBeenCalled();
  });

  it('rejects a suspended user', async () => {
    vi.mocked(userRepository.findByEmail).mockResolvedValue({
      ...user,
      status: 'suspended',
    });

    await expect(
      service.login({
        email: user.email,
        password: 'StrongPassword123!',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(passwordService.verify).not.toHaveBeenCalled();
    expect(authSessionRepository.create).not.toHaveBeenCalled();
  });

  it('rejects a disabled user', async () => {
    vi.mocked(userRepository.findByEmail).mockResolvedValue({
      ...user,
      status: 'disabled',
    });

    await expect(
      service.login({
        email: user.email,
        password: 'StrongPassword123!',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(passwordService.verify).not.toHaveBeenCalled();
    expect(authSessionRepository.create).not.toHaveBeenCalled();
  });

  it('rotates tokens for a valid refresh session', async () => {
    const sessionId = '33333333-3333-4333-8333-333333333333';

    const expiresAt = new Date(Date.now() + 60_000);

    vi.mocked(tokenService.verifyRefreshToken).mockResolvedValue({
      sub: user.id,
      tenantId: user.tenantId,
      sid: sessionId,
      jti: '44444444-4444-4444-8444-444444444444',
      type: 'refresh',
    });

    vi.mocked(userRepository.findById).mockResolvedValue(user);

    vi.mocked(authSessionRepository.findActiveById).mockResolvedValue({
      id: sessionId,
      userId: user.id,
      refreshTokenHash: 'a'.repeat(64),
      expiresAt,
      revokedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.mocked(tokenService.matchesRefreshToken).mockReturnValue(true);

    vi.mocked(tokenService.createTokens).mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    });

    vi.mocked(tokenService.hashRefreshToken).mockImplementation((token: string) => {
      if (token === 'original-refresh-token') {
        return 'a'.repeat(64);
      }

      if (token === 'new-refresh-token') {
        return 'b'.repeat(64);
      }

      throw new Error(`Unexpected token: ${token}`);
    });

    const newExpiresAt = new Date(Date.now() + 120_000);

    vi.mocked(tokenService.getExpiration).mockReturnValue(newExpiresAt);

    vi.mocked(authSessionRepository.rotate).mockResolvedValue({
      id: sessionId,
      userId: user.id,
      refreshTokenHash: 'b'.repeat(64),
      expiresAt: newExpiresAt,
      revokedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.refresh('original-refresh-token');

    expect(result).toEqual({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    });

    expect(authSessionRepository.rotate).toHaveBeenCalledWith(
      sessionId,
      user.id,
      'a'.repeat(64),
      'b'.repeat(64),
      newExpiresAt,
    );
  });

  it('rejects refresh when the session has been revoked or does not exist', async () => {
    vi.mocked(tokenService.verifyRefreshToken).mockResolvedValue({
      sub: user.id,
      tenantId: user.tenantId,
      sid: '33333333-3333-4333-8333-333333333333',
      type: 'refresh',
      jti: '44444444-4444-4444-8444-444444444444',
    });

    vi.mocked(userRepository.findById).mockResolvedValue(user);

    vi.mocked(authSessionRepository.findActiveById).mockResolvedValue(null);

    await expect(service.refresh('refresh-token')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects refresh when the token does not match the stored session hash', async () => {
    const sessionId = '33333333-3333-4333-8333-333333333333';

    vi.mocked(tokenService.verifyRefreshToken).mockResolvedValue({
      sub: user.id,
      tenantId: user.tenantId,
      sid: sessionId,
      type: 'refresh',
      jti: '44444444-4444-4444-8444-444444444444',
    });

    vi.mocked(userRepository.findById).mockResolvedValue(user);

    vi.mocked(authSessionRepository.findActiveById).mockResolvedValue({
      id: sessionId,
      userId: user.id,
      refreshTokenHash: 'a'.repeat(64),
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.mocked(tokenService.matchesRefreshToken).mockReturnValue(false);

    await expect(service.refresh('stolen-or-old-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(authSessionRepository.rotate).not.toHaveBeenCalled();
  });

  it('rejects an expired database session', async () => {
    const sessionId = '33333333-3333-4333-8333-333333333333';

    vi.mocked(tokenService.verifyRefreshToken).mockResolvedValue({
      sub: user.id,
      tenantId: user.tenantId,
      sid: sessionId,
      type: 'refresh',
      jti: '44444444-4444-4444-8444-444444444444',
    });

    vi.mocked(userRepository.findById).mockResolvedValue(user);

    vi.mocked(authSessionRepository.findActiveById).mockResolvedValue({
      id: sessionId,
      userId: user.id,
      refreshTokenHash: 'a'.repeat(64),
      expiresAt: new Date(Date.now() - 60_000),
      revokedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(service.refresh('refresh-token')).rejects.toBeInstanceOf(UnauthorizedException);

    expect(tokenService.matchesRefreshToken).not.toHaveBeenCalled();
  });
  it('revokes the authentication session during logout', async () => {
    const sessionId = '33333333-3333-4333-8333-333333333333';

    vi.mocked(tokenService.verifyRefreshToken).mockResolvedValue({
      sub: user.id,
      tenantId: user.tenantId,
      sid: sessionId,
      type: 'refresh',
      jti: '44444444-4444-4444-8444-444444444444',
    });

    vi.mocked(authSessionRepository.revoke).mockResolvedValue(true);

    await service.logout('refresh-token');

    expect(authSessionRepository.revoke).toHaveBeenCalledWith(sessionId, user.id);
  });

  it('rejects refresh when atomic rotation loses a race', async () => {
    const sessionId = '33333333-3333-4333-8333-333333333333';

    vi.mocked(tokenService.verifyRefreshToken).mockResolvedValue({
      sub: user.id,
      tenantId: user.tenantId,
      sid: sessionId,
      jti: '44444444-4444-4444-8444-444444444444',
      type: 'refresh',
    });

    vi.mocked(userRepository.findById).mockResolvedValue(user);

    vi.mocked(authSessionRepository.findActiveById).mockResolvedValue({
      id: sessionId,
      userId: user.id,
      refreshTokenHash: 'a'.repeat(64),
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    vi.mocked(tokenService.matchesRefreshToken).mockReturnValue(true);

    vi.mocked(tokenService.hashRefreshToken)
      .mockReturnValueOnce('a'.repeat(64))
      .mockReturnValueOnce('b'.repeat(64));

    vi.mocked(tokenService.createTokens).mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    });

    vi.mocked(tokenService.getExpiration).mockReturnValue(new Date(Date.now() + 120_000));

    vi.mocked(authSessionRepository.rotate).mockResolvedValue(null);

    await expect(service.refresh('original-refresh-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
