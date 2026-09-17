import type { AccessScope, UserRole } from './auth-types';

export type OrganizationStatus = 'active' | 'inactive';

export type TeamStatus = 'active' | 'inactive';

export type ManagedUserStatus = 'active' | 'suspended' | 'disabled';

/*
 * Browser-facing organization.
 *
 * tenantId is intentionally omitted.
 * Tenant authority belongs to the authenticated
 * backend/BFF context and is never selected by
 * the browser.
 */
export interface AdminOrganization {
  id: string;

  name: string;

  slug: string;

  status: OrganizationStatus;

  createdAt: string;

  updatedAt: string;
}

export interface CreateOrganizationInput {
  name: string;

  slug: string;
}

export interface UpdateOrganizationStatusInput {
  status: OrganizationStatus;
}

/*
 * Browser-facing team.
 *
 * organizationId is retained because teams are
 * explicitly nested under organizations in the
 * admin UI.
 *
 * tenantId is intentionally omitted.
 */
export interface AdminTeam {
  id: string;

  organizationId: string;

  name: string;

  slug: string;

  status: TeamStatus;

  createdAt: string;

  updatedAt: string;
}

export interface CreateTeamInput {
  name: string;

  slug: string;
}

export interface UpdateTeamStatusInput {
  status: TeamStatus;
}

/*
 * Browser-facing managed user.
 *
 * Password hashes are never present in this
 * contract.
 *
 * tenantId is also intentionally omitted.
 */
export interface ManagedUser {
  id: string;

  email: string;

  status: ManagedUserStatus;

  createdAt: string;

  updatedAt: string;
}

export interface CreateManagedUserInput {
  email: string;

  password: string;
}

export interface UpdateManagedUserStatusInput {
  status: ManagedUserStatus;
}

/*
 * Browser-facing access grant.
 *
 * Valid role/scope combinations are enforced
 * by the discriminated create input below and
 * again authoritatively by the backend.
 */
export interface AdminAccessGrant {
  id: string;

  userId: string;

  role: UserRole;

  scopeType: AccessScope;

  organizationId: string | null;

  teamId: string | null;

  createdAt: string;

  updatedAt: string;
}

export interface CreateTenantAccessGrantInput {
  role: 'client_admin' | 'observer';

  scopeType: 'tenant';
}

export interface CreateOrganizationAccessGrantInput {
  role: 'director' | 'observer';

  scopeType: 'organization';

  organizationId: string;
}

export interface CreateTeamAccessGrantInput {
  role: 'manager' | 'prospector' | 'observer';

  scopeType: 'team';

  organizationId: string;

  teamId: string;
}

export type CreateAccessGrantInput =
  CreateTenantAccessGrantInput | CreateOrganizationAccessGrantInput | CreateTeamAccessGrantInput;
