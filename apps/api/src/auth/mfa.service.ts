import { SecurityPolicyService } from './security-policy.service.js';
import { randomBytes } from 'node:crypto';
import {
  ConflictException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { DATABASE } from '../database/database.constants.js';
import { Database, DatabaseExecutor } from '../database/database.types.js';
import { identities, type Identity } from '../database/schema/identities.js';
import {
  authMfaChallenges,
  authMfaFactors,
  authMfaRecoveryCodes,
} from '../database/schema/auth-mfa.js';
import { authSessions } from '../database/schema/auth-sessions.js';
import { auditEvents } from '../database/schema/audit-events.js';
import { PasswordService } from './password.service.js';
import { AuthSessionRepository } from './auth-session.repository.js';
import { AuthenticatedPrincipal } from './auth.types.js';
import { base32, openSecret, sealSecret, tokenHash, verifyTotp } from './mfa-crypto.js';

@Injectable()
export class MfaService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly config: ConfigService,
    private readonly passwords: PasswordService,
    private readonly sessions: AuthSessionRepository,
    private readonly policies: SecurityPolicyService,
  ) {}

  private key(): Buffer {
    const value = this.config.get<string>('MFA_ENCRYPTION_KEY');
    if (!value || !/^[0-9a-f]{64}$/i.test(value))
      throw new ServiceUnavailableException('MFA is not configured');
    return Buffer.from(value, 'hex');
  }

  async challenge(identity: Identity, executor: DatabaseExecutor) {
    this.key();
    const challengeToken = randomBytes(32).toString('base64url');
    await this.insertChallenge(identity.id, challengeToken, 'login', null, executor);
    return { mfaRequired: true as const, challengeToken, expiresIn: 300 as const };
  }

  private async insertChallenge(
    identityId: string,
    token: string,
    purpose: 'login' | 'enroll',
    encryptedSecret: string | null,
    executor: DatabaseExecutor,
  ) {
    await executor.execute(sql`
      INSERT INTO auth_mfa_challenges
      (token_hash, identity_id, purpose, encrypted_secret, credentials_updated_at, security_state_updated_at, expires_at)
      SELECT ${tokenHash(token)}, id, ${purpose}, ${encryptedSecret}, credentials_updated_at,
        security_state_updated_at, clock_timestamp() + interval '5 minutes'
      FROM identities WHERE id = ${identityId} AND status = 'active'
    `);
  }

  private async authenticatedIdentity(
    auth: AuthenticatedPrincipal,
    password: string,
    executor: DatabaseExecutor,
  ) {
    const [identity] = await executor
      .select()
      .from(identities)
      .where(eq(identities.id, auth.identityId))
      .for('update');
    if (
      !identity ||
      identity.status !== 'active' ||
      !identity.passwordHash ||
      !(await this.passwords.verify(identity.passwordHash, password)) ||
      !(await this.sessions.findActiveById(auth, executor))
    ) {
      throw new UnauthorizedException('Re-authentication required');
    }
    return identity;
  }

  async enroll(auth: AuthenticatedPrincipal, password: string) {
    this.key();
    return this.database.transaction(async (tx) => {
      const identity = await this.authenticatedIdentity(auth, password, tx);
      if (identity.mfaEnrolledAt) throw new ConflictException('MFA is already enrolled');
      return this.startEnrollment(identity, tx);
    });
  }

  async requiredEnrollment(identity: Identity, executor: DatabaseExecutor) {
    if (!(await this.policies.forIdentity(identity.id, executor)).requireMfa) return null;
    return {
      mfaEnrollmentRequired: true as const,
      ...(await this.startEnrollment(identity, executor)),
    };
  }

  private async startEnrollment(identity: Identity, executor: DatabaseExecutor) {
    const key = this.key();
    const secret = randomBytes(20);
    const challengeToken = randomBytes(32).toString('base64url');
    await executor
      .update(authMfaChallenges)
      .set({ consumedAt: sql`clock_timestamp()` })
      .where(
        and(
          eq(authMfaChallenges.identityId, identity.id),
          eq(authMfaChallenges.purpose, 'enroll'),
          isNull(authMfaChallenges.consumedAt),
        ),
      );
    await this.insertChallenge(
      identity.id,
      challengeToken,
      'enroll',
      sealSecret(secret, key, identity.id),
      executor,
    );
    const setupKey = base32(secret);
    const parameters = new URLSearchParams({
      secret: setupKey,
      issuer: 'TrackRoster',
      algorithm: 'SHA1',
      digits: '6',
      period: '30',
    });
    return {
      challengeToken,
      setupKey,
      otpauthUri: `otpauth://totp/${encodeURIComponent(`TrackRoster:${identity.email}`)}?${parameters}`,
      expiresIn: 300,
    };
  }

  async verify<T>(
    token: string,
    code: string,
    recovery: boolean,
    finishLogin: (identity: Identity, executor: DatabaseExecutor) => Promise<T>,
  ): Promise<T | { enrolled: true; recoveryCodes: string[] }> {
    const hash = tokenHash(token);
    // Locate first, then take the identity lock before any other mutable auth rows.
    const [candidate] = await this.database
      .select({ identityId: authMfaChallenges.identityId })
      .from(authMfaChallenges)
      .where(eq(authMfaChallenges.tokenHash, hash));
    if (!candidate) throw new UnauthorizedException('Invalid or expired MFA challenge');
    const result = await this.database.transaction(async (tx) => {
      const [identity] = await tx
        .select()
        .from(identities)
        .where(eq(identities.id, candidate.identityId))
        .for('update');
      if (!identity || identity.status !== 'active') return null;
      const [challenge] = await tx
        .select()
        .from(authMfaChallenges)
        .where(
          and(
            eq(authMfaChallenges.tokenHash, hash),
            isNull(authMfaChallenges.consumedAt),
            sql`${authMfaChallenges.expiresAt} > clock_timestamp()`,
            sql`${authMfaChallenges.attempts} < 5`,
            sql`${authMfaChallenges.credentialsUpdatedAt} = (SELECT credentials_updated_at FROM identities WHERE id = ${identity.id})`,
            sql`${authMfaChallenges.securityStateUpdatedAt} = (SELECT security_state_updated_at FROM identities WHERE id = ${identity.id})`,
          ),
        )
        .for('update');
      if (!challenge || (recovery && challenge.purpose !== 'login')) return null;
      // Commit failed attempts too, to bound guessing independently of IP throttling.
      await tx
        .update(authMfaChallenges)
        .set({ attempts: challenge.attempts + 1 })
        .where(eq(authMfaChallenges.tokenHash, hash));
      if (challenge.purpose === 'enroll') {
        if (identity.mfaEnrolledAt || !challenge.encryptedSecret) return null;
        const step = verifyTotp(
          openSecret(challenge.encryptedSecret, this.key(), identity.id),
          code,
          -1,
        );
        if (step === null) return null;
        await tx.insert(authMfaFactors).values({
          identityId: identity.id,
          encryptedSecret: challenge.encryptedSecret,
          lastUsedStep: step,
        });
        const recoveryCodes = await this.replaceRecoveryCodes(identity.id, tx);
        await tx
          .update(identities)
          .set({
            securityStateUpdatedAt: sql`greatest(clock_timestamp(), security_state_updated_at + interval '1 microsecond')`,
            mfaEnrolledAt: sql`clock_timestamp()`,
            mfaRecoveryCodesRotatedAt: sql`clock_timestamp()`,
          })
          .where(eq(identities.id, identity.id));
        await this.securityChanged(identity.id, 'mfa.enrolled', tx);
        await tx
          .update(authMfaChallenges)
          .set({ consumedAt: sql`clock_timestamp()` })
          .where(eq(authMfaChallenges.tokenHash, hash));
        return { enrolled: true as const, recoveryCodes };
      }
      if (!identity.mfaEnrolledAt) return null;
      if (recovery) {
        const [used] = await tx
          .update(authMfaRecoveryCodes)
          .set({ usedAt: sql`clock_timestamp()` })
          .where(
            and(
              eq(authMfaRecoveryCodes.identityId, identity.id),
              eq(authMfaRecoveryCodes.codeHash, tokenHash(code)),
              isNull(authMfaRecoveryCodes.usedAt),
            ),
          )
          .returning();
        if (!used) return null;
        await this.audit(identity.id, 'mfa.recovery_used', tx);
      } else if (!(await this.consumeTotp(identity.id, code, tx))) return null;
      await tx
        .update(authMfaChallenges)
        .set({ consumedAt: sql`clock_timestamp()` })
        .where(eq(authMfaChallenges.tokenHash, hash));
      await this.audit(identity.id, 'mfa.verified', tx);
      return finishLogin(identity, tx);
    });
    if (!result) throw new UnauthorizedException('Invalid or expired MFA challenge');
    return result;
  }

  // Caller must hold the identity lock and verify the current password first.
  consumeInvitationCode(identityId: string, code: string, executor: DatabaseExecutor) {
    return this.consumeTotp(identityId, code, executor);
  }

  private async consumeTotp(
    identityId: string,
    code: string,
    executor: DatabaseExecutor,
  ): Promise<boolean> {
    const [factor] = await executor
      .select()
      .from(authMfaFactors)
      .where(eq(authMfaFactors.identityId, identityId))
      .for('update');
    if (!factor) return false;
    const step = verifyTotp(
      openSecret(factor.encryptedSecret, this.key(), identityId),
      code,
      factor.lastUsedStep,
    );
    if (step === null) return false;
    await executor
      .update(authMfaFactors)
      .set({ lastUsedStep: step })
      .where(eq(authMfaFactors.identityId, identityId));
    return true;
  }

  private async replaceRecoveryCodes(identityId: string, executor: DatabaseExecutor) {
    const codes = Array.from({ length: 10 }, () => randomBytes(16).toString('hex'));
    await executor
      .delete(authMfaRecoveryCodes)
      .where(eq(authMfaRecoveryCodes.identityId, identityId));
    await executor
      .insert(authMfaRecoveryCodes)
      .values(codes.map((code) => ({ identityId, codeHash: tokenHash(code) })));
    return codes;
  }

  async regenerate(auth: AuthenticatedPrincipal, password: string, code: string) {
    return this.database.transaction(async (tx) => {
      const identity = await this.authenticatedIdentity(auth, password, tx);
      if (!identity.mfaEnrolledAt || !(await this.consumeTotp(identity.id, code, tx)))
        throw new UnauthorizedException('Invalid authenticator code');
      const recoveryCodes = await this.replaceRecoveryCodes(identity.id, tx);
      await tx
        .update(identities)
        .set({
          securityStateUpdatedAt: sql`greatest(clock_timestamp(), security_state_updated_at + interval '1 microsecond')`,
          mfaRecoveryCodesRotatedAt: sql`clock_timestamp()`,
        })
        .where(eq(identities.id, identity.id));
      await this.securityChanged(identity.id, 'mfa.recovery_codes_regenerated', tx);
      return { recoveryCodes };
    });
  }

  async disable(auth: AuthenticatedPrincipal, password: string, code: string) {
    await this.database.transaction(async (tx) => {
      const identity = await this.authenticatedIdentity(auth, password, tx);
      if (!identity.mfaEnrolledAt || !(await this.consumeTotp(identity.id, code, tx)))
        throw new UnauthorizedException('Invalid authenticator code');
      if ((await this.policies.forIdentity(identity.id, tx)).requireMfa)
        throw new ConflictException('A workspace security policy requires MFA');
      await tx.delete(authMfaFactors).where(eq(authMfaFactors.identityId, identity.id));
      await tx.delete(authMfaRecoveryCodes).where(eq(authMfaRecoveryCodes.identityId, identity.id));
      await tx
        .update(identities)
        .set({
          securityStateUpdatedAt: sql`greatest(clock_timestamp(), security_state_updated_at + interval '1 microsecond')`,
          mfaEnrolledAt: null,
          mfaRecoveryCodesRotatedAt: null,
        })
        .where(eq(identities.id, identity.id));
      await this.securityChanged(identity.id, 'mfa.disabled', tx);
    });
  }

  private async securityChanged(identityId: string, action: string, executor: DatabaseExecutor) {
    await executor
      .update(identities)
      .set({
        securityStateUpdatedAt: sql`greatest(clock_timestamp(), security_state_updated_at + interval '1 microsecond')`,
        updatedAt: sql`clock_timestamp()`,
      })
      .where(eq(identities.id, identityId));
    await executor
      .update(authSessions)
      .set({
        revokedAt: sql`clock_timestamp()`,
        updatedAt: sql`clock_timestamp()`,
        revokedReason: action,
      })
      .where(and(eq(authSessions.identityId, identityId), isNull(authSessions.revokedAt)));
    await this.audit(identityId, action, executor);
  }

  private async audit(identityId: string, action: string, executor: DatabaseExecutor) {
    // One event per workspace, without exposing other workspace identifiers.
    await executor.execute(sql`INSERT INTO ${auditEvents} (tenant_id, actor_type, action, resource_type, resource_id)
      SELECT DISTINCT tenant_id, 'system'::audit_actor_type, ${action}, 'identity', ${identityId}
      FROM tenant_memberships WHERE identity_id = ${identityId}`);
  }
}
