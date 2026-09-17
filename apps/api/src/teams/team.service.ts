import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import type { NewTeam, Team } from '../database/schema/teams.js';
import { OrganizationRepository } from '../organizations/organization.repository.js';
import { TeamRepository } from './team.repository.js';

export interface CreateTeamInput {
  tenantId: string;
  organizationId: string;
  name: string;
  slug: string;
}

@Injectable()
export class TeamService {
  constructor(
    @Inject(TeamRepository)
    private readonly teamRepository: TeamRepository,

    @Inject(OrganizationRepository)
    private readonly organizationRepository: OrganizationRepository,
  ) {}

  async create(input: CreateTeamInput): Promise<Team> {
    const organization = await this.organizationRepository.findById(
      input.tenantId,
      input.organizationId,
    );

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const slug = input.slug.trim().toLowerCase();

    const existingTeam = await this.teamRepository.findBySlug(
      input.tenantId,
      input.organizationId,
      slug,
    );

    if (existingTeam) {
      throw new ConflictException(`Team with slug "${slug}" already exists in this organization`);
    }

    const team: NewTeam = {
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      name: input.name.trim(),
      slug,
      status: 'active',
    };

    return this.teamRepository.create(team);
  }

  async findById(tenantId: string, teamId: string): Promise<Team | null> {
    return this.teamRepository.findById(tenantId, teamId);
  }

  async findBySlug(tenantId: string, organizationId: string, slug: string): Promise<Team | null> {
    return this.teamRepository.findBySlug(tenantId, organizationId, slug.trim().toLowerCase());
  }

  async findByOrganization(tenantId: string, organizationId: string): Promise<Team[]> {
    const organization = await this.organizationRepository.findById(tenantId, organizationId);

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return this.teamRepository.findByOrganization(tenantId, organizationId);
  }

  async updateStatus(
    tenantId: string,
    organizationId: string,
    teamId: string,
    status: Team['status'],
  ): Promise<Team> {
    const organization = await this.organizationRepository.findById(tenantId, organizationId);

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const team = await this.teamRepository.updateStatus(tenantId, organizationId, teamId, status);

    if (!team) {
      throw new NotFoundException('Team not found');
    }

    return team;
  }
}
