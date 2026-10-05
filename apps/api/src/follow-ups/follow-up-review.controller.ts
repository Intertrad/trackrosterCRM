import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsDate, IsIn, IsString, MaxLength, MinLength } from 'class-validator';

import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { Idempotent } from '../idempotency/idempotent.decorator.js';
import { FollowUpReviewService, type FollowUpReviewDecision } from './follow-up-review.service.js';

export class RequestFollowUpReviewDto {
  @Type(() => Date)
  @IsDate()
  dueAt!: Date;

  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  reason!: string;
}

export class DecideFollowUpReviewDto {
  @IsIn(['approved', 'completed', 'rejected'])
  decision!: FollowUpReviewDecision;

  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;
}

@Controller()
@UseGuards(AuthGuard)
export class FollowUpReviewController {
  constructor(private readonly service: FollowUpReviewService) {}

  @Post('campaigns/:campaignId/prospects/:prospectId/follow-ups/:followUpId/reschedule-review')
  @Idempotent('follow_up.reschedule_review')
  request(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Param('campaignId', new ParseUUIDPipe()) campaignId: string,
    @Param('prospectId', new ParseUUIDPipe()) prospectId: string,
    @Param('followUpId', new ParseUUIDPipe()) followUpId: string,
    @Body() body: RequestFollowUpReviewDto,
  ) {
    return this.service.request(auth, {
      campaignId,
      prospectId,
      followUpId,
      dueAt: body.dueAt,
      reason: body.reason,
    });
  }

  @Get('follow-up-reviews')
  list(@CurrentAuth() auth: AuthenticatedPrincipal) {
    return this.service.list(auth);
  }

  @Post('follow-up-reviews/:reviewId/decision')
  @Idempotent('follow_up.review_decision')
  decide(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Param('reviewId', new ParseUUIDPipe()) reviewId: string,
    @Body() body: DecideFollowUpReviewDto,
  ) {
    return this.service.decide(auth, reviewId, body.decision, body.reason);
  }
}
