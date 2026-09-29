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
  Query,
  UseGuards,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { AuthGuard } from '../auth/auth.guard.js';
import { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import { Idempotent } from '../idempotency/idempotent.decorator.js';
import { resourceETag } from '../http/resource-etag.js';
import {
  CompleteActionDto,
  CorrectionDto,
  CreateActionDto,
  ListActionsDto,
  ReasonDto,
  StartActionDto,
  UpdateActionDto,
} from './action.dto.js';
import { ActionService } from './action.service.js';
import { withGuardTenantScope } from '../database/guard-tenant-scope.js';
@Injectable()
export class ActionWriteGuard implements CanActivate {
  constructor(private readonly service: ActionService) {}
  async canActivate(c: ExecutionContext) {
    const scoped = c.switchToHttp().getRequest<{ auth?: { tenantId?: string } }>();
    return withGuardTenantScope(scoped.auth?.tenantId, async () => {
      const r = c.switchToHttp().getRequest<{
        auth: AuthenticatedPrincipal;
        params: { actionId?: string };
        body: CreateActionDto;
        routeOptions: { url: string };
      }>();
      if (r.params.actionId) {
        if (!isUUID(r.params.actionId)) throw new BadRequestException('Valid action ID required');
        await this.service.authorize(
          r.auth,
          r.params.actionId,
          true,
          /\/(start|complete)$/.test(r.routeOptions.url),
        );
      } else {
        if (!isUUID(r.body?.campaignId) || !isUUID(r.body?.campaignProspectId))
          throw new BadRequestException('Valid campaign and prospect IDs required');
        await this.service.authorizeCreate(r.auth, r.body);
      }
      return true;
    });
  }
}
@Controller('actions')
@UseGuards(AuthGuard)
export class ActionController {
  constructor(private readonly service: ActionService) {}
  @Get() list(@CurrentAuth() a: AuthenticatedPrincipal, @Query() q: ListActionsDto) {
    return this.service.list(a, q);
  }
  @Post()
  @UseGuards(ActionWriteGuard)
  @Idempotent('action.create')
  async create(@CurrentAuth() a: AuthenticatedPrincipal, @Body() input: CreateActionDto) {
    const row = await this.service.create(a, input);
    return { ...row, etag: resourceETag(row) };
  }
  @Get(':actionId') detail(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('actionId', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.detail(a, id);
  }
  @Get(':actionId/events') events(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('actionId', new ParseUUIDPipe()) id: string,
    @Query() q: ListActionsDto,
  ) {
    return this.service.events(a, id, q);
  }
  @Patch(':actionId')
  @UseGuards(ActionWriteGuard)
  @Idempotent('action.update')
  async update(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('actionId', new ParseUUIDPipe()) id: string,
    @Body() input: UpdateActionDto,
    @Headers('if-match') version?: string,
  ) {
    return this.change(a, id, 'update', input, version);
  }
  @Post(':actionId/start')
  @HttpCode(200)
  @UseGuards(ActionWriteGuard)
  @Idempotent('action.start')
  async start(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('actionId', new ParseUUIDPipe()) id: string,
    @Body() input: StartActionDto,
    @Headers('if-match') version?: string,
  ) {
    return this.change(a, id, 'start', input, version);
  }
  @Post(':actionId/complete')
  @HttpCode(200)
  @UseGuards(ActionWriteGuard)
  @Idempotent('action.complete')
  async complete(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('actionId', new ParseUUIDPipe()) id: string,
    @Body() input: CompleteActionDto,
    @Headers('if-match') version?: string,
  ) {
    return this.change(a, id, 'complete', input, version);
  }
  @Post(':actionId/cancel')
  @HttpCode(200)
  @UseGuards(ActionWriteGuard)
  @Idempotent('action.cancel')
  async cancel(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('actionId', new ParseUUIDPipe()) id: string,
    @Body() input: ReasonDto,
    @Headers('if-match') version?: string,
  ) {
    return this.change(a, id, 'cancel', input, version);
  }
  @Post(':actionId/corrections')
  @HttpCode(200)
  @UseGuards(ActionWriteGuard)
  @Idempotent('action.correct')
  async correct(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('actionId', new ParseUUIDPipe()) id: string,
    @Body() input: CorrectionDto,
    @Headers('if-match') version?: string,
  ) {
    return this.change(a, id, 'correction', input, version);
  }
  private async change(
    a: AuthenticatedPrincipal,
    id: string,
    op: Parameters<ActionService['mutate']>[2],
    input: Parameters<ActionService['mutate']>[3],
    version?: string,
  ) {
    const row = await this.service.mutate(a, id, op, input, version);
    return { ...row, etag: resourceETag(row) };
  }
}
