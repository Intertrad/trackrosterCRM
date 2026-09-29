import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { AuthGuard } from '../auth/auth.guard.js';
import { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import { UnifiedTimelineService } from './unified-timeline.service.js';
class TimelineQuery {
  @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
  @ValidateIf((_o, v) => v !== undefined) @IsString() @MaxLength(500) cursor?: string;
}
@Controller('prospects/:prospectId/timeline')
@UseGuards(AuthGuard)
export class UnifiedTimelineController {
  constructor(private readonly service: UnifiedTimelineService) {}
  @Get() list(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('prospectId', new ParseUUIDPipe()) id: string,
    @Query() q: TimelineQuery,
  ) {
    return this.service.list(a, id, q.limit, q.cursor);
  }
}
