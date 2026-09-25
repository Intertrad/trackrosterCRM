import {
  BadRequestException,
  Body,
  CanActivate,
  Controller,
  Delete,
  ExecutionContext,
  Get,
  Headers,
  HttpCode,
  Injectable,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { AuthGuard } from '../auth/auth.guard.js';
import { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import { Idempotent } from '../idempotency/idempotent.decorator.js';
import { ReservationLifecycleService } from './reservation-lifecycle.service.js';
import { ReservationRuleService } from './reservation-rule.service.js';
import {
  ClaimReservationDto,
  CreateReservationRuleDto,
  ExtendReservationDto,
  ReleaseReservationDto,
  ReservationListDto,
  ReservationRulePatchDto,
} from './reservation-lifecycle.dto.js';
import { withGuardTenantScope } from '../database/guard-tenant-scope.js';
@Injectable()
export class ReservationLifecycleGuard implements CanActivate {
  constructor(private readonly service: ReservationLifecycleService) {}
  async canActivate(c: ExecutionContext) {
    const scoped = c.switchToHttp().getRequest<{ auth?: { tenantId?: string } }>();
    return withGuardTenantScope(scoped.auth?.tenantId, async () => {
      const r = c.switchToHttp().getRequest<{
        auth: AuthenticatedPrincipal;
        params: { reservationId?: string };
        body: ClaimReservationDto;
        routeOptions: { url: string };
      }>();
      if (r.params.reservationId) {
        if (!isUUID(r.params.reservationId))
          throw new BadRequestException('Valid reservation ID required');
        await this.service.authorizeMutation(
          r.auth,
          r.params.reservationId,
          r.routeOptions.url.split('/').at(-1) as 'heartbeat' | 'extend' | 'release',
        );
      } else {
        if (!isUUID(r.body?.campaignId) || !isUUID(r.body?.campaignProspectId))
          throw new BadRequestException('Valid campaign and prospect IDs required');
        await this.service.authorizeClaim(r.auth, r.body);
      }
      return true;
    });
  }
}
@Injectable()
export class ReservationRuleGuard implements CanActivate {
  constructor(private readonly service: ReservationRuleService) {}
  async canActivate(c: ExecutionContext) {
    const scoped = c.switchToHttp().getRequest<{ auth?: { tenantId?: string } }>();
    return withGuardTenantScope(scoped.auth?.tenantId, async () => {
      await this.service.authorize(
        c.switchToHttp().getRequest<{ auth: AuthenticatedPrincipal }>().auth,
      );
      return true;
    });
  }
}
@Controller('reservation-rules')
@UseGuards(AuthGuard, ReservationRuleGuard)
export class ReservationRuleController {
  constructor(private readonly service: ReservationRuleService) {}
  @Get() list(@CurrentAuth() a: AuthenticatedPrincipal, @Query() q: ReservationListDto) {
    return this.service.list(a, q);
  }
  @Get(':ruleId') detail(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('ruleId', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.detail(a, id);
  }
  @Post() @Idempotent('reservation_rule.create') create(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Body() b: CreateReservationRuleDto,
  ) {
    return this.service.change(a, 'create', b);
  }
  @Patch(':ruleId') @Idempotent('reservation_rule.update') update(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('ruleId', new ParseUUIDPipe()) id: string,
    @Body() b: ReservationRulePatchDto,
    @Headers('if-match') v?: string,
  ) {
    return this.service.change(a, 'update', b, id, v);
  }
  @Delete(':ruleId') @Idempotent('reservation_rule.deactivate') remove(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('ruleId', new ParseUUIDPipe()) id: string,
    @Headers('if-match') v?: string,
  ) {
    return this.service.change(a, 'deactivate', {}, id, v);
  }
}
@Controller('reservations')
@UseGuards(AuthGuard)
export class ReservationLifecycleController {
  constructor(private readonly service: ReservationLifecycleService) {}
  @Get() list(@CurrentAuth() a: AuthenticatedPrincipal, @Query() q: ReservationListDto) {
    return this.service.list(a, q);
  }
  @Post('claim') @UseGuards(ReservationLifecycleGuard) @Idempotent('reservation.claim') claim(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Body() b: ClaimReservationDto,
  ) {
    return this.service.claim(a, b);
  }
  @Get(':reservationId') detail(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('reservationId', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.detail(a, id);
  }
  @Post(':reservationId/heartbeat')
  @HttpCode(200)
  @UseGuards(ReservationLifecycleGuard)
  @Idempotent('reservation.heartbeat')
  heartbeat(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('reservationId', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.mutate(a, id, 'heartbeat', {});
  }
  @Post(':reservationId/extend')
  @HttpCode(200)
  @UseGuards(ReservationLifecycleGuard)
  @Idempotent('reservation.extend')
  extend(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('reservationId', new ParseUUIDPipe()) id: string,
    @Body() b: ExtendReservationDto,
  ) {
    return this.service.mutate(a, id, 'extend', b);
  }
  @Post(':reservationId/release')
  @HttpCode(200)
  @UseGuards(ReservationLifecycleGuard)
  @Idempotent('reservation.release')
  release(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('reservationId', new ParseUUIDPipe()) id: string,
    @Body() b: ReleaseReservationDto,
  ) {
    return this.service.mutate(a, id, 'release', b);
  }
}
