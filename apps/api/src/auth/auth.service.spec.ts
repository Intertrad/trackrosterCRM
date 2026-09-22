import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthSession } from '../database/schema/auth-sessions.js';
import type { Identity } from '../database/schema/identities.js';
import { AuthSessionRepository } from './auth-session.repository.js';
import {
  type ActiveAuthenticationMembership,
  AuthenticationIdentityRepository,
} from './authentication-identity.repository.js';
import { MfaService } from './mfa.service.js';
import { AuthService } from './auth.service.js';
import { PasswordService } from './password.service.js';
import { TokenService } from './token.service.js';

const identityId = '11111111-1111-4111-8111-111111111111';
const membershipId = identityId;
const tenantId = '22222222-2222-4222-8222-222222222222';
const sessionId = '33333333-3333-4333-8333-333333333333';
const tokenId = '44444444-4444-4444-8444-444444444444';
const now = new Date('2026-09-21T08:00:00.000Z');

const identity: Identity = {
  id: identityId,
  email: 'admin@intertrad.com',
  passwordHash: '$argon2id$test-hash',
  status: 'active',
  emailVerifiedAt: null,
  mfaEnrolledAt: null,
  mfaRecoveryCodesRotatedAt: null,
  lastAuthenticatedAt: null,
  credentialsUpdatedAt: now,
  securityStateUpdatedAt: now,
  suspendedAt: null,
  disabledAt: null,
  createdAt: now,
  updatedAt: now,
};

const membership: ActiveAuthenticationMembership = {
  identityId,
  membershipId,
  tenantId,
  tenantName: 'Intertrad',
  displayName: 'Admin User',
  legacyUserId: membershipId,
};

