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
import { AssignmentBatchService } from './assignment-batch.service.js';
import { AssignmentLifecycleService } from './assignment-lifecycle.service.js';
import {
  AssignmentEndDto,
  AssignmentListDto,
  CreateAssignmentDto,
  ReassignAssignmentDto,
  UnassignedListDto,
  UpdateAssignmentDto,
} from './assignment-lifecycle.dto.js';
@Injectable()
export class AssignmentLifecycleGuard implements CanActivate {
  constructor(
    private readonly service: AssignmentLifecycleService,
    private readonly batches: AssignmentBatchService,
  ) {}
  async canActivate(c: ExecutionContext) {
    const r = c.switchToHttp().getRequest<{
      auth: AuthenticatedPrincipal;
      params: { assignmentId?: string };
      body: CreateAssignmentDto;
    }>();
    if (r.params.assignmentId) {
      if (!isUUID(r.params.assignmentId))
        throw new BadRequestException('Valid assignment ID required');
      await this.service.authorize(r.auth, r.params.assignmentId);
      if (r.body?.teamId) {
        if (!isUUID(r.body.teamId)) throw new BadRequestException('Valid team ID required');
        const row = await this.service.row(r.auth, r.params.assignmentId);
        await this.batches.authorize(r.auth, row.campaignId, [r.body.teamId]);
      }
    } else {
      if (!isUUID(r.body?.campaignId) || !isUUID(r.body?.teamId))
        throw new BadRequestException('Valid campaign and team IDs required');
      await this.batches.authorize(r.auth, r.body.campaignId, [r.body.teamId]);
    }
    return true;
  }
}
@Controller('assignments')
@UseGuards(AuthGuard)
export class AssignmentLifecycleController {
  constructor(private readonly service: AssignmentLifecycleService) {}
  @Get() list(@CurrentAuth() a: AuthenticatedPrincipal, @Query() q: AssignmentListDto) {
    return this.service.list(a, q);
  }
  @Get('unassigned') unassigned(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Query() q: UnassignedListDto,
  ) {
    return this.service.unassigned(a, q);
  }
  @Post()
  @UseGuards(AssignmentLifecycleGuard)
  @Idempotent('canonical_assignment.create')
  create(@CurrentAuth() a: AuthenticatedPrincipal, @Body() b: CreateAssignmentDto) {
    return this.service.create(a, b);
  }
  @Get(':assignmentId') detail(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('assignmentId', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.detail(a, id);
  }
  @Patch(':assignmentId')
  @UseGuards(AssignmentLifecycleGuard)
  @Idempotent('canonical_assignment.update')
  update(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('assignmentId', new ParseUUIDPipe()) id: string,
    @Body() b: UpdateAssignmentDto,
    @Headers('if-match') v?: string,
  ) {
    return this.service.mutate(a, id, 'update', b, v);
  }
  @Post(':assignmentId/reassign')
  @HttpCode(200)
  @UseGuards(AssignmentLifecycleGuard)
  @Idempotent('canonical_assignment.reassign')
  reassign(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('assignmentId', new ParseUUIDPipe()) id: string,
    @Body() b: ReassignAssignmentDto,
    @Headers('if-match') v?: string,
  ) {
    return this.service.mutate(a, id, 'reassign', b, v);
  }
  @Post(':assignmentId/complete')
  @HttpCode(200)
  @UseGuards(AssignmentLifecycleGuard)
  @Idempotent('canonical_assignment.complete')
  complete(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('assignmentId', new ParseUUIDPipe()) id: string,
    @Body() b: AssignmentEndDto,
    @Headers('if-match') v?: string,
  ) {
    return this.service.mutate(a, id, 'complete', b, v);
  }
  @Post(':assignmentId/revoke')
  @HttpCode(200)
  @UseGuards(AssignmentLifecycleGuard)
  @Idempotent('canonical_assignment.revoke')
  revoke(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('assignmentId', new ParseUUIDPipe()) id: string,
    @Body() b: AssignmentEndDto,
    @Headers('if-match') v?: string,
  ) {
    return this.service.mutate(a, id, 'revoke', b, v);
  }
}
