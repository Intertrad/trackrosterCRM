/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

const api = vi.hoisted(() => ({
  invite: vi.fn(),
  organizations: vi.fn(),
  teams: vi.fn(),
  createTeam: vi.fn(),
}));

vi.mock('@/lib/api/membership-client', () => ({ inviteMembership: api.invite }));
vi.mock('@/lib/api/organization-client', () => ({ listOrganizations: api.organizations }));
vi.mock('@/lib/api/team-client', () => ({ listTeams: api.teams, createTeam: api.createTeam }));

import { InviteUserDrawer } from './invite-user-drawer';

describe('invite user drawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.organizations.mockResolvedValue({
      items: [
        { id: 'org-1', tenantId: 'tenant-1', name: 'Arcadia', slug: 'arcadia', status: 'active' },
      ],
      nextCursor: null,
    });
    api.teams.mockResolvedValue({
      items: [
        {
          id: 'team-1',
          tenantId: 'tenant-1',
          organizationId: 'org-1',
          name: 'Paris Prospecting',
          status: 'active',
        },
      ],
      nextCursor: null,
    });
    api.invite.mockResolvedValue({ membershipId: 'membership-1' });
    api.createTeam.mockResolvedValue({
      id: 'team-2',
      tenantId: 'tenant-1',
      organizationId: 'org-1',
      name: 'New Team',
      status: 'active',
    });
  });

  afterEach(cleanup);

  it('requires and submits a valid organization and team scope for prospectors', async () => {
    render(<InviteUserDrawer open onClose={vi.fn()} onInvited={vi.fn()} />);

    const email = screen.getByLabelText('Email');
    fireEvent.change(email, { target: { value: 'new.user@example.com' } });

    const submit = screen.getByRole('button', { name: 'Send invitation' });
    expect(submit).toBeDisabled();

    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'Arcadia' })).toBeInTheDocument(),
    );
    fireEvent.change(screen.getByLabelText('Organization'), { target: { value: 'org-1' } });

    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'Paris Prospecting' })).toBeInTheDocument(),
    );
    fireEvent.change(screen.getByLabelText('Team'), { target: { value: 'team-1' } });
    fireEvent.click(submit);

    await waitFor(() => expect(api.invite).toHaveBeenCalled());
    expect(api.invite).toHaveBeenCalledWith(
      {
        email: 'new.user@example.com',
        role: 'prospector',
        organizationId: 'org-1',
        teamId: 'team-1',
      },
      expect.any(String),
    );
  });

  it('creates and selects the first team when the organization has none', async () => {
    api.teams.mockResolvedValue({ items: [], nextCursor: null });
    render(<InviteUserDrawer open onClose={vi.fn()} onInvited={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'new.user@example.com' },
    });
    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'Arcadia' })).toBeInTheDocument(),
    );
    fireEvent.change(screen.getByLabelText('Organization'), { target: { value: 'org-1' } });

    await waitFor(() =>
      expect(screen.getByText('No team for this organization yet.')).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Create team' }));
    fireEvent.change(screen.getByLabelText('Team name'), { target: { value: 'New Team' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create team' }));

    await waitFor(() =>
      expect(api.createTeam).toHaveBeenCalledWith({
        organizationId: 'org-1',
        name: 'New Team',
        slug: 'new-team',
      }),
    );
    expect(await screen.findByRole('option', { name: 'New Team' })).toBeInTheDocument();
    expect(screen.getByLabelText('Team')).toHaveValue('team-2');
  });
});