function createSession(overrides: Partial<AuthSession> = {}): AuthSession {
  const expiresAt = new Date('2026-09-28T08:00:00.000Z');

  return {
    id: sessionId,
    userId: membershipId,
    identityId,
    membershipId,
    tenantId,
    refreshTokenHash: 'a'.repeat(64),
    expiresAt,
    absoluteExpiresAt: expiresAt,
    revokedAt: null,
    revokedReason: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('AuthService', () => {
  let authenticationIdentityRepository: AuthenticationIdentityRepository;
  let passwordService: PasswordService;
  let tokenService: TokenService;
  let authSessionRepository: AuthSessionRepository;
  let service: AuthService;

  beforeEach(() => {
    authenticationIdentityRepository = {
      withVerifiedIdentity: vi.fn((current, callback) => callback(current, undefined)),
      findByEmail: vi.fn(),
      findActiveMemberships: vi.fn(),
      createWorkspaceChallenge: vi.fn(),
      consumeWorkspaceChallenge: vi.fn(),
    } as unknown as AuthenticationIdentityRepository;

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

    service = new AuthService(
      authenticationIdentityRepository,
      passwordService,
      tokenService,
      authSessionRepository,
      { requiredEnrollment: vi.fn().mockResolvedValue(null) } as unknown as MfaService,
    );
  });

  function mockSuccessfulLoginDependencies(): Date {
    const expiresAt = new Date('2026-09-28T08:00:00.000Z');

    vi.mocked(authenticationIdentityRepository.findByEmail).mockResolvedValue(identity);
    vi.mocked(authenticationIdentityRepository.findActiveMemberships).mockResolvedValue([
      membership,
    ]);
    vi.mocked(passwordService.verify).mockResolvedValue(true);
    vi.mocked(tokenService.createTokens).mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
    vi.mocked(tokenService.hashRefreshToken).mockReturnValue('a'.repeat(64));
    vi.mocked(tokenService.getExpiration).mockReturnValue(expiresAt);
    vi.mocked(authSessionRepository.create).mockResolvedValue(createSession());

    return expiresAt;
  }

  function mockRefreshPayload(): void {
    vi.mocked(tokenService.verifyRefreshToken).mockResolvedValue({
      sub: identityId,
      membershipId,
      tenantId,
      sid: sessionId,
      jti: tokenId,
      ver: 2,
      type: 'refresh',
    });
  }

  it('logs in through the identity model and creates one exact same-ID session binding', async () => {
    const expiresAt = mockSuccessfulLoginDependencies();

    const result = await service.login({
      email: '  ADMIN@INTERTRAD.COM  ',
      password: 'StrongPassword123!',
    });

    expect(authenticationIdentityRepository.findByEmail).toHaveBeenCalledWith(
      'admin@intertrad.com',
    );
    expect(passwordService.verify).toHaveBeenCalledWith(
      identity.passwordHash,
      'StrongPassword123!',
    );
    expect(authenticationIdentityRepository.findActiveMemberships).toHaveBeenCalledWith(
      identityId,
      undefined,
    );
    expect(tokenService.createTokens).toHaveBeenCalledWith({
      identityId,
      membershipId,
      tenantId,
      sessionId: expect.any(String),
    });
    expect(authSessionRepository.create).toHaveBeenCalledWith({
      id: expect.any(String),
      userId: membershipId,
      identityId,
      membershipId,
      tenantId,
      refreshTokenHash: 'a'.repeat(64),
      expiresAt,
      absoluteExpiresAt: expiresAt,
    });
    expect(result).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
  });

  it('performs password verification for an unknown email before returning generic unauthorized', async () => {
    vi.mocked(authenticationIdentityRepository.findByEmail).mockResolvedValue(null);
    vi.mocked(passwordService.verify).mockResolvedValue(false);

    await expect(
      service.login({
        email: 'unknown@example.com',
        password: 'Password123!',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(passwordService.verify).toHaveBeenCalledWith(
      expect.stringMatching(/^\$argon2id\$/),
      'Password123!',
    );
    expect(authenticationIdentityRepository.findActiveMemberships).not.toHaveBeenCalled();
    expect(authSessionRepository.create).not.toHaveBeenCalled();
  });

  it.each([
    ['an incorrect password', identity, false],
    ['a suspended identity', { ...identity, status: 'suspended' as const }, true],
    ['a disabled identity', { ...identity, status: 'disabled' as const }, true],
    ['an identity without a local credential', { ...identity, passwordHash: null }, false],
  ])('rejects %s after performing password verification', async (_label, candidate, matches) => {
    vi.mocked(authenticationIdentityRepository.findByEmail).mockResolvedValue(candidate);
    vi.mocked(passwordService.verify).mockResolvedValue(matches);

    await expect(
      service.login({
        email: identity.email,
        password: 'StrongPassword123!',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(passwordService.verify).toHaveBeenCalledOnce();
    expect(authenticationIdentityRepository.findActiveMemberships).not.toHaveBeenCalled();
    expect(authSessionRepository.create).not.toHaveBeenCalled();
  });

  it('rejects an identity without an active tenant membership', async () => {
    vi.mocked(authenticationIdentityRepository.findByEmail).mockResolvedValue(identity);
    vi.mocked(passwordService.verify).mockResolvedValue(true);
    vi.mocked(authenticationIdentityRepository.findActiveMemberships).mockResolvedValue([]);

    await expect(
      service.login({ email: identity.email, password: 'StrongPassword123!' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns a short-lived workspace challenge without issuing a tenant session', async () => {
    vi.mocked(authenticationIdentityRepository.findByEmail).mockResolvedValue(identity);
    vi.mocked(passwordService.verify).mockResolvedValue(true);
    vi.mocked(authenticationIdentityRepository.findActiveMemberships).mockResolvedValue([
      membership,
      {
        ...membership,
        membershipId: '55555555-5555-4555-8555-555555555555',
        tenantId: '66666666-6666-4666-8666-666666666666',
        tenantName: 'Second tenant',
        legacyUserId: null,
      },
    ]);

    const result = await service.login({ email: identity.email, password: 'StrongPassword123!' });
    expect(result).toMatchObject({
      workspaceRequired: true,
      expiresIn: 300,
      memberships: [{ membershipId }, { tenantName: 'Second tenant' }],
    });
    expect(authenticationIdentityRepository.createWorkspaceChallenge).toHaveBeenCalledWith(
      identity,
      expect.stringMatching(/^[a-f0-9]{64}$/),
      undefined,
    );
    expect(tokenService.createTokens).not.toHaveBeenCalled();
    expect(authSessionRepository.create).not.toHaveBeenCalled();
  });

  it('supports a native membership with a different ID and no legacy user', async () => {
    mockSuccessfulLoginDependencies();
    const native = {
      ...membership,
      membershipId: '55555555-5555-4555-8555-555555555555',
      legacyUserId: null,
    };
    vi.mocked(authenticationIdentityRepository.findActiveMemberships).mockResolvedValue([native]);
    await service.login({ email: identity.email, password: 'StrongPassword123!' });
    expect(authSessionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ identityId, membershipId: native.membershipId, userId: null }),
    );
  });

  it.each([
    [
      'membership belongs to a different identity',
      { ...membership, identityId: '55555555-5555-4555-8555-555555555555' },
    ],
  ])('fails closed when %s', async (_label, candidate) => {
    vi.mocked(authenticationIdentityRepository.findByEmail).mockResolvedValue(identity);
    vi.mocked(passwordService.verify).mockResolvedValue(true);
    vi.mocked(authenticationIdentityRepository.findActiveMemberships).mockResolvedValue([
      candidate,
    ]);

    await expect(
      service.login({ email: identity.email, password: 'StrongPassword123!' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(authSessionRepository.create).not.toHaveBeenCalled();
  });

  it.each([
    ['identity lookup', 'identity'],
    ['membership lookup', 'membership'],
    ['session creation', 'session'],
  ])('returns service unavailable when %s persistence fails', async (_label, failure) => {
    mockSuccessfulLoginDependencies();

    if (failure === 'identity') {
      vi.mocked(authenticationIdentityRepository.findByEmail).mockRejectedValue(
        new Error('Database unavailable'),
      );
    } else if (failure === 'membership') {
      vi.mocked(authenticationIdentityRepository.findActiveMemberships).mockRejectedValue(
        new Error('Database unavailable'),
      );
    } else {
      vi.mocked(authSessionRepository.create).mockRejectedValue(new Error('Database unavailable'));
    }

    await expect(
      service.login({ email: identity.email, password: 'StrongPassword123!' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('rotates a valid refresh token within its exact principal and absolute lifetime', async () => {
    mockRefreshPayload();
    const absoluteExpiresAt = new Date('2026-09-28T08:00:00.000Z');
    const tokenExpiresAt = new Date('2026-10-05T08:00:00.000Z');
    const session = createSession({ absoluteExpiresAt });

    vi.mocked(authSessionRepository.findActiveById).mockResolvedValue(session);
    vi.mocked(tokenService.matchesRefreshToken).mockReturnValue(true);
    vi.mocked(tokenService.hashRefreshToken).mockImplementation((token) =>
      token === 'original-refresh-token' ? 'a'.repeat(64) : 'b'.repeat(64),
    );
    vi.mocked(tokenService.createTokens).mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    });
    vi.mocked(tokenService.getExpiration).mockReturnValue(tokenExpiresAt);
    vi.mocked(authSessionRepository.rotate).mockResolvedValue(
      createSession({ refreshTokenHash: 'b'.repeat(64), expiresAt: absoluteExpiresAt }),
    );

    const result = await service.refresh('original-refresh-token');
    const principal = { sessionId, identityId, membershipId, tenantId };

    expect(authSessionRepository.findActiveById).toHaveBeenCalledWith(principal);
    expect(tokenService.createTokens).toHaveBeenCalledWith({
      identityId,
      membershipId,
      tenantId,
      sessionId,
    });
    expect(authSessionRepository.rotate).toHaveBeenCalledWith(
      principal,
      'a'.repeat(64),
      'b'.repeat(64),
      absoluteExpiresAt,
    );
    expect(result).toEqual({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    });
  });

  it('rejects a malformed refresh token before reading session state', async () => {
    vi.mocked(tokenService.verifyRefreshToken).mockRejectedValue(new Error('Invalid token'));

    await expect(service.refresh('invalid-refresh-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(authSessionRepository.findActiveById).not.toHaveBeenCalled();
  });

  it('rejects refresh when the exact active session does not exist', async () => {
    mockRefreshPayload();
    vi.mocked(authSessionRepository.findActiveById).mockResolvedValue(null);

    await expect(service.refresh('refresh-token')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(tokenService.matchesRefreshToken).not.toHaveBeenCalled();
  });

  it('revokes the exact session as refresh reuse when the token hash does not match', async () => {
    mockRefreshPayload();
    vi.mocked(authSessionRepository.findActiveById).mockResolvedValue(createSession());
    vi.mocked(tokenService.matchesRefreshToken).mockReturnValue(false);
    vi.mocked(authSessionRepository.revoke).mockResolvedValue(true);

    await expect(service.refresh('stolen-or-old-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(authSessionRepository.revoke).toHaveBeenCalledWith(
      { sessionId, identityId, membershipId, tenantId },
      'refresh_reuse',
    );
    expect(authSessionRepository.rotate).not.toHaveBeenCalled();
  });

  it('returns service unavailable when refresh replay cannot be revoked', async () => {
    mockRefreshPayload();
    vi.mocked(authSessionRepository.findActiveById).mockResolvedValue(createSession());
    vi.mocked(tokenService.matchesRefreshToken).mockReturnValue(false);
    vi.mocked(authSessionRepository.revoke).mockRejectedValue(new Error('Database unavailable'));

    await expect(service.refresh('stolen-or-old-token')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it.each(['lookup', 'rotation'])(
    'returns service unavailable when refresh %s fails',
    async (step) => {
      mockRefreshPayload();

      if (step === 'lookup') {
        vi.mocked(authSessionRepository.findActiveById).mockRejectedValue(
          new Error('Database unavailable'),
        );
      } else {
        vi.mocked(authSessionRepository.findActiveById).mockResolvedValue(createSession());
        vi.mocked(tokenService.matchesRefreshToken).mockReturnValue(true);
        vi.mocked(tokenService.hashRefreshToken)
          .mockReturnValueOnce('a'.repeat(64))
          .mockReturnValueOnce('b'.repeat(64));
        vi.mocked(tokenService.createTokens).mockResolvedValue({
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
        });
        vi.mocked(tokenService.getExpiration).mockReturnValue(new Date('2026-09-28T08:00:00.000Z'));
        vi.mocked(authSessionRepository.rotate).mockRejectedValue(
          new Error('Database unavailable'),
        );
      }

      await expect(service.refresh('refresh-token')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    },
  );

  it('rejects refresh when atomic rotation loses a race', async () => {
    mockRefreshPayload();
    vi.mocked(authSessionRepository.findActiveById).mockResolvedValue(createSession());
    vi.mocked(tokenService.matchesRefreshToken).mockReturnValue(true);
    vi.mocked(tokenService.hashRefreshToken)
      .mockReturnValueOnce('a'.repeat(64))
      .mockReturnValueOnce('b'.repeat(64));
    vi.mocked(tokenService.createTokens).mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    });
    vi.mocked(tokenService.getExpiration).mockReturnValue(new Date('2026-09-28T08:00:00.000Z'));
    vi.mocked(authSessionRepository.rotate).mockResolvedValue(null);

    await expect(service.refresh('refresh-token')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('revokes the exact authentication session with a logout reason', async () => {
    mockRefreshPayload();
    vi.mocked(authSessionRepository.revoke).mockResolvedValue(true);

    await service.logout('refresh-token');

    expect(authSessionRepository.revoke).toHaveBeenCalledWith(
      { sessionId, identityId, membershipId, tenantId },
      'logout',
    );
  });

  it('rejects logout with an invalid refresh token before database mutation', async () => {
    vi.mocked(tokenService.verifyRefreshToken).mockRejectedValue(new Error('Invalid token'));

    await expect(service.logout('invalid-refresh-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(authSessionRepository.revoke).not.toHaveBeenCalled();
  });

  it('returns service unavailable when logout revocation fails', async () => {
    mockRefreshPayload();
    vi.mocked(authSessionRepository.revoke).mockRejectedValue(new Error('Database unavailable'));

    await expect(service.logout('refresh-token')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
