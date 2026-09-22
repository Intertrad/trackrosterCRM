import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import { DATABASE } from '../database/database.constants.js';
import { NewTeam, Team, teams } from '../database/schema/teams.js';
import { Database, DatabaseExecutor } from '../database/database.types.js';

@Injectable()
export class TeamRepository {
  constructor(
    @Inject(DATABASE)
    private readonly database: Database,
  ) {}

  async findByIdForShare(
    tenantId: string,
    teamId: string,
    executor: DatabaseExecutor,
  ): Promise<Team | null> {
    const [team] = await executor
      .select()
      .from(teams)
      .where(and(eq(teams.tenantId, tenantId), eq(teams.id, teamId)))
      .for('share');
    return team ?? null;
  }

  async create(input: NewTeam): Promise<Team> {
    const [team] = await this.database.insert(teams).values(input).returning();

    if (!team) {
      throw new Error('Failed to create team');
    }

    return team;
  }

  async findById(tenantId: string, teamId: string): Promise<Team | null> {
    const [team] = await this.database
      .select()
      .from(teams)
      .where(and(eq(teams.tenantId, tenantId), eq(teams.id, teamId)))
      .limit(1);

    return team ?? null;
  }

  async findBySlug(tenantId: string, organizationId: string, slug: string): Promise<Team | null> {
    const [team] = await this.database
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
    return this.database
      .select()
      .from(teams)
      .where(and(eq(teams.tenantId, tenantId), eq(teams.organizationId, organizationId)));
  }
}
