import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Inject,
  Param,
  Put,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ArrayUnique, IsArray, IsIn, IsString } from 'class-validator';
import { eq, sql } from 'drizzle-orm';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentAuth } from '../auth/current-auth.decorator.js';
import { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { ClientAdminGuard } from '../authorization/client-admin.guard.js';
import { DATABASE } from '../database/database.constants.js';
import { Database, DatabaseExecutor } from '../database/database.types.js';
import { auditEvents, tenants, tenantRolePermissions } from '../database/schema/index.js';
import { Idempotent } from '../idempotency/idempotent.decorator.js';
import { assertResourceMatches, ResourceETagInterceptor } from '../http/resource-etag.js';
import {
  PERMISSIONS,
  ROLES,
  TENANT_ROLES,
  type TenantRole,
  internalRole,
} from './permission-catalogue.js';
class RoleParamDto {
  @IsIn([...TENANT_ROLES, 'super_admin']) role!: TenantRole | 'super_admin';
}
class RolePermissionsDto {
  @IsArray() @ArrayUnique() @IsString({ each: true }) permissions!: string[];
}
@Controller('roles')
@UseGuards(AuthGuard)
@UseInterceptors(ResourceETagInterceptor)
export class RoleController {
  constructor(@Inject(DATABASE) private readonly db: Database) {}
  @Get() list() {
    return { items: ROLES };
  }
  @Get(':role/permissions')
  get(@CurrentAuth() auth: AuthenticatedPrincipal, @Param() params: RoleParamDto) {
    return this.read(auth.tenantId, params.role);
  }
  private async read(
    tenantId: string,
    role: TenantRole | 'super_admin',
    executor: DatabaseExecutor = this.db,
  ) {
    if (role === 'super_admin')
      return {
        role,
        scope: 'platform',
        configurable: false,
        permissions: [],
        message: 'Platform permissions are managed outside tenant authorization',
      };
    const [config] = await executor
      .select()
      .from(tenantRolePermissions)
      .where(
        sql`${tenantRolePermissions.tenantId} = ${tenantId} AND ${tenantRolePermissions.role} = ${role}`,
      );
    const defaults = PERMISSIONS.filter((p) => (p.roles as readonly string[]).includes(role));
    return {
      role,
      configurable: role !== 'tenant_admin',
      permissions: defaults
        .filter((p) => !p.configurable || !config || config.permissions.includes(p.permission))
        .map((p) => p.permission),
      configurablePermissions: defaults
        .filter((p) => p.configurable && role !== 'tenant_admin')
        .map((p) => p.permission),
      updatedAt: config?.updatedAt ?? null,
    };
  }
  @Put(':role/permissions')
  @UseGuards(ClientAdminGuard)
  @Idempotent('role.update_permissions')
  async update(
    @CurrentAuth() auth: AuthenticatedPrincipal,
    @Param() params: RoleParamDto,
    @Body() body: RolePermissionsDto,
    @Headers('if-match') ifMatch?: string,
  ) {
    if (params.role === 'super_admin' || params.role === 'tenant_admin')
      throw new ForbiddenException(
        'Administrator permissions cannot be changed through this endpoint',
      );
    const role = params.role;
    const permitted = PERMISSIONS.filter(
      (p) => p.configurable && (p.roles as readonly string[]).includes(role),
    ).map((p) => p.permission as string);
    if (body.permissions.some((permission) => !permitted.includes(permission)))
      throw new BadRequestException(
        'Only configurable permissions supported by this role are allowed',
      );
    return this.db.transaction(async (tx) => {
      await tx
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.id, auth.tenantId))
        .for('update');
      const before = await this.read(auth.tenantId, role, tx);
      assertResourceMatches(ifMatch, before);
      const permissions = [...body.permissions].sort();
      await tx
        .insert(tenantRolePermissions)
        .values({ tenantId: auth.tenantId, role, permissions })
        .onConflictDoUpdate({
          target: [tenantRolePermissions.tenantId, tenantRolePermissions.role],
          set: { permissions, updatedAt: sql`clock_timestamp()` },
        });
      const after = await this.read(auth.tenantId, role, tx);
      await tx.insert(auditEvents).values({
        tenantId: auth.tenantId,
        actorType: 'user',
        actorUserId: auth.membershipId,
        action: 'role.permissions_updated',
        resourceType: 'role',
        resourceId: role,
        metadata: { before, after },
      });
      await tx.execute(sql`INSERT INTO audit_events (tenant_id, actor_type, actor_user_id, action, resource_type, resource_id, metadata)
        SELECT DISTINCT ${auth.tenantId}::uuid, 'user'::audit_actor_type, ${auth.membershipId}::uuid, 'membership.permissions_updated', 'tenant_membership', user_id::text,
          ${JSON.stringify({ role, before, after })}::jsonb
        FROM user_access_grants WHERE tenant_id = ${auth.tenantId} AND role = ${internalRole(role)}`);
      return after;
    });
  }
}
@Controller('permissions')
@UseGuards(AuthGuard)
export class PermissionCatalogueController {
  @Get() list() {
    return { items: PERMISSIONS };
  }
}
