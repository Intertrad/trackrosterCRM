import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import { DATABASE } from '../database/database.constants.js';
import { NewTeam, Team, teams } from '../database/schema/teams.js';
import { Database, DatabaseExecutor } from '../database/database.types.js';
import { currentTenantExecutor } from '../database/request-tenant-executor.js';
import { withTenantContext } from '../database/tenant-context.js';

@Injectable()
export class TeamRepository {
  constructor(
    @Inject(DATABASE)
    private readonly database: Database,
  ) {}

  async findByIdForUpdate(
    tenantId: string,
    teamId: string,
    executor: DatabaseExecutor,
  ): Promise<Team | null> {
    const [team] = await executor
      .select()
      .from(teams)
      .where(and(eq(teams.tenantId, tenantId), eq(teams.id, teamId)))
      .for('update');
    return team ?? null;
  }

  async create(input: NewTeam): Promise<Team> {
    if (!currentTenantExecutor())
      return withTenantContext(this.database, input.tenantId, (tx) =>
        this.createWithExecutor(input, tx),
      );
    return this.createWithExecutor(input, this.database);
  }

  private async createWithExecutor(input: NewTeam, executor: DatabaseExecutor): Promise<Team> {
    const [team] = await executor.insert(teams).values(input).returning();

    if (!team) {
      throw new Error('Failed to create team');
    }

    return team;
  }

  async findById(tenantId: string, teamId: string): Promise<Team | null> {
    if (!currentTenantExecutor())
      return withTenantContext(this.database, tenantId, (tx) =>
        this.findByIdWithExecutor(tenantId, teamId, tx),
      );
    return this.findByIdWithExecutor(tenantId, teamId, this.database);
  }

  private async findByIdWithExecutor(
    tenantId: string,
    teamId: string,
    executor: DatabaseExecutor,
  ): Promise<Team | null> {
    const [team] = await executor
      .select()
      .from(teams)
      .where(and(eq(teams.tenantId, tenantId), eq(teams.id, teamId)))
      .limit(1);

    return team ?? null;
  }

  async findBySlug(tenantId: string, organizationId: string, slug: string): Promise<Team | null> {
    if (!currentTenantExecutor())
      return withTenantContext(this.database, tenantId, (tx) =>
        this.findBySlugWithExecutor(tenantId, organizationId, slug, tx),
      );
    return this.findBySlugWithExecutor(tenantId, organizationId, slug, this.database);
  }

  private async findBySlugWithExecutor(
    tenantId: string,
    organizationId: string,
    slug: string,
    executor: DatabaseExecutor,
  ): Promise<Team | null> {
    const [team] = await executor
      .select()
      .from(teams)
      .where(
        and(
          eq(teams.tenantId, tenantId),
          eq(teams.organizationId, organizationId),
          eq(teams.slug, slug),
        ),
      )
      .limit(1);

    return team ?? null;
  }

  async findByOrganization(tenantId: string, organizationId: string): Promise<Team[]> {
    if (!currentTenantExecutor())
      return withTenantContext(this.database, tenantId, (tx) =>
        this.findByOrganizationWithExecutor(tenantId, organizationId, tx),
      );
    return this.findByOrganizationWithExecutor(tenantId, organizationId, this.database);
  }

  private findByOrganizationWithExecutor(
    tenantId: string,
    organizationId: string,
    executor: DatabaseExecutor,
  ): Promise<Team[]> {
    return executor
      .select()
      .from(teams)
      .where(and(eq(teams.tenantId, tenantId), eq(teams.organizationId, organizationId)));
  }
}
