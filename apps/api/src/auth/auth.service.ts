import { createHash, randomBytes, randomUUID } from 'node:crypto';

import {
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';

import {
  AuthSessionRepository,
  type AuthenticationSessionPrincipal,
} from './auth-session.repository.js';
import {
  AuthenticationIdentityRepository,
  type ActiveAuthenticationMembership,
} from './authentication-identity.repository.js';
import {
  AuthenticationTokens,
  AuthenticationResult,
  AuthenticatedPrincipal,
} from './auth.types.js';
import type { DatabaseExecutor } from '../database/database.types.js';
import { PasswordService } from './password.service.js';
import { MfaService } from './mfa.service.js';
import type { Identity } from '../database/schema/identities.js';
import { TokenService } from './token.service.js';

export interface LoginInput {
  email: string;
  password: string;
}

/*
 * A fixed, valid Argon2id hash keeps the unknown-account path close to the
 * valid-account path without allocating a new hash for every login attempt.
 * It is not associated with any real credential.
 */
const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,p=4,t=3$K0VAUwI4cP7CxzE2oRsLqw$tXRePdnUteK4o5m0sHOgEf1ycIOT9uyVP0hQf5cb4eA';

@Injectable()
export class AuthService {
  constructor(
    @Inject(AuthenticationIdentityRepository)
    private readonly authenticationIdentityRepository: AuthenticationIdentityRepository,

    @Inject(PasswordService)
    private readonly passwordService: PasswordService,

    @Inject(TokenService)
    private readonly tokenService: TokenService,

    @Inject(AuthSessionRepository)
    private readonly authSessionRepository: AuthSessionRepository,

    private readonly mfaService: MfaService,
  ) {}

  async login(input: LoginInput): Promise<AuthenticationResult> {
    const email = input.email.trim().toLowerCase();

    let identity;

    try {
      identity = await this.authenticationIdentityRepository.findByEmail(email);
    } catch {
      throw new ServiceUnavailableException('Authentication state is temporarily unavailable');
    }

    const passwordHash = identity?.passwordHash ?? DUMMY_PASSWORD_HASH;
    const passwordMatches = await this.passwordService.verify(passwordHash, input.password);

    if (
      !identity ||
      identity.status !== 'active' ||
      identity.passwordHash === null ||
      !passwordMatches
    ) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.authenticationIdentityRepository.withVerifiedIdentity(
      identity,
      async (current, executor) => {
        if (current.mfaEnrolledAt) return this.mfaService.challenge(current, executor);
        const enrollment = await this.mfaService.requiredEnrollment(current, executor);
        if (enrollment) return enrollment;
        return this.finishLogin(current, executor);
      },
    );
  }

  verifyMfa(token: string, code: string, recovery = false) {
    return this.mfaService.verify(token, code, recovery, (identity, executor) =>
      this.finishLogin(identity, executor),
    );
  }

  private async finishLogin(
    identity: Identity,
    executor: DatabaseExecutor,
  ): Promise<AuthenticationResult> {
    let memberships;

    try {
      memberships = await this.authenticationIdentityRepository.findActiveMemberships(
        identity.id,
        executor,
      );
    } catch {
      throw new ServiceUnavailableException('Authentication state is temporarily unavailable');
    }

    if (memberships.length === 0) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (memberships.length > 1) {
      const selectionToken = randomBytes(32).toString('base64url');
      try {
        await this.authenticationIdentityRepository.createWorkspaceChallenge(
          identity,
          this.hashSelectionToken(selectionToken),
          executor,
        );
      } catch (error) {
        if (error instanceof UnauthorizedException) throw error;
        throw new ServiceUnavailableException('Authentication state is temporarily unavailable');
      }
      return {
        workspaceRequired: true,
        selectionToken,
        expiresIn: 300,
        memberships: memberships.map(({ membershipId, tenantId, tenantName, displayName }) => ({
          membershipId,
          tenantId,
          tenantName,
          displayName,
        })),
      };
    }

    const membership = memberships[0];

    if (!membership || membership.identityId !== identity.id) {
      throw new ServiceUnavailableException('Authentication principal is not ready for login');
    }

    return this.createMembershipSession(membership, executor);
  }

  async selectMembership(
    selectionToken: string,
    membershipId: string,
  ): Promise<AuthenticationTokens> {
    try {
      return await this.authenticationIdentityRepository.consumeWorkspaceChallenge(
        this.hashSelectionToken(selectionToken),
        membershipId,
        (membership, executor) => this.createMembershipSession(membership, executor),
      );
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof ServiceUnavailableException)
        throw error;
      throw new ServiceUnavailableException('Authentication state is temporarily unavailable');
    }
  }

  async switchMembership(
    auth: AuthenticatedPrincipal,
    membershipId: string,
  ): Promise<AuthenticationTokens> {
    return this.authSessionRepository.switchWorkspace(auth, async (executor) => {
      const memberships = await this.authenticationIdentityRepository.findActiveMemberships(
        auth.identityId,
        executor,
      );
      const membership = memberships.find((candidate) => candidate.membershipId === membershipId);
      if (!membership) throw new UnauthorizedException('Workspace is unavailable');
      return this.createMembershipSession(membership, executor);
    });
  }

  private hashSelectionToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async createMembershipSession(
    membership: ActiveAuthenticationMembership,
    executor?: DatabaseExecutor,
  ): Promise<AuthenticationTokens> {
    const sessionId = randomUUID();
    const principal = {
      identityId: membership.identityId,
      membershipId: membership.membershipId,
      tenantId: membership.tenantId,
      sessionId,
    };
    const tokens = await this.tokenService.createTokens(principal);
    const refreshTokenHash = this.tokenService.hashRefreshToken(tokens.refreshToken);
    const expiresAt = this.tokenService.getExpiration(tokens.refreshToken);

    try {
      const sessionInput = {
        id: sessionId,
        userId: membership.identityId === membership.membershipId ? membership.legacyUserId : null,
        identityId: principal.identityId,
        membershipId: principal.membershipId,
        tenantId: principal.tenantId,
        refreshTokenHash,
        expiresAt,
        absoluteExpiresAt: expiresAt,
      };
      if (executor) await this.authSessionRepository.create(sessionInput, executor);
      else await this.authSessionRepository.create(sessionInput);
    } catch {
      throw new ServiceUnavailableException('Authentication session could not be created');
    }

    return tokens;
  }

  async refresh(refreshToken: string): Promise<AuthenticationTokens> {
    let payload;

    try {
      payload = await this.tokenService.verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const principal: AuthenticationSessionPrincipal = {
      sessionId: payload.sid,
      identityId: payload.sub,
      membershipId: payload.membershipId,
      tenantId: payload.tenantId,
    };

    let session;

    try {
      session = await this.authSessionRepository.findActiveById(principal);
    } catch {
      throw new ServiceUnavailableException('Authentication state is temporarily unavailable');
    }

    if (!session) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (!this.tokenService.matchesRefreshToken(refreshToken, session.refreshTokenHash)) {
      try {
        await this.authSessionRepository.revoke(principal, 'refresh_reuse');
      } catch {
        throw new ServiceUnavailableException('Authentication state is temporarily unavailable');
      }

      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const currentRefreshTokenHash = this.tokenService.hashRefreshToken(refreshToken);
    const tokens = await this.tokenService.createTokens({
      identityId: principal.identityId,
      membershipId: principal.membershipId,
      tenantId: principal.tenantId,
      sessionId: principal.sessionId,
    });
    const newRefreshTokenHash = this.tokenService.hashRefreshToken(tokens.refreshToken);
    const tokenExpiresAt = this.tokenService.getExpiration(tokens.refreshToken);
    const newExpiresAt =
      tokenExpiresAt <= session.absoluteExpiresAt ? tokenExpiresAt : session.absoluteExpiresAt;

    let rotatedSession;

    try {
      rotatedSession = await this.authSessionRepository.rotate(
        principal,
        currentRefreshTokenHash,
        newRefreshTokenHash,
        newExpiresAt,
      );
    } catch {
      throw new ServiceUnavailableException('Authentication state is temporarily unavailable');
    }

    if (!rotatedSession) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    return tokens;
  }

  async logout(refreshToken: string): Promise<void> {
    let payload;

    try {
      payload = await this.tokenService.verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    try {
      await this.authSessionRepository.revoke(
        {
          sessionId: payload.sid,
          identityId: payload.sub,
          membershipId: payload.membershipId,
          tenantId: payload.tenantId,
        },
        'logout',
      );
    } catch {
      throw new ServiceUnavailableException('Authentication state is temporarily unavailable');
    }
  }
}
