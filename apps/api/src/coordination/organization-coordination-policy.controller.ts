import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Injectable,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { and, eq } from 'drizzle-orm';
import { AuthGuard } from '../auth/auth.guard.js';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import { ClientAdminGuard } from '../authorization/client-admin.guard.js';
import { DATABASE } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import { organizationCoordinationPolicies } from '../database/schema/organization-coordination-policies.js';
import { Idempotent } from '../idempotency/idempotent.decorator.js';
import { OrganizationCoordinationPolicyRepository } from './organization-coordination-policy.repository.js';

export class OrganizationCoordinationPolicyDto {
  @IsUUID() organizationAId!: string;
  @IsUUID() organizationBId!: string;
  @IsIn(['shared', 'coordinated', 'delayed', 'independent']) policy!:
    'shared' | 'coordinated' | 'delayed' | 'independent';
  @IsOptional() @IsInt() @Min(1) @Max(10080) delayMinutes?: number;
}

@Injectable()
@Controller('organization-coordination-policies')
@UseGuards(AuthGuard, ClientAdminGuard)
export class OrganizationCoordinationPolicyController {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly repository: OrganizationCoordinationPolicyRepository,
  ) {}

  @Get()
  list(@CurrentAuth() auth: AuthenticatedPrincipal) {
    return this.db
      .select()
      .from(organizationCoordinationPolicies)
      .where(eq(organizationCoordinationPolicies.tenantId, auth.tenantId));
  }

  @Post()
  @Idempotent('organization_coordination_policy.create')
  create(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Body() input: OrganizationCoordinationPolicyDto,
  ) {
    return this.repository.create({
      tenantId: auth.tenantId,
      organizationAId: input.organizationAId,
      organizationBId: input.organizationBId,
      policy: input.policy,
      delayMinutes: input.policy === 'delayed' ? (input.delayMinutes ?? 10080) : null,
    });
  }

  @Patch(':policyId')
  @Idempotent('organization_coordination_policy.update')
  async update(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Param('policyId', ParseUUIDPipe) id: string,
    @Body() input: Pick<OrganizationCoordinationPolicyDto, 'policy' | 'delayMinutes'>,
  ) {
    const [row] = await this.db
      .update(organizationCoordinationPolicies)
      .set({
        policy: input.policy,
        delayMinutes: input.policy === 'delayed' ? (input.delayMinutes ?? 10080) : null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(organizationCoordinationPolicies.tenantId, auth.tenantId),
          eq(organizationCoordinationPolicies.id, id),
        ),
      )
      .returning();
    return row;
  }

  @Delete(':policyId')
  @Idempotent('organization_coordination_policy.delete')
  async remove(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Param('policyId', ParseUUIDPipe) id: string,
  ) {
    await this.db
      .delete(organizationCoordinationPolicies)
      .where(
        and(
          eq(organizationCoordinationPolicies.tenantId, auth.tenantId),
          eq(organizationCoordinationPolicies.id, id),
        ),
      );
    return { deleted: true };
  }
}
