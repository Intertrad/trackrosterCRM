import { PermissionService } from '../permissions/permission.service.js';
import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';

import { AuthSessionRepository } from './auth-session.repository.js';
import { AuthenticatedRequest } from './auth.types.js';
import { TokenService } from './token.service.js';
import { setRequestTenantContext } from '../database/tenant-context-store.js';
import { withGuardTenantScope } from '../database/guard-tenant-scope.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(TokenService)
    private readonly tokenService: TokenService,

    @Inject(AuthSessionRepository)
    private readonly authSessionRepository: AuthSessionRepository,
    private readonly permissions: PermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const authorization = request.headers.authorization;

    if (!authorization) {
      throw new UnauthorizedException('Authentication required');
    }

    const bearerMatch = /^Bearer ([^\s]+)$/.exec(authorization);

    const token = bearerMatch?.[1];

    if (!token) {
      throw new UnauthorizedException('Authentication required');
    }

    let payload;

    try {
      payload = await this.tokenService.verifyAccessToken(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    let session;

    try {
      session = await this.authSessionRepository.findActiveById({
        sessionId: payload.sid,
        identityId: payload.sub,
        membershipId: payload.membershipId,
        tenantId: payload.tenantId,
      });
    } catch {
      throw new ServiceUnavailableException('Authentication state is temporarily unavailable');
    }

    if (!session) {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    request.auth = {
      identityId: payload.sub,
      membershipId: payload.membershipId,
      tenantId: payload.tenantId,
      sessionId: payload.sid,
      tokenId: payload.jti,
      userId: payload.membershipId,
    };

    setRequestTenantContext({
      tenantId: payload.tenantId,
      membershipId: payload.membershipId,
      identityId: payload.sub,
    });

    /* enforceRequest reads tenant-scoped permission rows, and guards run
       before TenantTransactionInterceptor, so the scope has to be opened
       here — by this point the tenant comes from a verified token. */
    const auth = request.auth;

    await withGuardTenantScope(payload.tenantId, () =>
      this.permissions.enforceRequest(auth, request),
    );
    return true;
  }
}
