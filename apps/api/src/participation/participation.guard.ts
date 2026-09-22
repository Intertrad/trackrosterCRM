import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import {
  ResourceScopeService,
  type ResourceKind,
} from '../resource-scopes/resource-scope.service.js';
import { ParticipationService } from './participation.service.js';
const key = 'participation-write';
export const ParticipationWrite = (kind: ResourceKind, create = false) =>
  SetMetadata(key, { kind, create });
@Injectable()
export class ParticipationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly service: ParticipationService,
    private readonly scopes: ResourceScopeService,
  ) {}
  async canActivate(context: ExecutionContext) {
    const { kind, create } = this.reflector.get<{ kind: ResourceKind; create: boolean }>(
      key,
      context.getHandler(),
    );
    const req = context.switchToHttp().getRequest<{
      auth: AuthenticatedPrincipal;
      params: Record<string, string>;
      body?: Record<string, unknown>;
    }>();
    const id = create
      ? kind === 'campaign'
        ? req.params.campaignId
        : req.body?.territoryId
      : req.params.id;
    if (
      typeof id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    )
      throw new BadRequestException('Valid resource identifier required');
    if (create) await this.scopes.require(req.auth, kind, id, 'manage');
    else await this.service.requireMutation(req.auth, kind, id);
    return true;
  }
}
