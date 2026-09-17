import type {
  AdminAccessGrant,
  AdminOrganization,
  AdminTeam,
  ManagedUser,
} from '@/lib/api/admin-types';

export interface BackendAdminOrganization extends AdminOrganization {
  tenantId: string;
}

export interface BackendAdminTeam extends AdminTeam {
  tenantId: string;
}

export interface BackendManagedUser extends ManagedUser {
  tenantId: string;
}

export interface BackendAdminAccessGrant extends AdminAccessGrant {
  tenantId: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function readAdminJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const value: unknown = await request.json();

    return isRecord(value) ? value : {};
  } catch {
    /*
     * Forward an empty object so Nest remains
     * authoritative for DTO validation and emits
     * TrackRoster's canonical validation response.
     */
    return {};
  }
}

function copyString(
  source: Record<string, unknown>,
  target: Record<string, string>,
  key: string,
): void {
  const value = source[key];

  if (typeof value === 'string') {
    target[key] = value;
  }
}

export function buildCreateOrganizationPayload(
  input: Record<string, unknown>,
): Record<string, string> {
  const payload: Record<string, string> = {};

  copyString(input, payload, 'name');

  copyString(input, payload, 'slug');

  return payload;
}

export function buildOrganizationStatusPayload(
  input: Record<string, unknown>,
): Record<string, string> {
  const payload: Record<string, string> = {};

  copyString(input, payload, 'status');

  return payload;
}

export function buildCreateTeamPayload(input: Record<string, unknown>): Record<string, string> {
  const payload: Record<string, string> = {};

  copyString(input, payload, 'name');

  copyString(input, payload, 'slug');

  return payload;
}

export function buildTeamStatusPayload(input: Record<string, unknown>): Record<string, string> {
  const payload: Record<string, string> = {};

  copyString(input, payload, 'status');

  return payload;
}

export function buildCreateUserPayload(input: Record<string, unknown>): Record<string, string> {
  const payload: Record<string, string> = {};

  copyString(input, payload, 'email');

  copyString(input, payload, 'password');

  return payload;
}

export function buildUserStatusPayload(input: Record<string, unknown>): Record<string, string> {
  const payload: Record<string, string> = {};

  copyString(input, payload, 'status');

  return payload;
}

export function buildCreateAccessGrantPayload(
  input: Record<string, unknown>,
): Record<string, string> {
  const payload: Record<string, string> = {};

  copyString(input, payload, 'role');

  copyString(input, payload, 'scopeType');

  copyString(input, payload, 'organizationId');

  copyString(input, payload, 'teamId');

  return payload;
}

export function toBrowserAdminOrganization(
  organization: BackendAdminOrganization,
): AdminOrganization {
  return {
    id: organization.id,

    name: organization.name,

    slug: organization.slug,

    status: organization.status,

    createdAt: organization.createdAt,

    updatedAt: organization.updatedAt,
  };
}

export function toBrowserAdminTeam(team: BackendAdminTeam): AdminTeam {
  return {
    id: team.id,

    organizationId: team.organizationId,

    name: team.name,

    slug: team.slug,

    status: team.status,

    createdAt: team.createdAt,

    updatedAt: team.updatedAt,
  };
}

export function toBrowserManagedUser(user: BackendManagedUser): ManagedUser {
  return {
    id: user.id,

    email: user.email,

    status: user.status,

    createdAt: user.createdAt,

    updatedAt: user.updatedAt,
  };
}

export function toBrowserAdminAccessGrant(grant: BackendAdminAccessGrant): AdminAccessGrant {
  return {
    id: grant.id,

    userId: grant.userId,

    role: grant.role,

    scopeType: grant.scopeType,

    organizationId: grant.organizationId,

    teamId: grant.teamId,

    createdAt: grant.createdAt,

    updatedAt: grant.updatedAt,
  };
}
