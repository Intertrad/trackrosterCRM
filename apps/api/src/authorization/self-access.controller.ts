import { Controller, Get, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import type { AccessScope, UserRole } from '../database/schema/user-access-grants.js';
import { AuthorizationService } from './authorization.service.js';

interface SelfAccessGrant {
  role: UserRole;
  scopeType: AccessScope;
  organizationId: string | null;
  teamId: string | null;
}

interface SelfAccessResponse {
  userId: string;
  tenantId: string;
  grants: SelfAccessGrant[];
}

@Controller('auth/me')
@UseGuards(AuthGuard)
export class SelfAccessController {
  constructor(private readonly authorizationService: AuthorizationService) {}

  @Get('access-grants')
  async getAccessGrants(
    @CurrentAuth()
    auth: AuthenticatedUser,
  ): Promise<SelfAccessResponse> {
    const grants = await this.authorizationService.getUserGrants(auth.tenantId, auth.userId);

    return {
      userId: auth.userId,
      tenantId: auth.tenantId,
      grants: grants.map((grant) => ({
        role: grant.role,
        scopeType: grant.scopeType,
        organizationId: grant.organizationId,
        teamId: grant.teamId,
      })),
    };
  }
}
