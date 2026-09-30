import { activeRoster } from '../organization-structure/structure-access.js';
import { assertResourceMatches } from '../http/resource-etag.js';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, count, eq, gt, ilike, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { DATABASE } from '../database/database.constants.js';
import type {
  Database,
  DatabaseExecutor,
  DatabaseTransaction,
} from '../database/database.types.js';
import { campaignProspectAssignments } from '../database/schema/campaign-prospect-assignments.js';
import { campaigns } from '../database/schema/campaigns.js';
import { identities } from '../database/schema/identities.js';
import { organizations } from '../database/schema/organizations.js';
import { teams } from '../database/schema/teams.js';
import { tenantMemberships } from '../database/schema/tenant-memberships.js';
import { tenants } from '../database/schema/tenants.js';
import { teamSettings, tenantSettings } from '../database/schema/workspace-settings.js';
import { userAccessGrants } from '../database/schema/user-access-grants.js';
import {
  CreateOrganizationDto,
  CreateTeamDto,
  ListTeamsDto,
  ListWorkspaceResourcesDto,
  UpdateOrganizationDto,
  UpdateTeamDto,
  UpdateTenantDto,
} from './workspace.dto.js';

@Injectable()
export class WorkspaceAdministrationService {
  constructor(
    @Inject(DATABASE) private readonly database: Database,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuditService,
  ) {}

