import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service.js';
import { DATABASE } from '../database/database.constants.js';
import type { UserAccessGrant } from '../database/schema/user-access-grants.js';
import type { Database } from '../database/database.types.js';
import { OrganizationRepository } from '../organizations/organization.repository.js';
import { TeamRepository } from '../teams/team.repository.js';
import { UserRepository } from '../users/user.repository.js';
import type { CreateAccessGrantCommand, RevokeAccessGrantCommand } from './access-grant.types.js';
import { UserAccessGrantRepository } from './user-access-grant.repository.js';
import { assertAdministratorRemains } from './administrator-continuity.js';

@Injectable()
export class AccessGrantService {
  constructor(
    @Inject(DATABASE)
    private readonly database: Database,

    @Inject(UserAccessGrantRepository)
    private readonly grantRepository: UserAccessGrantRepository,

    @Inject(UserRepository)
    private readonly userRepository: UserRepository,

    @Inject(OrganizationRepository)
    private readonly organizationRepository: OrganizationRepository,

    @Inject(TeamRepository)
    private readonly teamRepository: TeamRepository,

    private readonly auditService: AuditService,
  ) {}

  async create(input: CreateAccessGrantCommand): Promise<UserAccessGrant> {
    await this.validateUser(input.tenantId, input.userId);

    if (input.scopeType === 'organization') {
      await this.validateOrganization(input.tenantId, input.organizationId);
    }

    if (input.scopeType === 'team') {
      await this.validateOrganization(input.tenantId, input.organizationId);

      await this.validateTeam(input.tenantId, input.organizationId, input.teamId);
    }

    try {
      return await this.database.transaction(async (transaction) => {
        /*
         * actorUserId is audit context and must
         * never be written into user_access_grants.
         */
        const grantInput =
          input.scopeType === 'tenant'
            ? {
                tenantId: input.tenantId,

                userId: input.userId,

                role: input.role,

                scopeType: input.scopeType,
              }
            : input.scopeType === 'organization'
              ? {
                  tenantId: input.tenantId,

                  userId: input.userId,

                  role: input.role,

                  scopeType: input.scopeType,

                  organizationId: input.organizationId,
                }
              : {
                  tenantId: input.tenantId,

                  userId: input.userId,

                  role: input.role,

                  scopeType: input.scopeType,

                  organizationId: input.organizationId,

                  teamId: input.teamId,
                };

        const grant = await this.grantRepository.create(grantInput, transaction);

        await this.auditService.record(
          {
            tenantId: input.tenantId,

            actorType: 'user',

            actorUserId: input.actorUserId,

            action: 'access_grant.created',

            resourceType: 'access_grant',

            resourceId: grant.id,

            metadata: {
              targetUserId: grant.userId,

              role: grant.role,

              scopeType: grant.scopeType,

              organizationId: grant.organizationId,

              teamId: grant.teamId,
            },
          },

          transaction,
        );

        return grant;
      });
    } catch (error: unknown) {
      if (this.hasPostgresCode(error, '23505')) {
        throw new ConflictException('Access grant already exists');
      }

      throw error;
    }
  }

  async revoke(input: RevokeAccessGrantCommand): Promise<void> {
    await this.validateUser(input.tenantId, input.userId);

    await this.database.transaction(async (transaction) => {
      /*
       * Read before delete because the immutable
       * audit row needs the original authorization
       * scope after user_access_grants is gone.
       */
      const grant = await this.grantRepository.findByIdForUser(
        input.tenantId,
        input.userId,
        input.grantId,
        transaction,
      );

      if (!grant) {
        throw new NotFoundException('Access grant not found');
      }

      if (grant.role === 'client_admin') {
        await assertAdministratorRemains(transaction, input.tenantId, input.userId);
      }

      const deleted = await this.grantRepository.deleteById(
        input.tenantId,
        input.userId,
        input.grantId,
        transaction,
      );

      if (!deleted) {
        throw new NotFoundException('Access grant not found');
      }

      await this.auditService.record(
        {
          tenantId: input.tenantId,

          actorType: 'user',

          actorUserId: input.actorUserId,

          action: 'access_grant.revoked',

          resourceType: 'access_grant',

          resourceId: grant.id,

          metadata: {
            targetUserId: grant.userId,

            role: grant.role,

            scopeType: grant.scopeType,

            organizationId: grant.organizationId,

            teamId: grant.teamId,
          },
        },

        transaction,
      );
    });
  }

  async list(tenantId: string, userId: string): Promise<UserAccessGrant[]> {
    await this.validateUser(tenantId, userId);

    return this.grantRepository.findByUser(tenantId, userId);
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
}
