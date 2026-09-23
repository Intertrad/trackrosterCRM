import {
  BadRequestException,
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  Headers,
  HttpCode,
  Injectable,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { isUUID, IsIn, IsISO8601, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { Idempotent } from '../idempotency/idempotent.decorator.js';
import { CanonicalFollowUpService } from './canonical-follow-up.service.js';
export class UpdateFollowUpDto {
  @ValidateIf((_o, v) => v !== undefined)
  @IsISO8601({ strict: true })
  @Matches(/(?:Z|[+-]\d{2}:\d{2})$/)
  dueAt?: string;
  @ValidateIf((_o, v) => v !== undefined) @IsIn(['todo', 'follow_up', 'meeting']) category?:
    'todo' | 'follow_up' | 'meeting';
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsIn(['call', 'email', 'message', 'visit', 'letter'])
  channel?: 'call' | 'email' | 'message' | 'visit' | 'letter' | null;
}
class CancelFollowUpDto {
  @IsString() @Matches(/\S/) @MaxLength(2000) reason!: string;
}
@Injectable()
export class FollowUpWriteGuard implements CanActivate {
  constructor(private readonly service: CanonicalFollowUpService) {}
  async canActivate(c: ExecutionContext) {
    const r = c
      .switchToHttp()
      .getRequest<{ auth: AuthenticatedPrincipal; params: { followUpId: string } }>();
    if (!isUUID(r.params.followUpId))
      throw new BadRequestException('Valid follow-up identifier required');
    await this.service.row(r.auth, r.params.followUpId, true);
    return true;
  }
}
@Controller('follow-ups')
@UseGuards(AuthGuard)
export class CanonicalFollowUpController {
  constructor(private readonly service: CanonicalFollowUpService) {}
  @Get(':followUpId') detail(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('followUpId', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.detail(a, id);
  }
  @Patch(':followUpId') @UseGuards(FollowUpWriteGuard) @Idempotent('follow_up.update') update(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('followUpId', new ParseUUIDPipe()) id: string,
    @Body() b: UpdateFollowUpDto,
    @Headers('if-match') v?: string,
  ) {
    return this.service.mutate(a, id, 'update', b, v);
  }
  @Post(':followUpId/complete')
  @HttpCode(200)
  @UseGuards(FollowUpWriteGuard)
  @Idempotent('follow_up.complete')
  complete(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('followUpId', new ParseUUIDPipe()) id: string,
    @Headers('if-match') v?: string,
  ) {
    return this.service.mutate(a, id, 'complete', {}, v);
  }
  @Post(':followUpId/cancel')
  @HttpCode(200)
  @UseGuards(FollowUpWriteGuard)
  @Idempotent('follow_up.cancel')
  cancel(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('followUpId', new ParseUUIDPipe()) id: string,
    @Body() b: CancelFollowUpDto,
    @Headers('if-match') v?: string,
  ) {
    return this.service.mutate(a, id, 'cancel', b, v);
  }
}
