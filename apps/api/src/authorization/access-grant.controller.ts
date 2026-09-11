import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import type { UserAccessGrant } from '../database/schema/user-access-grants.js';
import { AccessGrantService } from './access-grant.service.js';
import { AuthorizationService } from './authorization.service.js';
import { ClientAdminGuard } from './client-admin.guard.js';
import { CreateAccessGrantDto } from './dto/create-access-grant.dto.js';

@Controller('users/:userId/access-grants')
@UseGuards(AuthGuard, ClientAdminGuard)
export class AccessGrantController {
  constructor(
    private readonly accessGrantService: AccessGrantService,

    private readonly authorizationService: AuthorizationService,
  ) {}

  @Get()
  async list(
    @CurrentAuth()
    auth: AuthenticatedUser,

    @Param('userId')
    userId: string,
  ): Promise<UserAccessGrant[]> {
    return this.accessGrantService.list(auth.tenantId, userId);
  }

  @Post()
  async create(
    @CurrentAuth()
    auth: AuthenticatedUser,

    @Param('userId')
    userId: string,

    @Body()
    input: CreateAccessGrantDto,
  ): Promise<UserAccessGrant> {
    if (input.scopeType === 'tenant') {
      if (input.role !== 'client_admin' && input.role !== 'observer') {
        throw new Error('Invalid tenant access role');
      }

      return this.accessGrantService.create({
        tenantId: auth.tenantId,

        actorUserId: auth.userId,

        userId,

        role: input.role,

        scopeType: 'tenant',
      });
    }

    if (input.scopeType === 'organization') {
      if (input.role !== 'director' && input.role !== 'observer') {
        throw new Error('Invalid organization access role');
      }

      if (!input.organizationId) {
        throw new Error('organizationId is required');
      }

      return this.accessGrantService.create({
        tenantId: auth.tenantId,

        actorUserId: auth.userId,

        userId,

        role: input.role,

        scopeType: 'organization',

        organizationId: input.organizationId,
      });
    }

    if (input.role !== 'manager' && input.role !== 'prospector' && input.role !== 'observer') {
      throw new Error('Invalid team access role');
    }

    if (!input.organizationId || !input.teamId) {
      throw new Error('organizationId and teamId are required');
    }

    return this.accessGrantService.create({
      tenantId: auth.tenantId,

      actorUserId: auth.userId,

      userId,

      role: input.role,

      scopeType: 'team',

      organizationId: input.organizationId,

      teamId: input.teamId,
    });
  }

  @Delete(':grantId')
  async revoke(
    @CurrentAuth()
    auth: AuthenticatedUser,

    @Param('userId')
    userId: string,

    @Param('grantId')
    grantId: string,
  ): Promise<void> {
    await this.accessGrantService.revoke({
      tenantId: auth.tenantId,

      actorUserId: auth.userId,

      userId,

      grantId,
    });
  }
}
