/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

import { ApiError } from '@/lib/api/api-error';
import type { Prospect } from '@/lib/api/prospect-types';

const { useAuthMock, listProspectsMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  listProspectsMock: vi.fn(),
}));

vi.mock('@/lib/auth/auth-context', () => ({ useAuth: useAuthMock }));
vi.mock('@/lib/api/prospect-client', () => ({ listProspects: listProspectsMock }));

import ReferentialPage from './page';

function prospect(over: Partial<Prospect> = {}): Prospect {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    tenantId: 't',
    regionId: null,
    externalReference: 'GN-0001',
    name: 'Brigade de Bastia',
    normalizedName: 'brigade de bastia',
    addressLine1: '1 rue du Port',
    postalCode: '20200',
    city: 'Bastia',
    countryCode: 'FR',
    phone: '0495000000',
    website: null,
    latitude: 42.7,
    longitude: 9.45,
    status: 'active',
    source: 'import',
    category: 'prospection',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...over,
  };
}

function adminWorkspace() {
  return {
    activeWorkspace: {
      key: 'tenant:client_admin:-:-',
      mode: 'admin' as const,
      role: 'client_admin' as const,
      scopeType: 'tenant' as const,
      organizationId: null,
      teamId: null,
    },
  };
}

/** The query of the most recent request. */
function lastQuery(): Record<string, unknown> {
  return listProspectsMock.mock.calls.at(-1)?.[0] as Record<string, unknown>;
}

