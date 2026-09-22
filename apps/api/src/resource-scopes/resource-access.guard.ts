import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedPrincipal } from '../auth/auth.types.js';
import {
  ResourceScopeService,
  type ResourceKind,
  type ResourceLevel,
} from './resource-scope.service.js';
const key = 'resource-scope-access';
export const ResourceAccess = (kind: ResourceKind, level: ResourceLevel) =>
  SetMetadata(key, { kind, level });
@Injectable()
export class ResourceAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly scopes: ResourceScopeService,
  ) {}
  async canActivate(context: ExecutionContext) {
    const rule = this.reflector.get<{ kind: ResourceKind; level: ResourceLevel }>(
      key,
      context.getHandler(),
    );
    const request = context.switchToHttp().getRequest<{
      auth: AuthenticatedPrincipal;
      params: Record<string, string>;
      body?: Record<string, unknown>;
    }>();
    const id = request.params[`${rule.kind}Id`];
    // Parameter pipes run after guards: reject malformed IDs without a DB cast.
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
      return false;
    const body =
      request.body && typeof request.body === 'object' && !Array.isArray(request.body)
        ? request.body
        : undefined;
    const level =
      body && ('status' in body || (rule.kind === 'territory' && 'parentId' in body))
        ? 'manage'
        : rule.level;
    await this.scopes.require(request.auth, rule.kind, id, level);
    const relatedTerritory =
      rule.kind === 'campaign' ? (request.params.territoryId ?? body?.territoryId) : body?.parentId;
    if (relatedTerritory !== undefined && relatedTerritory !== null) {
      if (
        typeof relatedTerritory !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(relatedTerritory)
      )
        return false;
      await this.scopes.require(request.auth, 'territory', relatedTerritory);
    }
    return true;
  }
}
