import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { DATABASE } from '../database/database.constants.js';
import { Database, DatabaseExecutor } from '../database/database.types.js';
import {
  auditEvents,
  identities,
  membershipInvitations,
  organizations,
  platformAccessGrants,
  teams,
  tenantMemberships,
  tenants,
  userAccessGrants,
} from '../database/schema/index.js';
import { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { AuthMailService } from '../auth/auth-mail.service.js';
import { PasswordService } from '../auth/password.service.js';
import { SecurityPolicyService } from '../auth/security-policy.service.js';
import { MfaService } from '../auth/mfa.service.js';
import { withTenantContext } from '../database/tenant-context.js';
import { tokenHash } from '../auth/mfa-crypto.js';
import {
  AcceptInvitationDto,
  CreateInvitationDto,
  CreatePlatformInvitationDto,
} from './invitation.dto.js';

@Injectable()
export class InvitationService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly mail: AuthMailService,
    private readonly passwords: PasswordService,
    private readonly policies: SecurityPolicyService,
    private readonly mfa: MfaService,
  ) {}

  async invite(auth: AuthenticatedPrincipal, input: CreateInvitationDto) {
    this.mail.assertConfigured();
    return this.db.transaction(async (tx) => {
      const role =
        input.role === 'tenant_admin'
          ? 'client_admin'
          : input.role === 'auditor'
            ? 'observer'
            : input.role;
      const scopeType = input.teamId ? 'team' : input.organizationId ? 'organization' : 'tenant';
      if (
        (role === 'client_admin' && scopeType !== 'tenant') ||
        (role === 'director' && scopeType !== 'organization') ||
        (['manager', 'prospector'].includes(role) && scopeType !== 'team') ||
        (input.teamId && !input.organizationId)
      )
        throw new BadRequestException('Role and initial scope do not match');
      if (input.organizationId) {
        const [org] = await tx
          .select()
          .from(organizations)
          .where(
            and(
              eq(organizations.id, input.organizationId),
              eq(organizations.tenantId, auth.tenantId),
              eq(organizations.status, 'active'),
            ),
          )
          .for('share');
        if (!org) throw new NotFoundException('Organization is unavailable');
      }
      if (input.teamId) {
        const [team] = await tx
          .select()
          .from(teams)
          .where(
            and(
              eq(teams.id, input.teamId),
              eq(teams.tenantId, auth.tenantId),
              eq(teams.organizationId, input.organizationId!),
              eq(teams.status, 'active'),
            ),
          )
          .for('share');
        if (!team) throw new NotFoundException('Team is unavailable');
      }
      const email = input.email.trim().toLowerCase();
      await tx
        .insert(identities)
        .values({ email })
        .onConflictDoNothing({ target: identities.email });
      const [identity] = await tx
        .select()
        .from(identities)
        .where(eq(identities.email, email))
        .for('update');
      if (!identity || identity.status !== 'active')
        throw new ConflictException('This invitation cannot be created');
      const [existing] = await tx
        .select()
        .from(tenantMemberships)
        .where(
          and(
            eq(tenantMemberships.tenantId, auth.tenantId),
            eq(tenantMemberships.identityId, identity.id),
          ),
        );
      if (existing)
        throw new ConflictException('This workspace already has a membership for this email');
      const [membership] = await tx
        .insert(tenantMemberships)
        .values({
          tenantId: auth.tenantId,
          identityId: identity.id,
          status: 'invited',
          invitedAt: sql`clock_timestamp()`,
          displayName: input.displayName,
          defaultOrganizationId: input.organizationId,
          defaultTeamId: input.teamId,
        })
        .returning();
      await tx.insert(userAccessGrants).values({
        tenantId: auth.tenantId,
        userId: membership!.id,
        role,
        scopeType,
        organizationId: input.organizationId,
        teamId: input.teamId,
      });
      await this.issue(membership!.id, auth.tenantId, identity.email, tx);
      await this.audit(
        auth,
        membership!.id,
        'membership.invited',
        { role: input.role, scopeType, organizationId: input.organizationId, teamId: input.teamId },
        tx,
      );
      return {
        membershipId: membership!.id,
        tenantId: auth.tenantId,
        email,
        status: 'invited',
        role: input.role,
      };
    });
  }

  async resend(auth: AuthenticatedPrincipal, membershipId: string) {
    this.mail.assertConfigured();
    return this.db.transaction(async (tx) => {
      const [member] = await tx
        .select()
        .from(tenantMemberships)
        .where(
          and(
            eq(tenantMemberships.id, membershipId),
            eq(tenantMemberships.tenantId, auth.tenantId),
          ),
        )
        .for('update');
      if (!member) throw new NotFoundException('Membership not found');
      if (member.status !== 'invited')
        throw new ConflictException('Only pending invitations can be resent');
      const [identity] = await tx
        .select()
        .from(identities)
        .where(eq(identities.id, member.identityId));
      if (!identity || identity.status !== 'active')
        throw new ConflictException('This invitation cannot be sent');
      const [previous] = await tx
        .select()
        .from(membershipInvitations)
        .where(eq(membershipInvitations.membershipId, member.id))
        .orderBy(desc(membershipInvitations.createdAt))
        .limit(1);
      if (previous && previous.createdAt > new Date(Date.now() - 60_000))
        throw new ConflictException('Wait one minute before resending');
      await this.issue(
        member.id,
        auth.tenantId,
        identity.email,
        tx,
        previous?.platformRole
          ? {
              platformRole: previous.platformRole,
              platformGrantReason: previous.platformGrantReason!,
              platformGrantedByIdentityId: previous.platformGrantedByIdentityId!,
            }
          : undefined,
      );
      await this.audit(auth, member.id, 'membership.invitation_resent', {}, tx);
      return { membershipId: member.id, status: 'invited' };
    });
  }

  /**
   * Platform invitations deliberately use a separate endpoint and a minimal
   * tenant observer membership. The membership is only the login anchor; the
   * platform grant is activated atomically when the invitee accepts.
   */
  async invitePlatformAdmin(auth: AuthenticatedPrincipal, input: CreatePlatformInvitationDto) {
    this.mail.assertConfigured();
    return this.db.transaction(async (tx) => {
      const email = input.email.trim().toLowerCase();
      await tx
        .insert(identities)
        .values({ email })
        .onConflictDoNothing({ target: identities.email });
      const [identity] = await tx
        .select()
        .from(identities)
        .where(eq(identities.email, email))
        .for('update');
      if (!identity || identity.status !== 'active')
        throw new ConflictException('This invitation cannot be created');

      const [existingGrant] = await tx
        .select({ id: platformAccessGrants.id })
        .from(platformAccessGrants)
        .where(
          and(
            eq(platformAccessGrants.identityId, identity.id),
            eq(platformAccessGrants.role, 'super_admin'),
            isNull(platformAccessGrants.revokedAt),
          ),
        )
        .limit(1);
      if (existingGrant)
        throw new ConflictException('This identity is already a super administrator');

      const [existingMembership] = await tx
        .select({ id: tenantMemberships.id })
        .from(tenantMemberships)
        .where(
          and(
            eq(tenantMemberships.tenantId, auth.tenantId),
            eq(tenantMemberships.identityId, identity.id),
          ),
        )
        .limit(1);
      if (existingMembership)
        throw new ConflictException('This identity already has a membership in this workspace');

      const [membership] = await tx
        .insert(tenantMemberships)
        .values({
          tenantId: auth.tenantId,
          identityId: identity.id,
          status: 'invited',
          invitedAt: sql`clock_timestamp()`,
          displayName: input.displayName,
        })
        .returning();
      await tx.insert(userAccessGrants).values({
        tenantId: auth.tenantId,
        userId: membership!.id,
        role: 'observer',
        scopeType: 'tenant',
      });
      await this.issue(membership!.id, auth.tenantId, identity.email, tx, {
        platformRole: 'super_admin',
        platformGrantReason: input.reason,
        platformGrantedByIdentityId: auth.identityId,
      });
      await this.audit(
        auth,
        membership!.id,
        'platform.user_invited',
        { email, role: 'super_admin', reason: input.reason },
        tx,
      );
      return {
        membershipId: membership!.id,
        tenantId: auth.tenantId,
        email,
        status: 'invited',
        role: 'super_admin',
      };
    });
  }

  private async issue(
    membershipId: string,
    tenantId: string,
    email: string,
    executor: DatabaseExecutor,
    platform?: {
      platformRole: 'super_admin' | 'support_operator';
      platformGrantReason: string;
      platformGrantedByIdentityId: string;
    },
  ) {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 7 * 86400000);
    await executor
      .update(membershipInvitations)
      .set({ consumedAt: sql`clock_timestamp()` })
      .where(
        and(
          eq(membershipInvitations.membershipId, membershipId),
          isNull(membershipInvitations.consumedAt),
        ),
      );
    await executor.insert(membershipInvitations).values({
      tokenHash: tokenHash(token),
      membershipId,
      tenantId,
      expiresAt,
      platformRole: platform?.platformRole,
      platformGrantReason: platform?.platformGrantReason,
      platformGrantedByIdentityId: platform?.platformGrantedByIdentityId,
    });
    await this.mail.enqueue(
      {
        to: email,
        subject: 'Your TrackRoster workspace invitation',
        text: `You have been invited to a TrackRoster workspace. Accept within seven days:\n\n${this.mail.publicLink('/accept-invitation', token)}\n\nExisting accounts must confirm their current password and authenticator code when MFA is enabled.`,
      },
      expiresAt,
      executor,
    );
  }

  private valid(hash: string) {
    return and(
      eq(membershipInvitations.tokenHash, hash),
      isNull(membershipInvitations.consumedAt),
      sql`${membershipInvitations.expiresAt} > clock_timestamp()`,
      sql`${membershipInvitations.attempts} < 10`,
      eq(tenantMemberships.status, 'invited'),
      eq(tenants.status, 'active'),
      eq(identities.status, 'active'),
    );
  }
  private invitationQuery(executor: DatabaseExecutor) {
    return executor
      .select({
        invitation: membershipInvitations,
        identity: identities,
        workspaceName: tenants.name,
      })
      .from(membershipInvitations)
      .innerJoin(
        tenantMemberships,
        and(
          eq(tenantMemberships.id, membershipInvitations.membershipId),
          eq(tenantMemberships.tenantId, membershipInvitations.tenantId),
        ),
      )
      .innerJoin(identities, eq(identities.id, tenantMemberships.identityId))
      .innerJoin(tenants, eq(tenants.id, membershipInvitations.tenantId));
  }
  /*
   * Invitation acceptance is unauthenticated, so there is no tenant context to
   * read `membership_invitations` under, and its RLS policy answers a
   * context-free read with zero rows. This resolves the tenant the token
   * belongs to through a definer function that returns nothing else (migration
   * 0074), so the lookup and the writes that follow can run under the normal
   * policies. Validity is still decided by `valid()`, not here.
   */
  private async tenantForToken(hash: string): Promise<string | null> {
    const result = await this.db.execute<{ tenant_id: string | null }>(
      sql`select trackroster_invitation_tenant(${hash}) as tenant_id`,
    );

    return result.rows[0]?.tenant_id ?? null;
  }

  async preview(token: string) {
    const hash = tokenHash(token);
    const tenantId = await this.tenantForToken(hash);
    if (!tenantId) throw new NotFoundException('Invalid or expired invitation');
    const [row] = await withTenantContext(this.db, tenantId, (tx) =>
      this.invitationQuery(tx).where(this.valid(hash)),
    );
    if (!row) throw new NotFoundException('Invalid or expired invitation');
    const [local, domain] = row.identity.email.split('@');
    return {
      workspaceName: row.workspaceName,
      emailHint: `${local!.slice(0, 1)}***@${domain}`,
      expiresAt: row.invitation.expiresAt,
      existingAccount: !!row.identity.passwordHash,
      mfaRequired: !!row.identity.mfaEnrolledAt,
      platformRole: row.invitation.platformRole ?? null,
    };
  }
  async accept(token: string, input: AcceptInvitationDto) {
    const hash = tokenHash(token);
    const invitationTenantId = await this.tenantForToken(hash);
    if (!invitationTenantId) throw new BadRequestException('Invalid or expired invitation');
    const [candidate] = await withTenantContext(this.db, invitationTenantId, (tx) =>
      this.invitationQuery(tx).where(this.valid(hash)),
    );
    if (!candidate) throw new BadRequestException('Invalid or expired invitation');
    const result = await withTenantContext(this.db, invitationTenantId, async (tx) => {
      await tx
        .select({ id: identities.id })
        .from(identities)
        .where(eq(identities.id, candidate.identity.id))
        .for('update');
      await tx
        .select({ id: tenantMemberships.id })
        .from(tenantMemberships)
        .where(eq(tenantMemberships.id, candidate.invitation.membershipId))
        .for('update');
      const [current] = await this.invitationQuery(tx).where(this.valid(hash));
      if (!current) return null;
      await tx
        .update(membershipInvitations)
        .set({ attempts: current.invitation.attempts + 1 })
        .where(eq(membershipInvitations.tokenHash, hash));
      if (current.identity.passwordHash) {
        if (!(await this.passwords.verify(current.identity.passwordHash, input.password)))
          return null;
        if (
          current.identity.mfaEnrolledAt &&
          (!input.mfaCode ||
            !(await this.mfa.consumeInvitationCode(current.identity.id, input.mfaCode, tx)))
        )
          return null;
      } else {
        await this.policies.validatePassword(
          current.identity.id,
          input.password,
          tx,
          current.invitation.tenantId,
        );
        await tx
          .update(identities)
          .set({
            passwordHash: await this.passwords.hash(input.password),
            credentialsUpdatedAt: sql`greatest(clock_timestamp(), credentials_updated_at + interval '1 microsecond')`,
            updatedAt: sql`clock_timestamp()`,
          })
          .where(eq(identities.id, current.identity.id));
      }
      await tx
        .update(identities)
        .set({
          emailVerifiedAt: sql`coalesce(email_verified_at, clock_timestamp())`,
          updatedAt: sql`clock_timestamp()`,
        })
        .where(eq(identities.id, current.identity.id));
      await tx
        .update(tenantMemberships)
        .set({
          status: 'active',
          activatedAt: sql`clock_timestamp()`,
          updatedAt: sql`clock_timestamp()`,
        })
        .where(eq(tenantMemberships.id, current.invitation.membershipId));
      await tx
        .update(membershipInvitations)
        .set({ consumedAt: sql`clock_timestamp()` })
        .where(eq(membershipInvitations.tokenHash, hash));
      if (current.invitation.platformRole) {
        await tx.insert(platformAccessGrants).values({
          identityId: current.identity.id,
          role: current.invitation.platformRole,
          grantSource: 'platform_admin',
          grantedByIdentityId: current.invitation.platformGrantedByIdentityId!,
          grantReason: current.invitation.platformGrantReason!,
          externalReference: `invitation:${current.invitation.membershipId}`,
        });
        await tx.insert(auditEvents).values({
          tenantId: current.invitation.tenantId,
          actorType: 'user',
          actorUserId: current.invitation.membershipId,
          action: 'platform.user_granted',
          resourceType: 'identity',
          resourceId: current.identity.id,
          metadata: { role: current.invitation.platformRole, source: 'invitation' },
        });
      }
      await tx.insert(auditEvents).values({
        tenantId: current.invitation.tenantId,
        actorType: 'user',
        actorUserId: current.invitation.membershipId,
        action: 'membership.invitation_accepted',
        resourceType: 'tenant_membership',
        resourceId: current.invitation.membershipId,
      });
      return {
        accepted: true,
        membershipId: current.invitation.membershipId,
        signInRequired: true,
      };
    });
    if (!result) throw new UnauthorizedException('Invalid invitation or account credentials');
    return result;
  }
  private async audit(
    auth: AuthenticatedPrincipal,
    id: string,
    action: string,
    metadata: Record<string, unknown>,
    executor: DatabaseExecutor,
  ) {
    await executor.insert(auditEvents).values({
      tenantId: auth.tenantId,
      actorType: 'user',
      actorUserId: auth.membershipId,
      action,
      resourceType: 'tenant_membership',
      resourceId: id,
      metadata,
    });
  }
}