describe('admin référentiel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue(adminWorkspace());
    listProspectsMock.mockResolvedValue({ items: [prospect()], nextCursor: null });
  });

  afterEach(cleanup);

  it('asks the server for the first page and shows the row', async () => {
    render(<ReferentialPage />);

    await waitFor(() => expect(screen.getByText('Brigade de Bastia')).toBeInTheDocument());

    expect(lastQuery()).toMatchObject({ status: 'active', sort: 'name', limit: 50 });
    /* A department is shown but never stored; it is read from the postcode. */
    expect(screen.getByRole('cell', { name: '20' })).toBeInTheDocument();
  });

  /*
   * The point of the whole screen: 14,649 rows cannot be narrowed in the browser,
   * so each filter must appear in the request rather than in a local predicate.
   */
  it('sends section, department, commune, status and ordering to the server', async () => {
    render(<ReferentialPage />);

    await waitFor(() => expect(listProspectsMock).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText('Section'), { target: { value: 'cra' } });
    await waitFor(() => expect(lastQuery()).toMatchObject({ category: 'cra' }));

    fireEvent.change(screen.getByLabelText('Department'), { target: { value: '974' } });
    await waitFor(() => expect(lastQuery()).toMatchObject({ department: '974' }));

    fireEvent.change(screen.getByLabelText('Commune'), { target: { value: 'Lyon' } });
    await waitFor(() => expect(lastQuery()).toMatchObject({ city: 'Lyon' }));

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'all' } });
    await waitFor(() => expect(lastQuery()).toMatchObject({ status: 'all' }));

    fireEvent.change(screen.getByLabelText('Sort'), { target: { value: 'createdAt' } });
    await waitFor(() => expect(lastQuery()).toMatchObject({ sort: 'createdAt' }));
  });

  it('does not send a half-typed department', async () => {
    render(<ReferentialPage />);

    await waitFor(() => expect(listProspectsMock).toHaveBeenCalled());

    /* `9` is not a department and would be a 400 on the API's shape rule. */
    fireEvent.change(screen.getByLabelText('Department'), { target: { value: '9' } });

    await waitFor(() => expect(lastQuery()).not.toHaveProperty('department'));
  });

  it('searches on the server once the typing settles, not on every keystroke', async () => {
    render(<ReferentialPage />);

    await waitFor(() => expect(listProspectsMock).toHaveBeenCalled());

    const field = screen.getByLabelText('Search the référentiel');

    /* Three keystrokes in quick succession, as typing actually arrives. */
    fireEvent.change(field, { target: { value: 'gen' } });
    fireEvent.change(field, { target: { value: 'gendarm' } });
    fireEvent.change(field, { target: { value: 'gendarmerie' } });

    await waitFor(() => expect(lastQuery()).toMatchObject({ search: 'gendarmerie' }));

    /*
     * Only the settled value was ever asked for. A request per keystroke is the
     * wrong trade against a 14,649-row base, and the intermediate ones would also
     * race each other to set the list.
     */
    const searched = listProspectsMock.mock.calls
      .map((call) => (call[0] as { search?: string }).search)
      .filter((value): value is string => value !== undefined);

    expect(searched).toEqual(['gendarmerie']);
  });

  it('pages by cursor and discards the trail when a filter changes', async () => {
    listProspectsMock.mockResolvedValue({ items: [prospect()], nextCursor: 'cursor-2' });

    render(<ReferentialPage />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled());

    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => expect(lastQuery()).toMatchObject({ cursor: 'cursor-2' }));
    expect(screen.getByText(/page 2/)).toBeInTheDocument();

    /*
     * A cursor belongs to the query that produced it. Carrying it across a filter
     * change would ask the API to resume a result set that no longer exists.
     */
    fireEvent.change(screen.getByLabelText('Section'), { target: { value: 'cra' } });

    await waitFor(() => expect(lastQuery()).not.toHaveProperty('cursor'));
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
  });

  it('opens a detail panel from the row it already has, without another request', async () => {
    render(<ReferentialPage />);

    await waitFor(() => expect(screen.getByText('Brigade de Bastia')).toBeInTheDocument());

    const before = listProspectsMock.mock.calls.length;

    fireEvent.click(screen.getByRole('button', { name: 'Brigade de Bastia' }));

    await waitFor(() => expect(screen.getByText('1 rue du Port')).toBeInTheDocument());

    expect(screen.getByText('GN-0001')).toBeInTheDocument();
    /* The listing already returned the whole establishment. */
    expect(listProspectsMock.mock.calls.length).toBe(before);

    fireEvent.click(screen.getByLabelText('Close the detail panel'));

    await waitFor(() => expect(screen.queryByText('1 rue du Port')).not.toBeInTheDocument());
  });

  it('says an establishment without coordinates cannot be mapped', async () => {
    listProspectsMock.mockResolvedValue({
      items: [prospect({ latitude: null, longitude: null })],
      nextCursor: null,
    });

    render(<ReferentialPage />);

    await waitFor(() => expect(screen.getByText('Brigade de Bastia')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Brigade de Bastia' }));

    await waitFor(() => expect(screen.getByText(/cannot be placed on a map/)).toBeInTheDocument());
  });

  it('separates an empty référentiel from an empty filter result', async () => {
    listProspectsMock.mockResolvedValue({ items: [], nextCursor: null });

    render(<ReferentialPage />);

    await waitFor(() => expect(screen.getByText(/The référentiel is empty/)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Section'), { target: { value: 'cra' } });

    await waitFor(() =>
      expect(screen.getByText('No establishment matches these filters.')).toBeInTheDocument(),
    );
  });

  it("shows the API's own message when it rejects a filter", async () => {
    listProspectsMock.mockRejectedValue(
      new ApiError({
        statusCode: 400,
        code: 'BAD_REQUEST',
        message: 'department must match the required pattern',
        error: 'Bad Request',
      }),
    );

    render(<ReferentialPage />);

    await waitFor(() =>
      expect(screen.getByText('department must match the required pattern')).toBeInTheDocument(),
    );
  });

  it('does not render the référentiel for a workspace without administrator access', () => {
    useAuthMock.mockReturnValue({
      activeWorkspace: {
        key: 'team:manager:o:t',
        mode: 'manager' as const,
        role: 'manager' as const,
        scopeType: 'team' as const,
        organizationId: 'o',
        teamId: 't',
      },
    });

    render(<ReferentialPage />);

    /*
     * An establishment outside every campaign is visible to a tenant-scoped grant
     * alone. A guard that still fetched would be a screen of 403s.
     */
    expect(
      screen.getByText('Administration is scoped to workspace administrators.'),
    ).toBeInTheDocument();
    expect(listProspectsMock).not.toHaveBeenCalled();
  });
});
