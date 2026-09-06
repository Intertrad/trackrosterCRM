import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import { UserAccessGrant } from '../database/schema/user-access-grants.js';
import { OrganizationRepository } from '../organizations/organization.repository.js';
import { TeamRepository } from '../teams/team.repository.js';
import { UserRepository } from '../users/user.repository.js';
import { CreateAccessGrantInput } from './access-grant.types.js';
import { UserAccessGrantRepository } from './user-access-grant.repository.js';

@Injectable()
export class AccessGrantService {
  constructor(
    @Inject(UserAccessGrantRepository)
    private readonly grantRepository: UserAccessGrantRepository,

    @Inject(UserRepository)
    private readonly userRepository: UserRepository,

    @Inject(OrganizationRepository)
    private readonly organizationRepository: OrganizationRepository,

    @Inject(TeamRepository)
    private readonly teamRepository: TeamRepository,
  ) {}

  async create(input: CreateAccessGrantInput): Promise<UserAccessGrant> {
    await this.validateUser(input.tenantId, input.userId);

    if (input.scopeType === 'organization') {
      await this.validateOrganization(input.tenantId, input.organizationId);
    }

    if (input.scopeType === 'team') {
      await this.validateOrganization(input.tenantId, input.organizationId);

      await this.validateTeam(input.tenantId, input.organizationId, input.teamId);
    }

    try {
      return await this.grantRepository.create(input);
    } catch (error: unknown) {
      if (this.hasPostgresCode(error, '23505')) {
        throw new ConflictException('Access grant already exists');
      }

      throw error;
    }
  }

  async revoke(tenantId: string, userId: string, grantId: string): Promise<void> {
    await this.validateUser(tenantId, userId);

    const deleted = await this.grantRepository.deleteById(tenantId, userId, grantId);

    if (!deleted) {
      throw new NotFoundException('Access grant not found');
    }
  }

  private async validateUser(tenantId: string, userId: string): Promise<void> {
    const user = await this.userRepository.findById(tenantId, userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }
  }

  private async validateOrganization(tenantId: string, organizationId: string): Promise<void> {
    const organization = await this.organizationRepository.findById(tenantId, organizationId);

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
  }

  private async validateTeam(
    tenantId: string,
    organizationId: string,
    teamId: string,
  ): Promise<void> {
    const team = await this.teamRepository.findById(tenantId, teamId);

    if (!team || team.organizationId !== organizationId) {
      throw new NotFoundException('Team not found');
    }
  }

  private hasPostgresCode(error: unknown, code: string): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const cause = error.cause;

    if (typeof cause !== 'object' || cause === null || !('code' in cause)) {
      return false;
    }

    return cause.code === code;
  }

  async list(tenantId: string, userId: string): Promise<UserAccessGrant[]> {
    await this.validateUser(tenantId, userId);

    return this.grantRepository.findByUser(tenantId, userId);
  }
}
