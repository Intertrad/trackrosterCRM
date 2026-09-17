import { beforeEach, describe, expect, it, vi } from 'vitest';

const { browserJsonMock } = vi.hoisted(() => ({
  browserJsonMock: vi.fn(),
}));

vi.mock('./browser-json', () => ({
  browserJson: browserJsonMock,
}));

import {
  createAccessGrant,
  createOrganization,
  createTeam,
  createUser,
  listAccessGrants,
  listOrganizations,
  listTeams,
  listUsers,
  revokeAccessGrant,
  updateOrganizationStatus,
  updateTeamStatus,
  updateUserStatus,
} from './admin-client';

describe('admin client', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('lists organizations through the admin BFF without cache', async () => {
    const organizations = [
      {
        id: 'organization-1',
        name: 'France Sales',
        slug: 'france-sales',
        status: 'active' as const,
        createdAt: '2026-09-17T08:00:00.000Z',
        updatedAt: '2026-09-17T08:00:00.000Z',
      },
    ];

    browserJsonMock.mockResolvedValue(organizations);

    const result = await listOrganizations();

    expect(browserJsonMock).toHaveBeenCalledWith('/api/admin/organizations', {
      method: 'GET',
      cache: 'no-store',
    });

    expect(result).toBe(organizations);
  });

  it('creates an organization with only name and slug', async () => {
    const organization = {
      id: 'organization-1',
      name: 'France Sales',
      slug: 'france-sales',
      status: 'active' as const,
      createdAt: '2026-09-17T08:00:00.000Z',
      updatedAt: '2026-09-17T08:00:00.000Z',
    };

    browserJsonMock.mockResolvedValue(organization);

    const result = await createOrganization({
      name: 'France Sales',
      slug: 'france-sales',
    });

    expect(browserJsonMock).toHaveBeenCalledWith('/api/admin/organizations', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: 'France Sales',
        slug: 'france-sales',
      }),
    });

    expect(result).toBe(organization);
  });

  it('URL-encodes organization id when updating status', async () => {
    browserJsonMock.mockResolvedValue({
      id: 'organization/id',
      name: 'France Sales',
      slug: 'france-sales',
      status: 'inactive',
      createdAt: '2026-09-17T08:00:00.000Z',
      updatedAt: '2026-09-17T09:00:00.000Z',
    });

    await updateOrganizationStatus('organization/id ?', {
      status: 'inactive',
    });

    expect(browserJsonMock).toHaveBeenCalledWith(
      '/api/admin/organizations/organization%2Fid%20%3F/status',
      {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          status: 'inactive',
        }),
      },
    );
  });

  it('lists teams using the encoded organization route', async () => {
    const teams = [
      {
        id: 'team-1',
        organizationId: 'organization/id',
        name: 'Paris Prospecting',
        slug: 'paris-prospecting',
        status: 'active' as const,
        createdAt: '2026-09-17T08:00:00.000Z',
        updatedAt: '2026-09-17T08:00:00.000Z',
      },
    ];

    browserJsonMock.mockResolvedValue(teams);

    const result = await listTeams('organization/id');

    expect(browserJsonMock).toHaveBeenCalledWith(
      '/api/admin/organizations/organization%2Fid/teams',
      {
        method: 'GET',
        cache: 'no-store',
      },
    );

    expect(result).toBe(teams);
  });

  it('creates a team with only name and slug', async () => {
    browserJsonMock.mockResolvedValue({
      id: 'team-1',
      organizationId: 'organization-1',
      name: 'Paris Prospecting',
      slug: 'paris-prospecting',
      status: 'active',
      createdAt: '2026-09-17T08:00:00.000Z',
      updatedAt: '2026-09-17T08:00:00.000Z',
    });

    await createTeam('organization-1', {
      name: 'Paris Prospecting',
      slug: 'paris-prospecting',
    });

    expect(browserJsonMock).toHaveBeenCalledWith('/api/admin/organizations/organization-1/teams', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Paris Prospecting',
        slug: 'paris-prospecting',
      }),
    });
  });

  it('URL-encodes both organization and team ids when updating team status', async () => {
    browserJsonMock.mockResolvedValue({
      id: 'team/id',
      organizationId: 'organization/id',
      name: 'Paris Prospecting',
      slug: 'paris-prospecting',
      status: 'inactive',
      createdAt: '2026-09-17T08:00:00.000Z',
      updatedAt: '2026-09-17T09:00:00.000Z',
    });

    await updateTeamStatus('organization/id', 'team?id', {
      status: 'inactive',
    });

    expect(browserJsonMock).toHaveBeenCalledWith(
      '/api/admin/organizations/organization%2Fid/teams/team%3Fid/status',
      {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          status: 'inactive',
        }),
      },
    );
  });

  it('lists users without cache', async () => {
    const users = [
      {
        id: 'user-1',
        email: 'manager@example.com',
        status: 'active' as const,
        createdAt: '2026-09-17T08:00:00.000Z',
        updatedAt: '2026-09-17T08:00:00.000Z',
      },
    ];

    browserJsonMock.mockResolvedValue(users);

    const result = await listUsers();

    expect(browserJsonMock).toHaveBeenCalledWith('/api/admin/users', {
      method: 'GET',
      cache: 'no-store',
    });

    expect(result).toBe(users);
  });

  it('creates a user with only email and password', async () => {
    browserJsonMock.mockResolvedValue({
      id: 'user-1',
      email: 'manager@example.com',
      status: 'active',
      createdAt: '2026-09-17T08:00:00.000Z',
      updatedAt: '2026-09-17T08:00:00.000Z',
    });

    await createUser({
      email: 'manager@example.com',
      password: 'very-secure-password',
    });

    expect(browserJsonMock).toHaveBeenCalledWith('/api/admin/users', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email: 'manager@example.com',
        password: 'very-secure-password',
      }),
    });
  });

  it('URL-encodes user id when updating user status', async () => {
    browserJsonMock.mockResolvedValue({
      id: 'user/id',
      email: 'manager@example.com',
      status: 'suspended',
      createdAt: '2026-09-17T08:00:00.000Z',
      updatedAt: '2026-09-17T09:00:00.000Z',
    });

    await updateUserStatus('user/id ?', {
      status: 'suspended',
    });

    expect(browserJsonMock).toHaveBeenCalledWith('/api/admin/users/user%2Fid%20%3F/status', {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        status: 'suspended',
      }),
    });
  });

  it('lists access grants using the encoded user route', async () => {
    const grants = [
      {
        id: 'grant-1',
        userId: 'user/id',
        role: 'manager' as const,
        scopeType: 'team' as const,
        organizationId: 'organization-1',
        teamId: 'team-1',
        createdAt: '2026-09-17T08:00:00.000Z',
        updatedAt: '2026-09-17T08:00:00.000Z',
      },
    ];

    browserJsonMock.mockResolvedValue(grants);

    const result = await listAccessGrants('user/id');

    expect(browserJsonMock).toHaveBeenCalledWith('/api/admin/users/user%2Fid/access-grants', {
      method: 'GET',
      cache: 'no-store',
    });

    expect(result).toBe(grants);
  });

  it('creates a tenant access grant with only the discriminated input fields', async () => {
    browserJsonMock.mockResolvedValue({
      id: 'grant-1',
      userId: 'user-1',
      role: 'client_admin',
      scopeType: 'tenant',
      organizationId: null,
      teamId: null,
      createdAt: '2026-09-17T08:00:00.000Z',
      updatedAt: '2026-09-17T08:00:00.000Z',
    });

    await createAccessGrant('user-1', {
      role: 'client_admin',
      scopeType: 'tenant',
    });

    expect(browserJsonMock).toHaveBeenCalledWith('/api/admin/users/user-1/access-grants', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        role: 'client_admin',
        scopeType: 'tenant',
      }),
    });
  });

  it('creates an organization access grant with organization scope', async () => {
    browserJsonMock.mockResolvedValue({
      id: 'grant-2',
      userId: 'user-1',
      role: 'director',
      scopeType: 'organization',
      organizationId: 'organization-1',
      teamId: null,
      createdAt: '2026-09-17T08:00:00.000Z',
      updatedAt: '2026-09-17T08:00:00.000Z',
    });

    await createAccessGrant('user-1', {
      role: 'director',
      scopeType: 'organization',
      organizationId: 'organization-1',
    });

    expect(browserJsonMock).toHaveBeenCalledWith('/api/admin/users/user-1/access-grants', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        role: 'director',
        scopeType: 'organization',
        organizationId: 'organization-1',
      }),
    });
  });

  it('creates a team access grant with organization and team scope', async () => {
    browserJsonMock.mockResolvedValue({
      id: 'grant-3',
      userId: 'user-1',
      role: 'manager',
      scopeType: 'team',
      organizationId: 'organization-1',
      teamId: 'team-1',
      createdAt: '2026-09-17T08:00:00.000Z',
      updatedAt: '2026-09-17T08:00:00.000Z',
    });

    await createAccessGrant('user-1', {
      role: 'manager',
      scopeType: 'team',
      organizationId: 'organization-1',
      teamId: 'team-1',
    });

    expect(browserJsonMock).toHaveBeenCalledWith('/api/admin/users/user-1/access-grants', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        role: 'manager',
        scopeType: 'team',
        organizationId: 'organization-1',
        teamId: 'team-1',
      }),
    });
  });

  it('URL-encodes user and grant ids when revoking access', async () => {
    browserJsonMock.mockResolvedValue(undefined);

    const result = await revokeAccessGrant('user/id', 'grant?id');

    expect(browserJsonMock).toHaveBeenCalledWith(
      '/api/admin/users/user%2Fid/access-grants/grant%3Fid',
      {
        method: 'DELETE',
      },
    );

    expect(result).toBeUndefined();
  });

  it('propagates browserJson errors', async () => {
    const error = new Error('admin request failed');

    browserJsonMock.mockRejectedValue(error);

    await expect(listOrganizations()).rejects.toBe(error);
  });
});
