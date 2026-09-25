import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { AuthenticatedRequest } from '../auth/auth.types.js';
import { AuthorizationService } from './authorization.service.js';
import { withGuardTenantScope } from '../database/guard-tenant-scope.js';

@Injectable()
export class ClientAdminGuard implements CanActivate {
  constructor(
    @Inject(AuthorizationService)
    private readonly authorizationService: AuthorizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const scoped = context

      .switchToHttp()

      .getRequest<{ auth?: { tenantId?: string } }>();

    return withGuardTenantScope(scoped.auth?.tenantId, async () => {
      const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

      if (!request.auth) {
        throw new UnauthorizedException('Authentication required');
      }

      const isClientAdmin = await this.authorizationService.isClientAdmin(
        request.auth.tenantId,
        request.auth.userId,
      );

      if (!isClientAdmin) {
        throw new ForbiddenException('Client administrator access required');
      }

      return true;
    });
  }
}
