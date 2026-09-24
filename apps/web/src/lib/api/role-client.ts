import { browserJson } from './browser-json';
import { browserResource, type BrowserResource } from './browser-resource';
import type { PermissionCatalogue, RoleCatalogue, RolePermissions } from './role-types';

export function listRoles(signal?: AbortSignal): Promise<RoleCatalogue> {
  return browserJson<RoleCatalogue>('/api/roles', { cache: 'no-store', signal });
}

export function listPermissions(signal?: AbortSignal): Promise<PermissionCatalogue> {
  return browserJson<PermissionCatalogue>('/api/permissions', { cache: 'no-store', signal });
}

/* The ETag is kept because saving permissions is a conditional write. */
export function getRolePermissions(
  role: string,
  signal?: AbortSignal,
): Promise<BrowserResource<RolePermissions>> {
  return browserResource<RolePermissions>(`/api/roles/${encodeURIComponent(role)}/permissions`, {
    cache: 'no-store',
    signal,
  });
}

export function saveRolePermissions(
  role: string,
  permissions: string[],
  options: { etag: string | null; idempotencyKey: string },
): Promise<RolePermissions> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'idempotency-key': options.idempotencyKey,
  };

  if (options.etag) {
    headers['if-match'] = options.etag;
  }

  return browserJson<RolePermissions>(`/api/roles/${encodeURIComponent(role)}/permissions`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ permissions }),
  });
}
