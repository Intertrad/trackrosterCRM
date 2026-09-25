import { BadRequestException, CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { StructureService } from './structure.service.js';
import { withGuardTenantScope } from '../database/guard-tenant-scope.js';
@Injectable()
export class RosterGuard implements CanActivate {
  constructor(private readonly structure: StructureService) {}
  async canActivate(context: ExecutionContext) {
    const scoped = context.switchToHttp().getRequest<{ auth?: { tenantId?: string } }>();
    return withGuardTenantScope(scoped.auth?.tenantId, async () => {
      const req = context.switchToHttp().getRequest<{
        auth: AuthenticatedPrincipal;
        method: string;
        params: { teamId: string; membershipId?: string };
        query: { periodId?: string };
        body?: { teamRole?: unknown };
      }>();
      const { teamId, membershipId } = req.params;
      if (
        !isUUID(teamId) ||
        (membershipId !== undefined && !isUUID(membershipId)) ||
        (req.query.periodId !== undefined && !isUUID(req.query.periodId))
      )
        throw new BadRequestException('Invalid roster identifier');
      await this.structure.authorizeRoster(req.auth, teamId);
      const admin =
        req.method === 'POST'
          ? req.body?.teamRole === 'manager'
          : req.body?.teamRole !== undefined ||
            (membershipId &&
              (await this.structure.rosterHasManager(
                req.auth,
                teamId,
                membershipId,
                req.query.periodId,
              )));
      if (admin) await this.structure.authorizeRoster(req.auth, teamId, true);
      return true;
    });
  }
}