  async tenant(auth: AuthenticatedPrincipal, executor: DatabaseExecutor = this.database) {
    const [tenant] = await executor
      .select({
        id: tenants.id,
        name: tenants.name,
        slug: tenants.slug,
        status: tenants.status,
        locale: sql<string>`coalesce(${tenantSettings.locale}, 'en')`,
        timezone: sql<string>`coalesce(${tenantSettings.timezone}, 'UTC')`,
      })
      .from(tenants)
      .leftJoin(tenantSettings, eq(tenantSettings.tenantId, tenants.id))
      .where(eq(tenants.id, auth.tenantId));
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async updateTenant(auth: AuthenticatedPrincipal, input: UpdateTenantDto, ifMatch?: string) {
    await this.requireAdmin(auth);
    this.requireFields(input);
    await this.mutate(async (transaction) => {
      await transaction
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.id, auth.tenantId))
        .for('update');
      assertResourceMatches(ifMatch, await this.tenant(auth, transaction));
      if (input.name !== undefined)
        await transaction
          .update(tenants)
          .set({ name: input.name, updatedAt: sql`CURRENT_TIMESTAMP` })
          .where(eq(tenants.id, auth.tenantId));
      const settings = { locale: input.locale, timezone: input.timezone };
      if (settings.locale !== undefined || settings.timezone !== undefined)
        await transaction
          .insert(tenantSettings)
          .values({ tenantId: auth.tenantId, ...settings })
          .onConflictDoUpdate({
            target: tenantSettings.tenantId,
            set: { ...settings, updatedAt: sql`CURRENT_TIMESTAMP` },
          });
      await this.record(auth, 'tenant', auth.tenantId, 'updated', input, transaction);
    });
    return this.tenant(auth);
  }

  async listOrganizations(auth: AuthenticatedPrincipal, query: ListWorkspaceResourcesDto) {
    const scope = await this.organizationScope(auth);
    const rows = await this.database
      .select()
      .from(organizations)
      .where(
        and(
          eq(organizations.tenantId, auth.tenantId),
          scope,
          query.cursor ? gt(organizations.id, query.cursor) : undefined,
          query.status ? eq(organizations.status, query.status) : undefined,
          query.search ? ilike(organizations.name, this.searchPattern(query.search)) : undefined,
        ),
      )
      .orderBy(asc(organizations.id))
      .limit(query.limit + 1);
    return this.page(rows, query.limit);
  }

  async organization(
    auth: AuthenticatedPrincipal,
    id: string,
    executor: DatabaseExecutor = this.database,
  ) {
    const [row] = await executor
      .select()
      .from(organizations)
      .where(
        and(
          eq(organizations.tenantId, auth.tenantId),
          eq(organizations.id, id),
          await this.organizationScope(auth),
        ),
      );
    if (!row) throw new NotFoundException('Organization not found');
    const summary =
      await executor.execute(sql`WITH visible_teams AS (SELECT t.id FROM teams t WHERE t.tenant_id=${auth.tenantId} AND t.organization_id=${id} AND EXISTS(SELECT 1 FROM user_access_grants g WHERE g.tenant_id=t.tenant_id AND g.user_id=${auth.membershipId} AND (g.scope_type='tenant' OR (g.scope_type='organization' AND g.organization_id=t.organization_id) OR (g.scope_type='team' AND g.team_id=t.id)))), visible_assignments AS (SELECT a.* FROM campaign_prospect_assignments a WHERE a.tenant_id=${auth.tenantId} AND a.organization_id=${id} AND a.team_id IN(SELECT id FROM visible_teams) AND a.ended_at IS NULL AND EXISTS(SELECT 1 FROM user_access_grants g WHERE g.tenant_id=a.tenant_id AND g.user_id=${auth.membershipId} AND (g.scope_type='tenant' OR (g.scope_type='organization' AND g.organization_id=a.organization_id) OR (g.scope_type='team' AND g.team_id=a.team_id)) AND (g.role<>'prospector' OR a.assigned_user_id IS NULL OR a.assigned_user_id=${auth.membershipId}))) SELECT
    (SELECT count(*)::int FROM visible_teams) AS "teamCount",
    (SELECT count(*)::int FROM visible_assignments) AS "activeAssignments",
    (SELECT count(*)::int FROM visible_assignments WHERE status='paused') AS "pausedAssignments",
    (SELECT count(DISTINCT campaign_id)::int FROM visible_assignments) AS "campaignsWithAssignments",
    (SELECT count(DISTINCT assigned_user_id)::int FROM visible_assignments) AS "assignedMembers"`);
    return { ...row, summary: { ...summary.rows[0], scope: 'authorized_teams_and_assignments' } };
  }

  async createOrganization(auth: AuthenticatedPrincipal, input: CreateOrganizationDto) {
    await this.requireAdmin(auth);
    return this.mutate(async (transaction) => {
      const [row] = await transaction
        .insert(organizations)
        .values({ tenantId: auth.tenantId, ...input })
        .returning();
      await this.record(auth, 'organization', row!.id, 'created', input, transaction);
      return this.organization(auth, row!.id, transaction);
    });
  }

  async updateOrganization(
    auth: AuthenticatedPrincipal,
    id: string,
    input: UpdateOrganizationDto,
    ifMatch?: string,
  ) {
    await this.requireAdmin(auth);
    this.requireFields(input);
    return this.mutate(async (transaction) => {
      const [before] = await transaction
        .select()
        .from(organizations)
        .where(and(eq(organizations.tenantId, auth.tenantId), eq(organizations.id, id)))
        .for('update');
      if (!before) throw new NotFoundException('Organization not found');
      assertResourceMatches(ifMatch, await this.organization(auth, id, transaction));
      if (input.status === 'inactive') {
        const participation = await transaction.execute(
          sql`SELECT id FROM campaign_organizations WHERE tenant_id = ${auth.tenantId} AND organization_id = ${id} AND ended_at IS NULL LIMIT 1`,
        );
        if (participation.rows.length)
          throw new ConflictException(
            'End campaign organization participation before deactivation',
          );
        const relationship = await transaction.execute(
          sql`SELECT id FROM organization_relationships WHERE tenant_id = ${auth.tenantId} AND ended_at IS NULL AND (parent_organization_id = ${id} OR child_organization_id = ${id}) LIMIT 1`,
        );
        if (relationship.rows.length)
          throw new ConflictException('End organization relationships before deactivation');

        const [activeTeam] = await transaction
          .select({ id: teams.id })
          .from(teams)
          .where(
            and(
              eq(teams.tenantId, auth.tenantId),
              eq(teams.organizationId, id),
              eq(teams.status, 'active'),
            ),
          )
          .limit(1);
        const [activeCampaign] = await transaction
          .select({ id: campaigns.id })
          .from(campaigns)
          .where(
            and(
              eq(campaigns.tenantId, auth.tenantId),
              eq(campaigns.organizationId, id),
              eq(campaigns.status, 'active'),
            ),
          )
          .limit(1);
        if (activeTeam || activeCampaign)
          throw new ConflictException(
            'Deactivate teams and finish active campaigns before deactivating the organization',
          );
      }
      const [row] = await transaction
        .update(organizations)
        .set({ ...input, updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(and(eq(organizations.tenantId, auth.tenantId), eq(organizations.id, id)))
        .returning();
      await this.record(
        auth,
        'organization',
        id,
        input.status === 'inactive' ? 'deactivated' : 'updated',
        { ...input, previousStatus: before.status },
        transaction,
      );
      return this.organization(auth, row!.id, transaction);
    });
  }

  async deleteOrganizationPermanently(auth: AuthenticatedPrincipal, id: string, ifMatch?: string) {
    await this.requireAdmin(auth);
    try {
      return await this.database.transaction(async (transaction) => {
        const [before] = await transaction
          .select()
          .from(organizations)
          .where(and(eq(organizations.tenantId, auth.tenantId), eq(organizations.id, id)))
          .for('update');
        if (!before) throw new NotFoundException('Organization not found');
        assertResourceMatches(ifMatch, await this.organization(auth, id, transaction));
        // These references would otherwise cascade or clear themselves on deletion.
        const links = await transaction.execute(sql`
          SELECT 1 FROM user_access_grants WHERE tenant_id = ${auth.tenantId} AND organization_id = ${id}
          UNION ALL SELECT 1 FROM script_templates WHERE tenant_id = ${auth.tenantId} AND organization_id = ${id}
          LIMIT 1
        `);
        if (links.rows.length)
          throw new ConflictException(
            'This company is still linked to access grants or scripts. Remove those links or deactivate it instead.',
          );
        // Keep related business records: restrictive foreign keys refuse linked deletions.
        await transaction
          .delete(organizations)
          .where(and(eq(organizations.tenantId, auth.tenantId), eq(organizations.id, id)));
        await this.record(
          auth,
          'organization',
          id,
          'deleted',
          { name: before.name, slug: before.slug },
          transaction,
        );
        return { deleted: true, id };
      });
    } catch (error) {
      let cause: unknown = error;
      for (let depth = 0; depth < 5 && typeof cause === 'object' && cause !== null; depth++) {
        if ('code' in cause && cause.code === '23503') {
          throw new ConflictException(
            'This company is still linked to other records. Remove those links or deactivate it instead.',
          );
        }
        cause = 'cause' in cause ? cause.cause : null;
      }
      throw error;
    }
  }

  async listTeams(auth: AuthenticatedPrincipal, query: ListTeamsDto) {
    const rows = await this.database
      .select(this.teamColumns())
      .from(teams)
      .leftJoin(teamSettings, eq(teamSettings.teamId, teams.id))
      .where(
        and(
          eq(teams.tenantId, auth.tenantId),
          await this.teamScope(auth),
          query.cursor ? gt(teams.id, query.cursor) : undefined,
          query.organizationId ? eq(teams.organizationId, query.organizationId) : undefined,
          query.status ? eq(teams.status, query.status) : undefined,
          query.search ? ilike(teams.name, this.searchPattern(query.search)) : undefined,
        ),
      )
      .orderBy(asc(teams.id))
      .limit(query.limit + 1);
    return this.page(rows, query.limit);
  }

  async team(auth: AuthenticatedPrincipal, id: string, executor: DatabaseExecutor = this.database) {
    const [row] = await executor
      .select(this.teamColumns())
      .from(teams)
      .leftJoin(teamSettings, eq(teamSettings.teamId, teams.id))
      .where(and(eq(teams.tenantId, auth.tenantId), eq(teams.id, id), await this.teamScope(auth)));
    if (!row) throw new NotFoundException('Team not found');
    return row;
  }

  async createTeam(auth: AuthenticatedPrincipal, input: CreateTeamDto) {
    await this.requireAdmin(auth);
    return this.mutate(async (transaction) => {
      const [organization] = await transaction
        .select()
        .from(organizations)
        .where(
          and(
            eq(organizations.tenantId, auth.tenantId),
            eq(organizations.id, input.organizationId),
          ),
        )
        .for('share');
      if (!organization) throw new NotFoundException('Organization not found');
      if (organization.status !== 'active') throw new ConflictException('Organization is inactive');
      await this.validateManager(auth, input.managerMembershipId, transaction);
      const [row] = await transaction
        .insert(teams)
        .values({
          tenantId: auth.tenantId,
          organizationId: input.organizationId,
          name: input.name,
          slug: input.slug,
        })
        .returning();
      await this.configureManager(auth, row!, input.managerMembershipId, transaction);
      await transaction.insert(teamSettings).values({
        tenantId: auth.tenantId,
        organizationId: input.organizationId,
        teamId: row!.id,
        capacity: input.capacity,
        managerMembershipId: input.managerMembershipId,
      });
      await this.record(auth, 'team', row!.id, 'created', input, transaction);
      return this.team(auth, row!.id, transaction);
    });
  }

  async updateTeam(
    auth: AuthenticatedPrincipal,
    id: string,
    input: UpdateTeamDto,
    ifMatch?: string,
  ) {
    const team = await this.team(auth, id);
    this.requireFields(input);
    if (
      !(await this.authorization.getAssignmentAuthority(
        auth.tenantId,
        auth.membershipId,
        team.organizationId,
        id,
      ))
    )
      throw new ForbiddenException('Team management access required');
    // A manager can adjust their team workload; changing management or lifecycle remains administrative.
    if (input.managerMembershipId !== undefined || input.status !== undefined)
      await this.requireAdmin(auth);
    await this.mutate(async (transaction) => {
      await transaction
        .select({ id: teams.id })
        .from(teams)
        .where(and(eq(teams.tenantId, auth.tenantId), eq(teams.id, id)))
        .for('update');
      assertResourceMatches(ifMatch, await this.team(auth, id, transaction));
      if (input.status === 'active') {
        const [parent] = await transaction
          .select({ status: organizations.status })
          .from(organizations)
          .where(
            and(
              eq(organizations.tenantId, auth.tenantId),
              eq(organizations.id, team.organizationId),
            ),
          )
          .for('share');
        if (parent?.status !== 'active') throw new ConflictException('Organization is inactive');
      }
      if (input.status === 'inactive') {
        const roster = await transaction.execute(
          sql`SELECT id FROM team_memberships WHERE tenant_id = ${auth.tenantId} AND team_id = ${id} AND revoked_at IS NULL AND (ends_at IS NULL OR ends_at > CURRENT_TIMESTAMP) LIMIT 1`,
        );
        if (roster.rows.length)
          throw new ConflictException(
            'End active and scheduled roster periods before team deactivation',
          );

        const [assignment] = await transaction
          .select({ id: campaignProspectAssignments.id })
          .from(campaignProspectAssignments)
          .where(
            and(
              eq(campaignProspectAssignments.tenantId, auth.tenantId),
              eq(campaignProspectAssignments.teamId, id),
              isNull(campaignProspectAssignments.endedAt),
            ),
          )
          .limit(1);
        if (assignment)
          throw new ConflictException(
            'Reassign or finish active assignments before deactivating the team',
          );
      }
      await this.validateManager(auth, input.managerMembershipId, transaction);
      const { capacity, managerMembershipId, ...fields } = input;
      await this.configureManager(auth, team, managerMembershipId, transaction);
      if (Object.values(fields).some((value) => value !== undefined))
        await transaction
          .update(teams)
          .set({ ...fields, updatedAt: sql`CURRENT_TIMESTAMP` })
          .where(and(eq(teams.tenantId, auth.tenantId), eq(teams.id, id)));
      if (capacity !== undefined || managerMembershipId !== undefined)
        await transaction
          .insert(teamSettings)
          .values({
            tenantId: auth.tenantId,
            organizationId: team.organizationId,
            teamId: id,
            capacity,
            managerMembershipId,
          })
          .onConflictDoUpdate({
            target: teamSettings.teamId,
            set: { capacity, managerMembershipId, updatedAt: sql`CURRENT_TIMESTAMP` },
          });
      await this.record(
        auth,
        'team',
        id,
        input.status === 'inactive' ? 'deactivated' : 'updated',
        { ...input, organizationId: team.organizationId },
        transaction,
      );
    });
    return this.team(auth, id);
  }

  async capacity(auth: AuthenticatedPrincipal, id: string) {
    const team = await this.team(auth, id);
    // Aggregate workload is managerial data, not another prospector's portfolio.
    const scope = await this.authorization.resolveViewScope(
      auth.tenantId,
      auth.membershipId,
      team.organizationId,
      id,
    );
    const grants = await this.authorization.getUserGrants(auth.tenantId, auth.membershipId);
    if (
      !scope ||
      !grants.some(
        (grant) =>
          grant.role !== 'prospector' &&
          (grant.scopeType === 'tenant' ||
            (grant.organizationId === team.organizationId &&
              (grant.scopeType === 'organization' || grant.teamId === id))),
      )
    )
      throw new ForbiddenException('Team workload access required');
    const [workload] = await this.database
      .select({ assigned: count() })
      .from(campaignProspectAssignments)
      .where(
        and(
          eq(campaignProspectAssignments.tenantId, auth.tenantId),
          eq(campaignProspectAssignments.teamId, id),
          isNull(campaignProspectAssignments.endedAt),
        ),
      );
    const members = await this.database
      .execute(sql`SELECT m.id AS "membershipId",m.identity_id AS "identityId",m.display_name AS "displayName",i.email,m.status,i.status AS "identityStatus",ms.capacity,
      (SELECT count(*)::int FROM campaign_prospect_assignments a WHERE a.tenant_id=m.tenant_id AND a.assigned_user_id=m.id AND a.ended_at IS NULL) AS "globalWorkload",
      (SELECT count(*)::int FROM campaign_prospect_assignments a WHERE a.tenant_id=m.tenant_id AND a.assigned_user_id=m.id AND a.team_id=${id} AND a.ended_at IS NULL) AS "teamWorkload"
      FROM tenant_memberships m JOIN identities i ON i.id=m.identity_id LEFT JOIN membership_settings ms ON ms.tenant_id=m.tenant_id AND ms.membership_id=m.id
      WHERE m.tenant_id=${auth.tenantId} AND EXISTS(SELECT 1 FROM user_access_grants g WHERE g.tenant_id=m.tenant_id AND g.user_id=m.id AND g.role='prospector' AND g.scope_type='team' AND g.team_id=${id}) ORDER BY m.id LIMIT 1001`);
    const state = await this.database.execute(
      sql`SELECT count(*) FILTER(WHERE status='paused')::int AS paused,count(*) FILTER(WHERE assigned_user_id IS NULL)::int AS "teamOwned" FROM campaign_prospect_assignments WHERE tenant_id=${auth.tenantId} AND team_id=${id} AND ended_at IS NULL`,
    );
    const assigned = workload?.assigned ?? 0;
    return {
      teamId: id,
      capacity: team.capacity,
      assigned,
      available: Math.max(0, team.capacity - assigned),
      overCapacity: Math.max(0, assigned - team.capacity),
      acceptingAssignments: team.status === 'active' && assigned < team.capacity,
      constraints: {
        teamActive: team.status === 'active',
        pausedAssignmentsConsumeCapacity: true,
        memberCapacityIsGlobal: true,
        territoryAndCampaignEligibility:
          'Evaluate for the target campaign/prospect through allocation preview',
      },
      paused: state.rows[0]?.paused ?? 0,
      teamOwned: state.rows[0]?.teamOwned ?? 0,
      members: {
        items: members.rows.slice(0, 1000).map((m) => ({
          ...m,
          eligible: m.status === 'active' && m.identityStatus === 'active',
          available:
            m.status === 'active' && m.identityStatus === 'active'
              ? m.capacity === null
                ? null
                : Math.max(0, Number(m.capacity) - Number(m.globalWorkload))
              : 0,
        })),
        truncated: members.rows.length > 1000,
      },
    };
  }

  private teamColumns() {
    return {
      id: teams.id,
      tenantId: teams.tenantId,
      organizationId: teams.organizationId,
      name: teams.name,
      slug: teams.slug,
      status: teams.status,
      createdAt: teams.createdAt,
      updatedAt: teams.updatedAt,
      capacity: sql<number>`coalesce(${teamSettings.capacity}, 100)`,
      managerMembershipId: teamSettings.managerMembershipId,
    };
  }

  private async organizationScope(auth: AuthenticatedPrincipal): Promise<SQL> {
    const grants = await this.authorization.getUserGrants(auth.tenantId, auth.membershipId);
    if (grants.some((grant) => grant.scopeType === 'tenant')) return sql`true`;
    const ids = [
      ...new Set(grants.flatMap((grant) => (grant.organizationId ? [grant.organizationId] : []))),
    ];
    return ids.length ? inArray(organizations.id, ids) : sql`false`;
  }

  private async teamScope(auth: AuthenticatedPrincipal): Promise<SQL> {
    const grants = await this.authorization.getUserGrants(auth.tenantId, auth.membershipId);
    if (grants.some((grant) => grant.scopeType === 'tenant')) return sql`true`;
    const orgIds = grants.flatMap((grant) =>
      grant.scopeType === 'organization' && grant.organizationId ? [grant.organizationId] : [],
    );
    const teamIds = grants.flatMap((grant) =>
      grant.scopeType === 'team' && grant.teamId ? [grant.teamId] : [],
    );
    return or(
      orgIds.length ? inArray(teams.organizationId, orgIds) : sql`false`,
      teamIds.length ? inArray(teams.id, teamIds) : sql`false`,
      activeRoster(auth.tenantId, auth.membershipId, sql`${teams.id}`),
    )!;
  }

  private async requireAdmin(auth: AuthenticatedPrincipal) {
    if (!(await this.authorization.isClientAdmin(auth.tenantId, auth.membershipId)))
      throw new ForbiddenException('Tenant administrator access required');
  }

  private async validateManager(
    auth: AuthenticatedPrincipal,
    membershipId: string | null | undefined,
    transaction: DatabaseTransaction,
  ) {
    if (!membershipId) return;
    const [member] = await transaction
      .select({ id: tenantMemberships.id })
      .from(tenantMemberships)
      .innerJoin(identities, eq(identities.id, tenantMemberships.identityId))
      .where(
        and(
          eq(tenantMemberships.tenantId, auth.tenantId),
          eq(tenantMemberships.id, membershipId),
          eq(tenantMemberships.status, 'active'),
          eq(identities.status, 'active'),
        ),
      );
    if (!member) throw new NotFoundException('Active manager membership not found');
  }

  private async configureManager(
    auth: AuthenticatedPrincipal,
    team: { id: string; organizationId: string },
    membershipId: string | null | undefined,
    transaction: DatabaseTransaction,
  ) {
    if (membershipId === undefined) return;
    const [previous] = await transaction
      .select({ manager: teamSettings.managerMembershipId })
      .from(teamSettings)
      .where(and(eq(teamSettings.tenantId, auth.tenantId), eq(teamSettings.teamId, team.id)));
    if (previous?.manager && previous.manager !== membershipId) {
      const removed = await transaction
        .delete(userAccessGrants)
        .where(
          and(
            eq(userAccessGrants.tenantId, auth.tenantId),
            eq(userAccessGrants.userId, previous.manager),
            eq(userAccessGrants.teamId, team.id),
            eq(userAccessGrants.role, 'manager'),
          ),
        )
        .returning({ id: userAccessGrants.id });
      for (const grant of removed)
        await this.record(
          auth,
          'access_grant',
          grant.id,
          'revoked',
          {
            targetUserId: previous.manager,
            role: 'manager',
            organizationId: team.organizationId,
            teamId: team.id,
          },
          transaction,
        );
    }
    if (membershipId) {
      const [grant] = await transaction
        .insert(userAccessGrants)
        .values({
          tenantId: auth.tenantId,
          userId: membershipId,
          role: 'manager',
          scopeType: 'team',
          organizationId: team.organizationId,
          teamId: team.id,
        })
        .onConflictDoNothing()
        .returning();
      if (grant)
        await this.record(
          auth,
          'access_grant',
          grant.id,
          'created',
          {
            targetUserId: membershipId,
            role: 'manager',
            organizationId: team.organizationId,
            teamId: team.id,
          },
          transaction,
        );
    }
  }

  private requireFields(input: object) {
    if (!Object.values(input).some((value) => value !== undefined))
      throw new BadRequestException('At least one update field is required');
  }

  private searchPattern(search: string) {
    return `%${search.replace(/[\\%_]/g, '\\$&')}%`;
  }

  private page<T extends { id: string }>(rows: T[], limit: number) {
    return {
      items: rows.slice(0, limit),
      nextCursor: rows.length > limit ? rows[limit - 1]!.id : null,
    };
  }

  private async record(
    auth: AuthenticatedPrincipal,
    resourceType: string,
    resourceId: string,
    verb: string,
    metadata: object,
    transaction: DatabaseTransaction,
  ) {
    const values = JSON.parse(JSON.stringify(metadata)) as Record<string, string | number | null>;
    await this.audit.record(
      {
        tenantId: auth.tenantId,
        actorType: 'user',
        actorUserId: auth.membershipId,
        action: `${resourceType}.${verb}`,
        resourceType,
        resourceId,
        metadata: values,
      },
      transaction,
    );
  }

  private async mutate<T>(work: (transaction: DatabaseTransaction) => Promise<T>): Promise<T> {
    try {
      return await this.database.transaction(work);
    } catch (error) {
      let cause: unknown = error;
      for (let depth = 0; depth < 5 && typeof cause === 'object' && cause !== null; depth++) {
        if ('code' in cause && cause.code === '23505')
          throw new ConflictException('This slug is already in use');
        cause = 'cause' in cause ? cause.cause : null;
      }
      throw error;
    }
  }
}
