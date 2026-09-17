import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import { ClientAdminGuard } from '../authorization/client-admin.guard.js';
import type { Organization } from '../database/schema/organizations.js';
import { OrganizationService } from '../organizations/organization.service.js';
import { CreateOrganizationDto } from './dto/create-organization.dto.js';
import { UpdateOrganizationStatusDto } from './dto/update-organization-status.dto.js';

@Controller('organizations')
@UseGuards(AuthGuard, ClientAdminGuard)
export class OrganizationManagementController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get()
  async list(
    @CurrentAuth()
    auth: AuthenticatedUser,
  ): Promise<Organization[]> {
    return this.organizationService.findByTenant(auth.tenantId);
  }

  @Post()
  async create(
    @CurrentAuth()
    auth: AuthenticatedUser,

    @Body()
    input: CreateOrganizationDto,
  ): Promise<Organization> {
    return this.organizationService.create({
      tenantId: auth.tenantId,
      name: input.name,
      slug: input.slug,
    });
  }

  @Patch(':organizationId/status')
  async updateStatus(
    @CurrentAuth()
    auth: AuthenticatedUser,

    @Param('organizationId')
    organizationId: string,

    @Body()
    input: UpdateOrganizationStatusDto,
  ): Promise<Organization> {
    return this.organizationService.updateStatus(auth.tenantId, organizationId, input.status);
  }
}
