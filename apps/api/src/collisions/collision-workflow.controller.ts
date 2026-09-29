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
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { Idempotent } from '../idempotency/idempotent.decorator.js';
import {
  CheckCollisionDto,
  CollisionListDto,
  OverrideReasonDto,
} from './collision-workflow.dto.js';
import { CollisionWorkflowService } from './collision-workflow.service.js';
import { withGuardTenantScope } from '../database/guard-tenant-scope.js';
@Injectable()
export class CollisionWorkflowGuard implements CanActivate {
  constructor(private readonly service: CollisionWorkflowService) {}
  async canActivate(context: ExecutionContext) {
    const scoped = context.switchToHttp().getRequest<{ auth?: { tenantId?: string } }>();
    return withGuardTenantScope(scoped.auth?.tenantId, async () => {
      const r = context.switchToHttp().getRequest<{
        auth: AuthenticatedPrincipal;
        params: { collisionId?: string; requestId?: string };
        body: CheckCollisionDto;
        routeOptions: { url: string };
      }>();
      if (r.params.collisionId) {
        if (!isUUID(r.params.collisionId))
          throw new BadRequestException('Valid collision ID required');
        await this.service.authorizeRequest(r.auth, r.params.collisionId);
      } else if (r.params.requestId) {
        if (!isUUID(r.params.requestId)) throw new BadRequestException('Valid request ID required');
        const op = r.routeOptions.url.split('/').at(-1) as 'approve' | 'reject' | 'cancel';
        await this.service.authorizeDecision(r.auth, r.params.requestId, op);
      } else {
        if (!isUUID(r.body?.campaignId) || !isUUID(r.body?.campaignProspectId))
          throw new BadRequestException('Valid campaign and prospect IDs required');
        await this.service.authorizeCheck(r.auth, r.body);
      }
      return true;
    });
  }
}
@Controller()
@UseGuards(AuthGuard)
export class CollisionWorkflowController {
  constructor(private readonly service: CollisionWorkflowService) {}
  @Post('reservations/check')
  @HttpCode(200)
  @UseGuards(CollisionWorkflowGuard)
  @Idempotent('collision.check')
  check(@CurrentAuth() a: AuthenticatedPrincipal, @Body() body: CheckCollisionDto) {
    return this.service.check(a, body);
  }
  @Get('collision-events')
  events(@CurrentAuth() a: AuthenticatedPrincipal, @Query() q: CollisionListDto) {
    return this.service.listEvents(a, q);
  }
  @Get('collision-events/:collisionId')
  event(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('collisionId', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.eventDetail(a, id);
  }
  @Post('collision-events/:collisionId/override-request')
  @UseGuards(CollisionWorkflowGuard)
  @Idempotent('override.request')
  request(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('collisionId', new ParseUUIDPipe()) id: string,
    @Body() body: OverrideReasonDto,
  ) {
    return this.service.request(a, id, body.reason);
  }
  @Get('override-requests')
  requests(@CurrentAuth() a: AuthenticatedPrincipal, @Query() q: CollisionListDto) {
    return this.service.listRequests(a, q);
  }
  @Get('override-requests/:requestId')
  detail(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('requestId', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.requestDetail(a, id);
  }
  @Post('override-requests/:requestId/approve')
  @HttpCode(200)
  @UseGuards(CollisionWorkflowGuard)
  @Idempotent('override.approve')
  approve(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('requestId', new ParseUUIDPipe()) id: string,
    @Body() body: OverrideReasonDto,
    @Headers('if-match') version?: string,
  ) {
    return this.service.decide(a, id, 'approve', body.reason, version);
  }
  @Post('override-requests/:requestId/reject')
  @HttpCode(200)
  @UseGuards(CollisionWorkflowGuard)
  @Idempotent('override.reject')
  reject(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('requestId', new ParseUUIDPipe()) id: string,
    @Body() body: OverrideReasonDto,
    @Headers('if-match') version?: string,
  ) {
    return this.service.decide(a, id, 'reject', body.reason, version);
  }
  @Post('override-requests/:requestId/cancel')
  @HttpCode(200)
  @UseGuards(CollisionWorkflowGuard)
  @Idempotent('override.cancel')
  cancel(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('requestId', new ParseUUIDPipe()) id: string,
    @Body() body: OverrideReasonDto,
    @Headers('if-match') version?: string,
  ) {
    return this.service.decide(a, id, 'cancel', body.reason, version);
  }
}
