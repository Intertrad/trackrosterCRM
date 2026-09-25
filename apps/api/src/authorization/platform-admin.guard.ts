import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { AuthenticatedRequest } from '../auth/auth.types.js';
import { platformAccessGrants } from '../database/schema/index.js';
import { Database } from '../database/database.types.js';
import { DATABASE } from '../database/database.constants.js';
import { Inject } from '@nestjs/common';
import { withGuardTenantScope } from '../database/guard-tenant-scope.js';

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(@Inject(DATABASE) private readonly database: Database) {}
  async canActivate(context: ExecutionContext) {
    const scoped = context.switchToHttp().getRequest<{ auth?: { tenantId?: string } }>();
    return withGuardTenantScope(scoped.auth?.tenantId, async () => {
      const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
      const identityId = request.auth?.identityId;
      if (!identityId) throw new ForbiddenException('Platform administrator access required');
      const [grant] = await this.database
        .select({ role: platformAccessGrants.role })
        .from(platformAccessGrants)
        .where(
          and(
            eq(platformAccessGrants.identityId, identityId),
            eq(platformAccessGrants.role, 'super_admin'),
            isNull(platformAccessGrants.revokedAt),
          ),
        )
        .limit(1);
      if (!grant) throw new ForbiddenException('Platform administrator access required');
      return true;
    });
  }
}
