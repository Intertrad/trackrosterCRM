import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { WorkspaceAdministrationService } from './workspace-administration.service.js';
import { withGuardTenantScope } from '../database/guard-tenant-scope.js';

/** Authorization must run before idempotency can replay a previously privileged response. */
@Injectable()
export class TeamManagementGuard implements CanActivate {
  constructor(
    private readonly workspace: WorkspaceAdministrationService,
    private readonly authorization: AuthorizationService,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const scoped = context.switchToHttp().getRequest<{ auth?: { tenantId?: string } }>();
    return withGuardTenantScope(scoped.auth?.tenantId, async () => {
      const request = context.switchToHttp().getRequest<{
        auth: AuthenticatedPrincipal;
        method: string;
        params: { teamId?: string };
        body?: { managerMembershipId?: unknown; status?: unknown };
      }>();
      const id = request.params.teamId;
      if (!id || !isUUID(id)) throw new BadRequestException('Invalid team ID');
      const team = await this.workspace.team(request.auth, id);
      if (
        !(await this.authorization.getAssignmentAuthority(
          request.auth.tenantId,
          request.auth.membershipId,
          team.organizationId,
          id,
        ))
      ) {
        throw new ForbiddenException('Team management access required');
      }
      if (
        request.method === 'DELETE' ||
        request.body?.managerMembershipId !== undefined ||
        request.body?.status !== undefined
      ) {
        if (
          !(await this.authorization.isClientAdmin(
            request.auth.tenantId,
            request.auth.membershipId,
          ))
        )
          throw new ForbiddenException('Tenant administrator access required');
      }
      return true;
    });
  }
}
