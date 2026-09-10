import { Body, Controller, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import { CreateCollisionOverrideDto } from './create-collision-override.dto.js';
import { ManagerOverrideService } from './manager-override.service.js';

interface AuthContext {
  userId: string;
  tenantId: string;
}

@Controller('campaigns/:campaignId/prospects/:prospectId/collision-overrides')
@UseGuards(AuthGuard)
export class ManagerOverrideController {
  constructor(private readonly managerOverrideService: ManagerOverrideService) {}

  @Post()
  async create(
    @CurrentAuth()
    auth: AuthContext,

    @Param('campaignId', new ParseUUIDPipe())
    campaignId: string,

    @Param('prospectId', new ParseUUIDPipe())
    prospectId: string,

    @Body()
    body: CreateCollisionOverrideDto,
  ) {
    const override = await this.managerOverrideService.create({
      tenantId: auth.tenantId,

      approvedByUserId: auth.userId,

      prospectorUserId: body.prospectorUserId,

      campaignId,

      campaignProspectId: prospectId,

      reason: body.reason,
    });

    /*
     * Expose only the data needed by the client
     * to continue the workflow.
     *
     * conflictSnapshot remains internal/audit
     * evidence rather than becoming part of the
     * public reservation workflow contract.
     */
    return {
      overrideId: override.id,

      reasonCode: override.reasonCode,

      approvedByRole: override.approvedByRole,

      expiresAt: override.expiresAt.toISOString(),

      createdAt: override.createdAt.toISOString(),
    };
  }
}
