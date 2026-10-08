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

const nav = vi.hoisted(() => ({
  query: '',
  listeners: new Set<() => void>(),
  router: {
    replace: vi.fn((url: string) => {
      nav.query = url.split('?')[1] ?? '';
      nav.listeners.forEach((fn) => fn());
    }),
  },
}));
vi.mock('next/navigation', async () => {
  const { useSyncExternalStore } = await import('react');
  return {
    usePathname: () => '/admin/prospects',
    useRouter: () => nav.router,
    useSearchParams: () =>
      new URLSearchParams(
        useSyncExternalStore(
          (fn) => {
            nav.listeners.add(fn);
            return () => {
              nav.listeners.delete(fn);
            };
          },
          () => nav.query,
        ),
      ),
  };
});
vi.mock('@/components/prospector/prospect-map', () => ({
  ProspectMap: () => null,
  toMapPoint: () => [],
}));

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
    assignments: [],
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
    nav.query = '';
    useAuthMock.mockReturnValue(adminWorkspace());
    listProspectsMock.mockResolvedValue({ items: [prospect()], nextCursor: null });
  });

  afterEach(cleanup);

  it('asks the server for the first page and shows the row', async () => {
    render(<ReferentialPage />);

    await waitFor(() => expect(screen.getByText('Brigade de Bastia')).toBeInTheDocument());

    expect(lastQuery()).toMatchObject({ status: 'active', sort: 'name', limit: 50 });
    /* A department is shown but never stored; it is read from the postcode. */
    expect(screen.getByText('20200')).toBeInTheDocument();
  });

  /*
   * The point of the whole screen: 14,649 rows cannot be narrowed in the browser,
   * so each filter must appear in the request rather than in a local predicate.
   */
  it('sends composable address filters, status and ordering to the server', async () => {
    render(<ReferentialPage />);

    await waitFor(() => expect(listProspectsMock).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText('Section'), { target: { value: 'cra' } });
    await waitFor(() => expect(lastQuery()).toMatchObject({ category: 'cra' }));

    fireEvent.change(screen.getByLabelText('Department'), { target: { value: '974' } });
    fireEvent.blur(screen.getByLabelText('Department'));
    await waitFor(() => expect(lastQuery()).toMatchObject({ department: '974' }));

    fireEvent.change(screen.getByLabelText('Postcode'), { target: { value: '97400' } });
    fireEvent.blur(screen.getByLabelText('Postcode'));
    await waitFor(() => expect(lastQuery()).toMatchObject({ postalCode: '97400' }));

    fireEvent.change(screen.getByLabelText('Town'), { target: { value: 'Lyon' } });
    fireEvent.blur(screen.getByLabelText('Town'));
    await waitFor(() => expect(lastQuery()).toMatchObject({ city: 'Lyon' }));

    fireEvent.change(screen.getByLabelText('Address'), { target: { value: 'Rue Victor Hugo' } });
    fireEvent.blur(screen.getByLabelText('Address'));
    await waitFor(() => expect(lastQuery()).toMatchObject({ address: 'Rue Victor Hugo' }));

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

    const field = screen.getByLabelText('Search prospects');

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

    expect(screen.getByRole('button', { name: 'First page' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => expect(lastQuery()).toMatchObject({ cursor: 'cursor-2' }));
    expect(nav.query).toContain('cursor=cursor-2');

    /*
     * A cursor belongs to the query that produced it. Carrying it across a filter
     * change would ask the API to resume a result set that no longer exists.
     */
    fireEvent.change(screen.getByLabelText('Section'), { target: { value: 'cra' } });

    await waitFor(() => expect(lastQuery()).not.toHaveProperty('cursor'));
    expect(screen.getByRole('button', { name: 'First page' })).toBeDisabled();
  });

  it('shows the current page range against the filtered total', async () => {
    const firstPage = Array.from({ length: 50 }, (_, index) =>
      prospect({
        id: `44444444-4444-4444-8444-${String(index + 1).padStart(12, '0')}`,
        name: `Prospect ${index + 1}`,
      }),
    );
    const secondPage = Array.from({ length: 50 }, (_, index) =>
      prospect({
        id: `55555555-5555-4555-8555-${String(index + 1).padStart(12, '0')}`,
        name: `Prospect ${index + 51}`,
      }),
    );
    listProspectsMock
      .mockResolvedValueOnce({ items: firstPage, nextCursor: 'cursor-2', total: 101 })
      .mockResolvedValueOnce({ items: secondPage, nextCursor: null, total: 101 });

    render(<ReferentialPage />);

    await waitFor(() => expect(screen.getByText('1–50 of 101')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(screen.getByText('51–100 of 101')).toBeInTheDocument());
  });

  it('shows the current assignment owner in the admin table', async () => {
    listProspectsMock.mockResolvedValue({
      items: [
        prospect({
          assignments: [
            {
              id: 'assignment-1',
              campaignId: 'campaign-1',
              campaignName: 'Gendarmeries 2026',
              organizationId: 'organization-1',
              organizationName: 'OFTI',
              teamId: 'team-1',
              teamName: 'Nancy team',
              assignedUserId: 'member-1',
              assignedUserName: 'Amel Diallo',
              status: 'active',
            },
          ],
        }),
      ],
      nextCursor: null,
      total: 1,
    });

    render(<ReferentialPage />);

    await waitFor(() => expect(screen.getByText('Amel Diallo')).toBeInTheDocument());
    expect(screen.getByText('Assigned to')).toBeInTheDocument();
  });

  it('keeps the explicit selection on pagination and clears it when filters change', async () => {
    listProspectsMock.mockResolvedValue({ items: [prospect()], nextCursor: 'cursor-2' });
    render(<ReferentialPage />);
    await screen.findByLabelText('Select Brigade de Bastia');
    fireEvent.click(screen.getByLabelText('Select Brigade de Bastia'));
    expect(screen.getByRole('button', { name: 'Assign selection (1)' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(lastQuery()).toMatchObject({ cursor: 'cursor-2' }));
    expect(screen.getByRole('button', { name: 'Assign selection (1)' })).toBeEnabled();
    fireEvent.change(screen.getByLabelText('Section'), { target: { value: 'cra' } });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Assign selection (0)' })).toBeDisabled(),
    );
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

    fireEvent.click(screen.getByLabelText('Close'));

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

    await waitFor(() =>
      expect(screen.getByText(/No coordinates are available/)).toBeInTheDocument(),
    );
  });

  it('separates an empty référentiel from an empty filter result', async () => {
    listProspectsMock.mockResolvedValue({ items: [], nextCursor: null });

    render(<ReferentialPage />);

    await waitFor(() => expect(screen.getByText(/The prospect base is empty/)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Section'), { target: { value: 'cra' } });

    await waitFor(() =>
      expect(screen.getByText('No establishments match these filters.')).toBeInTheDocument(),
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

  it('clears displayed rows and selection when access is revoked during a refresh', async () => {
    render(<ReferentialPage />);
    await screen.findByText('Brigade de Bastia');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select active prospects on this page' }));
    listProspectsMock.mockRejectedValue(
      new ApiError({
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Forbidden',
        error: 'Forbidden',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Refresh prospects' }));
    await screen.findByText('Your access no longer permits viewing this base.');
    expect(screen.queryByText('Brigade de Bastia')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Assign selection (0)' })).toBeDisabled();
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
