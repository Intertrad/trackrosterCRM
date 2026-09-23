import {
  BadRequestException,
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  Get,
  Headers,
  Injectable,
  Module,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
import { CreateObjectiveDto, ObjectiveListDto, UpdateObjectiveDto } from './objective.dto.js';
import { ObjectiveService } from './objective.service.js';
@Injectable()
export class ObjectiveWriteGuard implements CanActivate {
  constructor(private readonly service: ObjectiveService) {}
  async canActivate(c: ExecutionContext) {
    const r = c
      .switchToHttp()
      .getRequest<{ auth: Actor; params: { objectiveId?: string }; body?: CreateObjectiveDto }>();
    if (r.params.objectiveId) {
      if (!isUUID(r.params.objectiveId))
        throw new BadRequestException('Valid objective ID required');
      await this.service.row(r.auth, r.params.objectiveId, true);
    } else {
      if (
        !r.body ||
        !isUUID(r.body.organizationId) ||
        (r.body.teamId !== undefined && !isUUID(r.body.teamId))
      )
        throw new BadRequestException('Valid organization/team required');
      await this.service.authorizeCreate(r.auth, r.body);
    }
    return true;
  }
}
@Controller('objectives')
@UseGuards(AuthGuard)
export class ObjectiveController {
  constructor(private readonly service: ObjectiveService) {}
  @Get() list(@CurrentAuth() a: Actor, @Query() q: ObjectiveListDto) {
    return this.service.list(a, q);
  }
  @Get('at-risk') risks(@CurrentAuth() a: Actor, @Query() q: ObjectiveListDto) {
    if (q.cursor)
      throw new BadRequestException(
        'Risk ranking returns a bounded top list; use limit and scope filters',
      );
    return this.service.atRisk(a, q);
  }
  @Get(':objectiveId') detail(
    @CurrentAuth() a: Actor,
    @Param('objectiveId', new ParseUUIDPipe()) id: string,
  ) {
    return this.service.detail(a, id);
  }
  @Post() @UseGuards(ObjectiveWriteGuard) @Idempotent('objective.create') create(
    @CurrentAuth() a: Actor,
    @Body() b: CreateObjectiveDto,
  ) {
    return this.service.create(a, b);
  }
  @Patch(':objectiveId') @UseGuards(ObjectiveWriteGuard) @Idempotent('objective.update') update(
    @CurrentAuth() a: Actor,
    @Param('objectiveId', new ParseUUIDPipe()) id: string,
    @Body() b: UpdateObjectiveDto,
    @Headers('if-match') v?: string,
  ) {
    return this.service.update(a, id, b, v);
  }
}
@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [ObjectiveController],
  providers: [ObjectiveService, ObjectiveWriteGuard],
  exports: [ObjectiveService],
})
export class ObjectiveModule {}
