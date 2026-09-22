import { SecurityPolicyService } from './security-policy.service.js';
import { randomBytes, randomInt } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { DATABASE } from '../database/database.constants.js';
import { Database } from '../database/database.types.js';
import { identities } from '../database/schema/identities.js';
import { authPasswordResets } from '../database/schema/auth-recovery.js';
import { PasswordService } from './password.service.js';
import { AuthMailService } from './auth-mail.service.js';
import { tokenHash } from './mfa-crypto.js';

@Injectable()
export class PasswordRecoveryService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly passwords: PasswordService,
    private readonly mail: AuthMailService,
    private readonly policies: SecurityPolicyService,
  ) {}
  async forgot(email: string) {
    this.mail.assertConfigured();
    const responseDeadline = Date.now() + 150 + randomInt(50);
    await this.db.transaction(async (tx) => {
      const [identity] = await tx
        .select()
        .from(identities)
        .where(
          and(eq(identities.email, email.trim().toLowerCase()), eq(identities.status, 'active')),
        )
        .for('update');
      if (!identity?.passwordHash) return;
      const [recent] = await tx
        .select({ hash: authPasswordResets.tokenHash })
        .from(authPasswordResets)
        .where(
          and(
            eq(authPasswordResets.identityId, identity.id),
            sql`${authPasswordResets.createdAt} > clock_timestamp() - interval '1 minute'`,
          ),
        )
        .limit(1);
      if (recent) return;
      const token = randomBytes(32).toString('base64url');
      await tx
        .update(authPasswordResets)
        .set({ consumedAt: sql`clock_timestamp()` })
        .where(
          and(
            eq(authPasswordResets.identityId, identity.id),
            isNull(authPasswordResets.consumedAt),
          ),
        );
      await tx.execute(sql`INSERT INTO auth_password_resets (token_hash, identity_id, credentials_updated_at, security_state_updated_at, expires_at)
        SELECT ${tokenHash(token)}, id, credentials_updated_at, security_state_updated_at, clock_timestamp() + interval '30 minutes'
        FROM identities WHERE id = ${identity.id}`);
      await this.mail.enqueue(
        {
          to: identity.email,
          subject: 'Reset your TrackRoster password',
          text: `Use this link within 30 minutes to reset your password:\n\n${this.mail.publicLink('/reset-password', token)}\n\nIf you did not request this, you can ignore this email. Your password has not changed.`,
        },
        new Date(Date.now() + 30 * 60000),
        tx,
      );
    });
    await delay(Math.max(0, responseDeadline - Date.now()));
    return { message: 'If this account supports password recovery, a reset message will be sent.' };
  }
  private validity(hash: string) {
    return and(
      eq(authPasswordResets.tokenHash, hash),
      isNull(authPasswordResets.consumedAt),
      sql`${authPasswordResets.expiresAt} > clock_timestamp()`,
      eq(identities.status, 'active'),
      sql`${authPasswordResets.credentialsUpdatedAt} = ${identities.credentialsUpdatedAt}`,
      sql`${authPasswordResets.securityStateUpdatedAt} = ${identities.securityStateUpdatedAt}`,
    );
  }
  async status(token: string) {
    const [row] = await this.db
      .select({ hash: authPasswordResets.tokenHash })
      .from(authPasswordResets)
      .innerJoin(identities, eq(identities.id, authPasswordResets.identityId))
      .where(this.validity(tokenHash(token)));
    return { valid: !!row };
  }
  async reset(token: string, password: string) {
    const hash = tokenHash(token);
    const [candidate] = await this.db
      .select({ identityId: authPasswordResets.identityId })
      .from(authPasswordResets)
      .where(eq(authPasswordResets.tokenHash, hash));
    if (!candidate) throw new BadRequestException('Invalid or expired reset token');
    const passwordHash = await this.passwords.hash(password);
    await this.db.transaction(async (tx) => {
      await tx
        .select({ id: identities.id })
        .from(identities)
        .where(eq(identities.id, candidate.identityId))
        .for('update');
      const [valid] = await tx
        .select({ identityId: identities.id })
        .from(authPasswordResets)
        .innerJoin(identities, eq(identities.id, authPasswordResets.identityId))
        .where(this.validity(hash));
      if (!valid) throw new BadRequestException('Invalid or expired reset token');
      await this.policies.validatePassword(valid.identityId, password, tx);
      // Existing database trigger revokes all identity sessions atomically. MFA stays enrolled.
      await tx
        .update(identities)
        .set({
          passwordHash,
          credentialsUpdatedAt: sql`greatest(clock_timestamp(), credentials_updated_at + interval '1 microsecond')`,
          updatedAt: sql`clock_timestamp()`,
        })
        .where(eq(identities.id, valid.identityId));
      await tx
        .update(authPasswordResets)
        .set({ consumedAt: sql`clock_timestamp()` })
        .where(
          and(
            eq(authPasswordResets.identityId, valid.identityId),
            isNull(authPasswordResets.consumedAt),
          ),
        );
      await tx.execute(sql`INSERT INTO audit_events (tenant_id, actor_type, action, resource_type, resource_id)
        SELECT DISTINCT tenant_id, 'system'::audit_actor_type, 'password.reset', 'identity', ${valid.identityId} FROM tenant_memberships WHERE identity_id = ${valid.identityId}`);
    });
  }
}
