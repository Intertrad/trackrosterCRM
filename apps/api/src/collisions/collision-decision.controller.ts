import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import { CollisionDecisionService } from './collision-decision.service.js';

interface AuthContext {
  userId: string;
  tenantId: string;
}

@Controller('campaigns/:campaignId/prospects/:prospectId/collision-decision')
@UseGuards(AuthGuard)
export class CollisionDecisionController {
  constructor(private readonly collisionDecisionService: CollisionDecisionService) {}

  @Get()
  async evaluate(
    @CurrentAuth()
    auth: AuthContext,

    @Param('campaignId', new ParseUUIDPipe())
    campaignId: string,

    @Param('prospectId', new ParseUUIDPipe())
    prospectId: string,
  ) {
    const result = await this.collisionDecisionService.evaluate({
      tenantId: auth.tenantId,
      userId: auth.userId,
      campaignId,
      campaignProspectId: prospectId,
    });

    return {
      decision: result.decision,

      reasonCode: result.reasonCode,

      establishmentId: result.establishmentId,

      conflict: result.conflict
        ? {
            expiresAt: result.conflict.expiresAt,
          }
        : null,
    };
  }
}
