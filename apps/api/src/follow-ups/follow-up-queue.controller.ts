import { CanonicalFollowUpService } from './canonical-follow-up.service.js';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { Controller, Get, Query, UseGuards, Optional } from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import { ListFollowUpQueueQueryDto } from './list-follow-up-queue-query.dto.js';
import { ProspectFollowUpQueryService } from './prospect-follow-up-query.service.js';

interface AuthContext {
  userId: string;

  tenantId: string;
}

@Controller('follow-ups')
@UseGuards(AuthGuard)
export class FollowUpQueueController {
  constructor(
    private readonly followUpQueryService: ProspectFollowUpQueryService,
    @Optional() private readonly canonical?: CanonicalFollowUpService,
  ) {}

  @Get()
  list(
    @CurrentAuth()
    auth: AuthContext,

    @Query()
    query: ListFollowUpQueueQueryDto,
  ) {
    if (this.canonical && (!query.teamId || query.status || query.cursor || query.campaignId))
      return this.canonical.list(auth as AuthenticatedPrincipal, query);
    return this.followUpQueryService.listQueue({
      tenantId: auth.tenantId,

      userId: auth.userId,

      teamId: query.teamId!,

      overdue: query.overdue,

      limit: query.limit,
    });
  }
}
