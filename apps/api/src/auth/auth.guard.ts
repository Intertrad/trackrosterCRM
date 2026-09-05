import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { AuthenticatedRequest } from './auth.types.js';
import { TokenService } from './token.service.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(TokenService)
    private readonly tokenService: TokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const authorization = request.headers.authorization;

    if (!authorization) {
      throw new UnauthorizedException('Authentication required');
    }

    const [scheme, token] = authorization.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Authentication required');
    }

    try {
      const payload = await this.tokenService.verifyAccessToken(token);

      request.auth = {
        userId: payload.sub,
        tenantId: payload.tenantId,
      };

      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}
