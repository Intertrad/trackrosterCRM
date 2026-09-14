import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Get,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import {
  CreateProspectFollowUpDto,
  RescheduleProspectFollowUpDto,
} from './prospect-follow-up.dto.js';
import { ProspectFollowUpService } from './prospect-follow-up.service.js';
import { ProspectFollowUpQueryService } from './prospect-follow-up-query.service.js';
import { Idempotent } from '../idempotency/idempotent.decorator.js';

interface AuthContext {
  userId: string;

  tenantId: string;
}

@Controller('campaigns/:campaignId/prospects/:prospectId/follow-ups')
@UseGuards(AuthGuard)
export class ProspectFollowUpController {
  constructor(
    private readonly followUpService: ProspectFollowUpService,

    private readonly followUpQueryService: ProspectFollowUpQueryService,
  ) {}

  @Get()
  list(
    @CurrentAuth()
    auth: AuthContext,

    @Param('campaignId', new ParseUUIDPipe())
    campaignId: string,

    @Param('prospectId', new ParseUUIDPipe())
    prospectId: string,
  ) {
    return this.followUpQueryService.listByProspect({
      tenantId: auth.tenantId,

      userId: auth.userId,

      campaignId,

      campaignProspectId: prospectId,
    });
  }
  @Idempotent('follow_up.create')
  @Post()
  create(
    @CurrentAuth()
    auth: AuthContext,

    @Param('campaignId', new ParseUUIDPipe())
    campaignId: string,

    @Param('prospectId', new ParseUUIDPipe())
    prospectId: string,

    @Body()
    body: CreateProspectFollowUpDto,
  ) {
    return this.followUpService.create({
      tenantId: auth.tenantId,

      userId: auth.userId,

      campaignId,

      campaignProspectId: prospectId,

      dueAt: body.dueAt,

      assignedUserId: body.assignedUserId,
    });
  }
  @Idempotent('follow_up.reschedule')
  @Patch(':followUpId/reschedule')
  reschedule(
    @CurrentAuth()
    auth: AuthContext,

    @Param('campaignId', new ParseUUIDPipe())
    campaignId: string,

    @Param('prospectId', new ParseUUIDPipe())
    prospectId: string,

    @Param('followUpId', new ParseUUIDPipe())
    followUpId: string,

    @Body()
    body: RescheduleProspectFollowUpDto,
  ) {
    return this.followUpService.reschedule({
      tenantId: auth.tenantId,

      userId: auth.userId,

      campaignId,

      campaignProspectId: prospectId,

      followUpId,

      dueAt: body.dueAt,
    });
  }
  @Idempotent('follow_up.complete')
  @Post(':followUpId/complete')
  complete(
    @CurrentAuth()
    auth: AuthContext,

    @Param('campaignId', new ParseUUIDPipe())
    campaignId: string,

    @Param('prospectId', new ParseUUIDPipe())
    prospectId: string,

    @Param('followUpId', new ParseUUIDPipe())
    followUpId: string,
  ) {
    return this.followUpService.complete({
      tenantId: auth.tenantId,

      userId: auth.userId,

      campaignId,

      campaignProspectId: prospectId,

      followUpId,
    });
  }
  @Idempotent('follow_up.cancel')
  @Post(':followUpId/cancel')
  cancel(
    @CurrentAuth()
    auth: AuthContext,

    @Param('campaignId', new ParseUUIDPipe())
    campaignId: string,

    @Param('prospectId', new ParseUUIDPipe())
    prospectId: string,

    @Param('followUpId', new ParseUUIDPipe())
    followUpId: string,
  ) {
    return this.followUpService.cancel({
      tenantId: auth.tenantId,

      userId: auth.userId,

      campaignId,

      campaignProspectId: prospectId,

      followUpId,
    });
  }
}
