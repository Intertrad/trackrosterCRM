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
  Module,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { AuthModule } from '../auth/auth.module.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import type { AuthenticatedPrincipal as Actor } from '../auth/auth.types.js';
import { DatabaseModule } from '../database/database.module.js';
import { Idempotent } from '../idempotency/idempotent.decorator.js';
import {
  AddStopDto,
  CreateRouteDto,
  RouteListDto,
  StopOrderDto,
  UpdateRouteDto,
  UpdateStopDto,
} from './route.dto.js';
import { RouteService } from './route.service.js';
@Injectable()
export class RouteWriteGuard implements CanActivate {
  constructor(private readonly service: RouteService) {}
  async canActivate(c: ExecutionContext) {
    const req = c.switchToHttp().getRequest<{
      auth: Actor;
      params: { routeId?: string; stopId?: string };
      body?: { teamId?: string };
    }>();
    if (req.params.stopId) {
      if (!isUUID(req.params.stopId)) throw new BadRequestException('Valid stop ID required');
      await this.service.stopRoute(req.auth, req.params.stopId);
    } else if (req.params.routeId) {
      if (!isUUID(req.params.routeId)) throw new BadRequestException('Valid route ID required');
      await this.service.row(req.auth, req.params.routeId, true);
    } else {
      if (!isUUID(req.body?.teamId)) throw new BadRequestException('Valid team ID required');
      await this.service.authorizeCreate(req.auth, req.body!.teamId!);
    }
    return true;
  }
}
@Controller('routes')
@UseGuards(AuthGuard)
export class RouteController {
  constructor(private readonly service: RouteService) {}
  @Get() list(@CurrentAuth() a: Actor, @Query() q: RouteListDto) {
    return this.service.list(a, q);
  }
  @Post() @UseGuards(RouteWriteGuard) @Idempotent('route.create') create(
    @CurrentAuth() a: Actor,
    @Body() b: CreateRouteDto,
  ) {
    return this.service.create(a, b);
  }
  @Get(':routeId') detail(
    @CurrentAuth() a: Actor,
    @Param('routeId', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.detail(a, id);
  }
  @Patch(':routeId') @UseGuards(RouteWriteGuard) @Idempotent('route.update') update(
    @CurrentAuth() a: Actor,
    @Param('routeId', new ParseUUIDPipe()) id: string,
    @Body() b: UpdateRouteDto,
    @Headers('if-match') v?: string,
  ) {
    return this.service.mutate(a, id, 'update', b, v);
  }
  @Delete(':routeId') @UseGuards(RouteWriteGuard) @Idempotent('route.cancel') cancel(
    @CurrentAuth() a: Actor,
    @Param('routeId', new ParseUUIDPipe()) id: string,
    @Headers('if-match') v?: string,
  ) {
    return this.service.mutate(a, id, 'cancel', {}, v);
  }
  @Post(':routeId/stops')
  @HttpCode(200)
  @UseGuards(RouteWriteGuard)
  @Idempotent('route.add_stop')
  add(
    @CurrentAuth() a: Actor,
    @Param('routeId', new ParseUUIDPipe()) id: string,
    @Body() b: AddStopDto,
    @Headers('if-match') v?: string,
  ) {
    return this.service.mutate(a, id, 'add', b, v);
  }
  @Put(':routeId/stop-order') @UseGuards(RouteWriteGuard) @Idempotent('route.order') order(
    @CurrentAuth() a: Actor,
    @Param('routeId', new ParseUUIDPipe()) id: string,
    @Body() b: StopOrderDto,
    @Headers('if-match') v?: string,
  ) {
    return this.service.mutate(a, id, 'order', b, v);
  }
  @Post(':routeId/optimize')
  @HttpCode(200)
  @UseGuards(RouteWriteGuard)
  @Idempotent('route.optimize')
  optimize(
    @CurrentAuth() a: Actor,
    @Param('routeId', new ParseUUIDPipe()) id: string,
    @Headers('if-match') v?: string,
  ) {
    return this.service.mutate(a, id, 'optimize', {}, v);
  }
  @Post(':routeId/start')
  @HttpCode(200)
  @UseGuards(RouteWriteGuard)
  @Idempotent('route.start')
  start(
    @CurrentAuth() a: Actor,
    @Param('routeId', new ParseUUIDPipe()) id: string,
    @Headers('if-match') v?: string,
  ) {
    return this.service.mutate(a, id, 'start', {}, v);
  }
  @Post(':routeId/complete')
  @HttpCode(200)
  @UseGuards(RouteWriteGuard)
  @Idempotent('route.complete')
  complete(
    @CurrentAuth() a: Actor,
    @Param('routeId', new ParseUUIDPipe()) id: string,
    @Headers('if-match') v?: string,
  ) {
    return this.service.mutate(a, id, 'complete', {}, v);
  }
}
@Controller('route-stops')
@UseGuards(AuthGuard, RouteWriteGuard)
export class RouteStopController {
  constructor(private readonly service: RouteService) {}
  @Patch(':stopId') @Idempotent('route.update_stop') async update(
    @CurrentAuth() a: Actor,
    @Param('stopId', new ParseUUIDPipe()) id: string,
    @Body() b: UpdateStopDto,
    @Headers('if-match') v?: string,
  ) {
    return this.service.mutate(a, await this.service.stopRoute(a, id), 'stop', b, v, id);
  }
  @Delete(':stopId') @Idempotent('route.remove_stop') async remove(
    @CurrentAuth() a: Actor,
    @Param('stopId', new ParseUUIDPipe()) id: string,
    @Headers('if-match') v?: string,
  ) {
    return this.service.mutate(a, await this.service.stopRoute(a, id), 'remove', {}, v, id);
  }
}
@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [RouteController, RouteStopController],
  providers: [RouteService, RouteWriteGuard],
  exports: [RouteService],
})
export class RouteModule {}
