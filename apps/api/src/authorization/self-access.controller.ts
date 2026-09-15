import { Controller, Get, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import { SelfAccessService } from './self-access.service.js';
import type { SelfAccessContext } from './self-access.types.js';

@Controller('auth/me/access-grants')
@UseGuards(AuthGuard)
export class SelfAccessController {
  constructor(private readonly selfAccessService: SelfAccessService) {}

  @Get()
  async getCurrentAccess(
    @CurrentAuth()
    auth: AuthenticatedUser,
  ): Promise<SelfAccessContext> {
    return this.selfAccessService.getContext({
      tenantId: auth.tenantId,

      userId: auth.userId,
    });
  }
}
