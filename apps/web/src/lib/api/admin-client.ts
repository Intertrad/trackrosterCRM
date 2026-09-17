import { browserJson } from './browser-json';

import type {
  AdminAccessGrant,
  AdminOrganization,
  AdminTeam,
  CreateAccessGrantInput,
  CreateManagedUserInput,
  CreateOrganizationInput,
  CreateTeamInput,
  ManagedUser,
  UpdateManagedUserStatusInput,
  UpdateOrganizationStatusInput,
  UpdateTeamStatusInput,
} from './admin-types';

function buildOrganizationPath(organizationId: string): string {
  return '/api/admin/organizations/' + encodeURIComponent(organizationId);
}

function buildOrganizationTeamsPath(organizationId: string): string {
  return buildOrganizationPath(organizationId) + '/teams';
}

function buildTeamPath(organizationId: string, teamId: string): string {
  return buildOrganizationTeamsPath(organizationId) + '/' + encodeURIComponent(teamId);
}

function buildUserPath(userId: string): string {
  return '/api/admin/users/' + encodeURIComponent(userId);
}

function buildUserAccessGrantsPath(userId: string): string {
  return buildUserPath(userId) + '/access-grants';
}

export async function listOrganizations(): Promise<AdminOrganization[]> {
  return browserJson<AdminOrganization[]>('/api/admin/organizations', {
    method: 'GET',

    cache: 'no-store',
  });
}

export async function createOrganization(
  input: CreateOrganizationInput,
): Promise<AdminOrganization> {
  return browserJson<AdminOrganization>('/api/admin/organizations', {
    method: 'POST',

    headers: {
      'content-type': 'application/json',
    },

    body: JSON.stringify({
      name: input.name,
      slug: input.slug,
    }),
  });
}

export async function updateOrganizationStatus(
  organizationId: string,
  input: UpdateOrganizationStatusInput,
): Promise<AdminOrganization> {
  return browserJson<AdminOrganization>(buildOrganizationPath(organizationId) + '/status', {
    method: 'PATCH',

    headers: {
      'content-type': 'application/json',
    },

    body: JSON.stringify({
      status: input.status,
    }),
  });
}

export async function listTeams(organizationId: string): Promise<AdminTeam[]> {
  return browserJson<AdminTeam[]>(buildOrganizationTeamsPath(organizationId), {
    method: 'GET',

    cache: 'no-store',
  });
}

export async function createTeam(
  organizationId: string,
  input: CreateTeamInput,
): Promise<AdminTeam> {
  return browserJson<AdminTeam>(buildOrganizationTeamsPath(organizationId), {
    method: 'POST',

    headers: {
      'content-type': 'application/json',
    },

    body: JSON.stringify({
      name: input.name,
      slug: input.slug,
    }),
  });
}

export async function updateTeamStatus(
  organizationId: string,
  teamId: string,
  input: UpdateTeamStatusInput,
): Promise<AdminTeam> {
  return browserJson<AdminTeam>(buildTeamPath(organizationId, teamId) + '/status', {
    method: 'PATCH',

    headers: {
      'content-type': 'application/json',
    },

    body: JSON.stringify({
      status: input.status,
    }),
  });
}

export async function listUsers(): Promise<ManagedUser[]> {
  return browserJson<ManagedUser[]>('/api/admin/users', {
    method: 'GET',

    cache: 'no-store',
  });
}

export async function createUser(input: CreateManagedUserInput): Promise<ManagedUser> {
  return browserJson<ManagedUser>('/api/admin/users', {
    method: 'POST',

    headers: {
      'content-type': 'application/json',
    },

    body: JSON.stringify({
      email: input.email,
      password: input.password,
    }),
  });
}

export async function updateUserStatus(
  userId: string,
  input: UpdateManagedUserStatusInput,
): Promise<ManagedUser> {
  return browserJson<ManagedUser>(buildUserPath(userId) + '/status', {
    method: 'PATCH',

    headers: {
      'content-type': 'application/json',
    },

    body: JSON.stringify({
      status: input.status,
    }),
  });
}

export async function listAccessGrants(userId: string): Promise<AdminAccessGrant[]> {
  return browserJson<AdminAccessGrant[]>(buildUserAccessGrantsPath(userId), {
    method: 'GET',

    cache: 'no-store',
  });
}

export async function createAccessGrant(
  userId: string,
  input: CreateAccessGrantInput,
): Promise<AdminAccessGrant> {
  return browserJson<AdminAccessGrant>(buildUserAccessGrantsPath(userId), {
    method: 'POST',

    headers: {
      'content-type': 'application/json',
    },

    body: JSON.stringify(input),
  });
}

export async function revokeAccessGrant(userId: string, grantId: string): Promise<void> {
  return browserJson<void>(buildUserAccessGrantsPath(userId) + '/' + encodeURIComponent(grantId), {
    method: 'DELETE',
  });
}
