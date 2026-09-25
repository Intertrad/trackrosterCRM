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
import {
  AssignmentBatchDto,
  AssignmentSuggestionDto,
  AssignmentRuleListDto,
  AssignmentRulePatchDto,
  AssignmentSelectionDto,
  CreateAssignmentRuleDto,
} from './assignment-batch.dto.js';
import { AssignmentBatchService } from './assignment-batch.service.js';
import { AssignmentRuleService } from './assignment-rule.service.js';
import { withGuardTenantScope } from '../database/guard-tenant-scope.js';
@Injectable()
export class AssignmentBatchGuard implements CanActivate {
  constructor(private readonly service: AssignmentBatchService) {}
  async canActivate(c: ExecutionContext) {
    const scoped = c.switchToHttp().getRequest<{ auth?: { tenantId?: string } }>();
    return withGuardTenantScope(scoped.auth?.tenantId, async () => {
      const r = c
        .switchToHttp()
        .getRequest<{ auth: AuthenticatedPrincipal; body: AssignmentBatchDto }>();
      if (
        !isUUID(r.body?.campaignId) ||
        (r.body.teamId != null && !isUUID(r.body.teamId)) ||
        (r.body.ruleId != null && !isUUID(r.body.ruleId))
      )
        throw new BadRequestException('Valid campaign and target IDs required');
      await this.service.authorizeBatch(r.auth, r.body);
      return true;
    });
  }
}
@Injectable()
export class AssignmentRuleGuard implements CanActivate {
  constructor(private readonly service: AssignmentBatchService) {}
  async canActivate(c: ExecutionContext) {
    const scoped = c.switchToHttp().getRequest<{ auth?: { tenantId?: string } }>();
    return withGuardTenantScope(scoped.auth?.tenantId, async () => {
      const r = c.switchToHttp().getRequest<{
        auth: AuthenticatedPrincipal;
        params: { ruleId?: string };
        body?: { campaignId?: string };
        query?: { campaignId?: string };
      }>();
      if (r.params.ruleId) {
        if (!isUUID(r.params.ruleId)) throw new BadRequestException('Valid rule ID required');
        await this.service.rule(r.auth, r.params.ruleId);
      } else {
        const id = r.body?.campaignId ?? r.query?.campaignId;
        if (!id || !isUUID(id)) throw new BadRequestException('Valid campaign ID required');
        await this.service.authorize(r.auth, id, null);
      }
      return true;
    });
  }
}
@Controller('assignments')
@UseGuards(AuthGuard, AssignmentBatchGuard)
export class AssignmentBatchController {
  constructor(private readonly service: AssignmentBatchService) {}
  @Post('preview')
  @HttpCode(200)
  preview(@CurrentAuth() a: AuthenticatedPrincipal, @Body() b: AssignmentBatchDto) {
    return this.service.run(a, b, false);
  }
  @Post('bulk')
  @Idempotent('assignment.bulk')
  bulk(@CurrentAuth() a: AuthenticatedPrincipal, @Body() b: AssignmentBatchDto) {
    return this.service.run(a, b, true);
  }
}
@Controller('assignment-rules')
@UseGuards(AuthGuard, AssignmentRuleGuard)
export class AssignmentRuleController {
  constructor(
    private readonly service: AssignmentRuleService,
    private readonly batches: AssignmentBatchService,
  ) {}
  @Get() list(@CurrentAuth() a: AuthenticatedPrincipal, @Query() q: AssignmentRuleListDto) {
    return this.service.list(a, q);
  }
  @Post()
  @Idempotent('assignment_rule.create')
  create(@CurrentAuth() a: AuthenticatedPrincipal, @Body() b: CreateAssignmentRuleDto) {
    return this.service.change(a, 'create', b);
  }
  @Patch(':ruleId')
  @Idempotent('assignment_rule.update')
  update(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('ruleId', new ParseUUIDPipe()) id: string,
    @Body() b: AssignmentRulePatchDto,
    @Headers('if-match') v?: string,
  ) {
    return this.service.change(a, 'update', b, id, v);
  }
  @Delete(':ruleId')
  @Idempotent('assignment_rule.deactivate')
  remove(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('ruleId', new ParseUUIDPipe()) id: string,
    @Headers('if-match') v?: string,
  ) {
    return this.service.change(a, 'deactivate', {}, id, v);
  }
  @Post(':ruleId/simulate')
  @HttpCode(200)
  async simulate(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Param('ruleId', new ParseUUIDPipe()) id: string,
    @Body() b: AssignmentSelectionDto,
  ) {
    const rule = await this.batches.rule(a, id);
    return this.batches.run(a, { ...b, campaignId: rule.campaignId, ruleId: id }, false);
  }
}

@Controller('assignment-suggestions')
@UseGuards(AuthGuard)
export class AssignmentSuggestionController {
  constructor(private readonly batches: AssignmentBatchService) {}
  @Get() async suggest(
    @CurrentAuth() a: AuthenticatedPrincipal,
    @Query() q: AssignmentSuggestionDto,
  ) {
    const rule = await this.batches.rule(a, q.ruleId);
    const result = await this.batches.run(
      a,
      { campaignId: rule.campaignId, ruleId: rule.id, prospectIds: [q.campaignProspectId] },
      false,
      true,
    );
    return {
      ruleId: rule.id,
      strategy: rule.strategy,
      requiredSkills: rule.requiredSkills,
      candidates: [],
      ...result.decisions[0],
    };
  }
}
