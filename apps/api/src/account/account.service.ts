import { membershipResourceScopes } from '../database/schema/resource-scopes.js';
import { assertResourceMatches, resourceETag } from '../http/resource-etag.js';
import { publicTenantRoles } from '../authorization/public-roles.js';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, eq, gt, isNull, ne, sql } from 'drizzle-orm';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { AuditService } from '../audit/audit.service.js';
import { DATABASE } from '../database/database.constants.js';
import type { Database, DatabaseExecutor } from '../database/database.types.js';
import { accountSettings } from '../database/schema/account-settings.js';
import { authSessions } from '../database/schema/auth-sessions.js';
import { identities } from '../database/schema/identities.js';
import { tenantMemberships } from '../database/schema/tenant-memberships.js';
import { tenants } from '../database/schema/tenants.js';
import { userAccessGrants } from '../database/schema/user-access-grants.js';
import { ListSessionsDto, UpdateAccountDto, UpdatePreferencesDto } from './account.dto.js';

@Injectable()
export class AccountService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly audit: AuditService,
  ) {}

  async get(auth: AuthenticatedPrincipal, executor: DatabaseExecutor = this.database) {
    const [account] = await executor
      .select({
        identityId: identities.id,
        email: identities.email,
        membershipId: tenantMemberships.id,
        tenantId: tenants.id,
        tenantName: tenants.name,
        displayName: tenantMemberships.displayName,
        phone: accountSettings.phone,
        avatar: accountSettings.avatar,
        locale: sql<string>`coalesce(${accountSettings.locale}, 'en')`,
        timezone: sql<string>`coalesce(${accountSettings.timezone}, 'UTC')`,
        /*
         * Whether a second factor is enrolled, as a boolean only. The
         * enrolment timestamp and the factor itself stay server-side; the
         * account screen needs to know on/off and nothing more.
         */
        mfaEnabled: sql<boolean>`${identities.mfaEnrolledAt} IS NOT NULL`,
      })
      .from(tenantMemberships)
      .innerJoin(identities, eq(identities.id, tenantMemberships.identityId))
      .innerJoin(tenants, eq(tenants.id, tenantMemberships.tenantId))
      .leftJoin(
        accountSettings,
        and(
          eq(accountSettings.tenantId, tenantMemberships.tenantId),
          eq(accountSettings.membershipId, tenantMemberships.id),
        ),
      )
      .where(
        and(
          eq(tenantMemberships.tenantId, auth.tenantId),
          eq(tenantMemberships.id, auth.membershipId),
          eq(identities.id, auth.identityId),
        ),
      );
    if (!account) throw new NotFoundException('Account not found');
    return {
      ...account,
      userId: account.membershipId,
      grants: await this.permissions(auth, executor),
      // Keep profile writes conditional on fields this endpoint can edit. The
      // grants and workspace labels are derived access data and may change
      // while the profile form is open without changing the profile itself.
      etag: resourceETag({
        identityId: account.identityId,
        membershipId: account.membershipId,
        displayName: account.displayName,
        phone: account.phone,
        avatar: account.avatar,
        locale: account.locale,
        timezone: account.timezone,
      }),
    };
  }

  /*
   * Read through a definer function (migration 0076). This lists every
   * workspace the account belongs to, which is a cross-tenant question, while
   * the request itself is scoped to the workspace the caller is currently in —
   * so under RLS a direct query returns only that one and the switcher has
   * nothing to switch to. The function is restricted to the caller's own
   * identity, so it discloses no more than the session already does.
   */
  async memberships(auth: AuthenticatedPrincipal) {
    const result = await this.database.execute<{
      membership_id: string;
      tenant_id: string;
      tenant_name: string;
      display_name: string | null;
      roles: string[];
    }>(sql`SELECT * FROM trackroster_identity_workspaces(${auth.identityId}::uuid)`);

    return result.rows.map((row) => ({
      membershipId: row.membership_id,
      tenantId: row.tenant_id,
      tenantName: row.tenant_name,
      displayName: row.display_name,
      current: row.membership_id === auth.membershipId,
      roles: row.roles,
    }));
  }

  async permissions(auth: AuthenticatedPrincipal, executor: DatabaseExecutor = this.database) {
    const grants = await executor
      .select({
        role: userAccessGrants.role,
        scopeType: userAccessGrants.scopeType,
        organizationId: userAccessGrants.organizationId,
        teamId: userAccessGrants.teamId,
      })
      .from(userAccessGrants)
      .where(
        and(
          eq(userAccessGrants.tenantId, auth.tenantId),
          eq(userAccessGrants.userId, auth.membershipId),
        ),
      )
      .orderBy(asc(userAccessGrants.role), asc(userAccessGrants.id));
    const resources = await executor
      .select({
        role: membershipResourceScopes.role,
        scopeType: membershipResourceScopes.scopeType,
        campaignId: membershipResourceScopes.campaignId,
        territoryId: membershipResourceScopes.territoryId,
        accessLevel: membershipResourceScopes.accessLevel,
      })
      .from(membershipResourceScopes)
      .where(
        and(
          eq(membershipResourceScopes.tenantId, auth.tenantId),
          eq(membershipResourceScopes.userId, auth.membershipId),
        ),
      )
      .orderBy(membershipResourceScopes.id);
    return [...grants, ...resources].map((grant) => ({
      ...grant,
      role: publicTenantRoles[grant.role],
    }));
  }

  async update(auth: AuthenticatedPrincipal, input: UpdateAccountDto, ifMatch?: string) {
    if (!Object.values(input).some((value) => value !== undefined))
      throw new BadRequestException('At least one account field is required');
    await this.database.transaction(async (transaction) => {
      await this.lockMembership(auth, transaction);
      assertResourceMatches(ifMatch, await this.get(auth, transaction));
      if (input.displayName !== undefined) {
        await transaction
          .update(tenantMemberships)
          .set({ displayName: input.displayName, updatedAt: sql`CURRENT_TIMESTAMP` })
          .where(
            and(
              eq(tenantMemberships.tenantId, auth.tenantId),
              eq(tenantMemberships.id, auth.membershipId),
            ),
          );
      }
      const settings = {
        phone: input.phone,
        locale: input.locale,
        timezone: input.timezone,
        avatar: input.avatar,
      };
      if (Object.values(settings).some((value) => value !== undefined)) {
        await transaction
          .insert(accountSettings)
          .values({ membershipId: auth.membershipId, tenantId: auth.tenantId, ...settings })
          .onConflictDoUpdate({
            target: accountSettings.membershipId,
            set: { ...settings, updatedAt: sql`CURRENT_TIMESTAMP` },
          });
      }
      await this.audit.record(
        {
          tenantId: auth.tenantId,
          actorType: 'user',
          actorUserId: auth.membershipId,
          action: 'account.updated',
          resourceType: 'tenant_membership',
          resourceId: auth.membershipId,
          metadata: {
            fields: Object.keys(input).filter(
              (key) => input[key as keyof UpdateAccountDto] !== undefined,
            ),
          },
        },
        transaction,
      );
    });
    return this.get(auth);
  }

  async preferences(auth: AuthenticatedPrincipal, executor: DatabaseExecutor = this.database) {
    const [settings] = await executor
      .select({ preferences: accountSettings.preferences })
      .from(accountSettings)
      .where(
        and(
          eq(accountSettings.tenantId, auth.tenantId),
          eq(accountSettings.membershipId, auth.membershipId),
        ),
      );
    return {
      theme: 'system',
      density: 'comfortable',
      reducedMotion: false,
      highContrast: false,
      ...settings?.preferences,
    };
  }

  async updatePreferences(
    auth: AuthenticatedPrincipal,
    input: UpdatePreferencesDto,
    ifMatch?: string,
  ) {
    if (!Object.values(input).some((value) => value !== undefined))
      throw new BadRequestException('At least one preference is required');
    await this.database.transaction(async (transaction) => {
      await this.lockMembership(auth, transaction);
      assertResourceMatches(ifMatch, await this.preferences(auth, transaction));
      await transaction
        .insert(accountSettings)
        .values({ membershipId: auth.membershipId, tenantId: auth.tenantId, preferences: input })
        .onConflictDoUpdate({
          target: accountSettings.membershipId,
          set: {
            preferences: sql`${accountSettings.preferences} || ${JSON.stringify(input)}::jsonb`,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          },
        });
    });
    return this.preferences(auth);
  }

  async sessions(auth: AuthenticatedPrincipal, query: ListSessionsDto) {
    const rows = await this.database
      .select({
        id: authSessions.id,
        createdAt: authSessions.createdAt,
        expiresAt: authSessions.expiresAt,
        absoluteExpiresAt: authSessions.absoluteExpiresAt,
        current: sql<boolean>`${authSessions.id} = ${auth.sessionId}`,
      })
      .from(authSessions)
      .where(
        and(
          this.sessionScope(auth),
          isNull(authSessions.revokedAt),
          gt(authSessions.expiresAt, sql`CURRENT_TIMESTAMP`),
          gt(authSessions.absoluteExpiresAt, sql`CURRENT_TIMESTAMP`),
          query.cursor ? gt(authSessions.id, query.cursor) : undefined,
        ),
      )
      .orderBy(asc(authSessions.id))
      .limit(query.limit + 1);
    return {
      items: rows.slice(0, query.limit),
      nextCursor: rows.length > query.limit ? rows[query.limit - 1]!.id : null,
    };
  }

  async revokeSessions(auth: AuthenticatedPrincipal, sessionId?: string) {
    return this.database.transaction(async (transaction) => {
      const rows = await transaction
        .update(authSessions)
        .set({
          revokedAt: sql`CURRENT_TIMESTAMP`,
          revokedReason: 'account_session_revoked',
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(
          and(
            this.sessionScope(auth),
            isNull(authSessions.revokedAt),
            sessionId ? eq(authSessions.id, sessionId) : ne(authSessions.id, auth.sessionId),
          ),
        )
        .returning({ id: authSessions.id });
      if (sessionId && rows.length === 0) {
        const [existing] = await transaction
          .select({ id: authSessions.id })
          .from(authSessions)
          .where(and(this.sessionScope(auth), eq(authSessions.id, sessionId)));
        if (!existing) throw new NotFoundException('Session not found');
      }
      for (const row of rows)
        await this.audit.record(
          {
            tenantId: auth.tenantId,
            actorType: 'user',
            actorUserId: auth.membershipId,
            action: 'session.revoked',
            resourceType: 'auth_session',
            resourceId: row.id,
            metadata: { reason: 'account_session_revoked' },
          },
          transaction,
        );
      return { revoked: rows.length };
    });
  }

  private async lockMembership(auth: AuthenticatedPrincipal, executor: DatabaseExecutor) {
    const [membership] = await executor
      .select({ id: tenantMemberships.id })
      .from(tenantMemberships)
      .where(
        and(
          eq(tenantMemberships.tenantId, auth.tenantId),
          eq(tenantMemberships.id, auth.membershipId),
        ),
      )
      .for('update');
    if (!membership) throw new NotFoundException('Account not found');
  }

  private sessionScope(auth: AuthenticatedPrincipal) {
    return and(
      eq(authSessions.tenantId, auth.tenantId),
      eq(authSessions.membershipId, auth.membershipId),
      eq(authSessions.identityId, auth.identityId),
    );
  }
}
