import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import { ClientAdminGuard } from '../authorization/client-admin.guard.js';
import { Idempotent } from '../idempotency/idempotent.decorator.js';
import { CampaignProspectAssignmentService } from './campaign-prospect-assignment.service.js';
import { AssignCampaignProspectDto } from './dto/assign-campaign-prospect.dto.js';

interface AuthContext {
  userId: string;
  tenantId: string;
}

@Controller('campaigns/:campaignId/prospects/:prospectId')
@UseGuards(AuthGuard, ClientAdminGuard)
export class CampaignProspectAssignmentController {
  constructor(private readonly assignmentService: CampaignProspectAssignmentService) {}

  @Idempotent('assignment.assign')
  @Post('assignment')
  assign(
    @CurrentAuth()
    auth: AuthContext,

    @Param('campaignId', new ParseUUIDPipe())
    campaignId: string,

    @Param('prospectId', new ParseUUIDPipe())
    prospectId: string,

    @Body()
    input: AssignCampaignProspectDto,
  ) {
    return this.assignmentService.assign({
      tenantId: auth.tenantId,

      actorUserId: auth.userId,

      campaignId,

      campaignProspectId: prospectId,

      teamId: input.teamId,

      assignedUserId: input.assignedUserId,
    });
  }

  @Idempotent('assignment.reassign')
  @Put('assignment')
  reassign(
    @CurrentAuth()
    auth: AuthContext,

    @Param('campaignId', new ParseUUIDPipe())
    campaignId: string,

    @Param('prospectId', new ParseUUIDPipe())
    prospectId: string,

    @Body()
    input: AssignCampaignProspectDto,
  ) {
    return this.assignmentService.reassign({
      tenantId: auth.tenantId,

      actorUserId: auth.userId,

      campaignId,

      campaignProspectId: prospectId,

      teamId: input.teamId,

      assignedUserId: input.assignedUserId,
    });
  }

  /*
   * Unassign has its own durable idempotency
   * operation namespace.
   *
   * It must not share assignment.reassign with PUT.
   */
  @Idempotent('assignment.unassign')
  @Delete('assignment')
  unassign(
    @CurrentAuth()
    auth: AuthContext,

    @Param('campaignId', new ParseUUIDPipe())
    campaignId: string,

    @Param('prospectId', new ParseUUIDPipe())
    prospectId: string,
  ) {
    return this.assignmentService.unassign({
      tenantId: auth.tenantId,

      actorUserId: auth.userId,

      campaignId,

      campaignProspectId: prospectId,
    });
  }

  @Get('assignment')
  getCurrent(
    @CurrentAuth()
    auth: AuthContext,

    @Param('campaignId', new ParseUUIDPipe())
    campaignId: string,

    @Param('prospectId', new ParseUUIDPipe())
    prospectId: string,
  ) {
    return this.assignmentService.getCurrent(auth.tenantId, campaignId, prospectId);
  }

  @Get('assignment-history')
  getHistory(
    @CurrentAuth()
    auth: AuthContext,

    @Param('campaignId', new ParseUUIDPipe())
    campaignId: string,

    @Param('prospectId', new ParseUUIDPipe())
    prospectId: string,
  ) {
    return this.assignmentService.getHistory(auth.tenantId, campaignId, prospectId);
  }
}
