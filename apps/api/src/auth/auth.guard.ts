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

    await this.permissions.enforceRequest(request.auth, request);
    return true;
  }
}
