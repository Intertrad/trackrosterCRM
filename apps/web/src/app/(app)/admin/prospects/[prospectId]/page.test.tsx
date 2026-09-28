/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

import { ApiError } from '@/lib/api/api-error';
import type { ConsentPage } from '@/lib/api/consent-types';
import type { ProspectContact } from '@/lib/api/prospect-contact-types';
import type { ProspectDetail } from '@/lib/api/prospect-types';

const {
  useAuthMock,
  useParamsMock,
  getProspectMock,
  listProspectCampaignMembershipsMock,
  listProspectContactsMock,
  listProspectAddressesMock,
  listConsentsMock,
} = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  useParamsMock: vi.fn(),
  getProspectMock: vi.fn(),
  listProspectCampaignMembershipsMock: vi.fn(),
  listProspectContactsMock: vi.fn(),
  listProspectAddressesMock: vi.fn(),
  listConsentsMock: vi.fn(),
}));

vi.mock('@/lib/auth/auth-context', () => ({ useAuth: useAuthMock }));
vi.mock('next/navigation', () => ({ useParams: useParamsMock }));
vi.mock('@/lib/api/prospect-client', () => ({
  getProspect: getProspectMock,
  listProspectCampaignMemberships: listProspectCampaignMembershipsMock,
}));
vi.mock('@/lib/api/prospect-contact-client', () => ({
  listProspectContacts: listProspectContactsMock,
  listProspectAddresses: listProspectAddressesMock,
}));
vi.mock('@/lib/api/consent-client', () => ({ listConsents: listConsentsMock }));

import ProspectDetailPage from './page';

const prospectId = '44444444-4444-4444-8444-444444444444';

function detail(over: Partial<ProspectDetail> = {}): ProspectDetail {
  return {
    id: prospectId,
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
    tags: [{ id: 'tag-1', name: 'Priorité', color: null }],
    customFields: { langue: 'Corse' },
    mergedIntoId: null,
    mergedSourceIds: [],
    ...over,
  };
}

function contact(over: Partial<ProspectContact> = {}): ProspectContact {
  return {
    id: 'contact-1',
    establishmentId: prospectId,
    name: 'Jean Dupont',
    jobTitle: 'Responsable administratif',
    email: 'jean.dupont@example.test',
    phone: '0495000001',
    isPrimary: true,
    status: 'active',
    source: 'manual',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...over,
  };
}

function consents(over: Partial<ConsentPage> = {}): ConsentPage {
  return {
    items: [],
    nextCursor: null,
    restrictions: [
      { channel: 'phone', blocked: false },
      { channel: 'email', blocked: false },
      { channel: 'sms', blocked: false },
      { channel: 'visit', blocked: false },
    ],
    ...over,
  };
}

function admin() {
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

describe('admin establishment detail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue(admin());
    useParamsMock.mockReturnValue({ prospectId });
    getProspectMock.mockResolvedValue(detail());
    listProspectContactsMock.mockResolvedValue({ items: [contact()], nextCursor: null });
    listProspectAddressesMock.mockResolvedValue({ items: [], nextCursor: null });
    listConsentsMock.mockResolvedValue(consents());
    listProspectCampaignMembershipsMock.mockResolvedValue({ items: [] });
  });

  afterEach(cleanup);

  it('renders the master record and separates what the team recorded', async () => {
    render(<ProspectDetailPage />);

    await waitFor(() => expect(screen.getByText('1 rue du Port')).toBeInTheDocument());

    expect(screen.getByText('20200 Bastia')).toBeInTheDocument();
    expect(screen.getByText('42.70000, 9.45000')).toBeInTheDocument();
    expect(screen.getByText('GN-0001')).toBeInTheDocument();

    /* Derived for display, never stored. */
    expect(screen.getByText('20')).toBeInTheDocument();

    /*
     * Master data and prospecting intelligence are different things: a prospector
     * enriches the second without editing the first.
     */
    expect(screen.getByText('Recorded by the team')).toBeInTheDocument();
    expect(screen.getByText('Corse')).toBeInTheDocument();
    expect(screen.getByText('Priorité')).toBeInTheDocument();
  });

  it('loads the record, its contacts, addresses and consents without a waterfall', async () => {
    render(<ProspectDetailPage />);

    await waitFor(() => expect(screen.getByText('Jean Dupont')).toBeInTheDocument());

    /* Four reads, one per section, and the three dependents run together. */
    expect(getProspectMock).toHaveBeenCalledTimes(1);
    expect(listProspectContactsMock).toHaveBeenCalledTimes(1);
    expect(listProspectAddressesMock).toHaveBeenCalledTimes(1);
    expect(listConsentsMock).toHaveBeenCalledTimes(1);

    expect(screen.getByText('Responsable administratif')).toBeInTheDocument();
    expect(screen.getByText('0495000001')).toBeInTheDocument();
  });

  it('shows no "undefined" or "null" for a record with nothing optional set', async () => {
    getProspectMock.mockResolvedValue(
      detail({
        addressLine1: null,
        postalCode: null,
        city: null,
        phone: null,
        website: null,
        latitude: null,
        longitude: null,
        externalReference: null,
        category: null,
        tags: [],
        customFields: {},
      }),
    );

    render(<ProspectDetailPage />);

    await waitFor(() => expect(screen.getByText('Informations')).toBeInTheDocument());

    const body = document.body.textContent ?? '';

    expect(body).not.toMatch(/undefined/);
    expect(body).not.toMatch(/\bnull\b/);
    /* A missing value is stated rather than blank. */
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    expect(screen.getByText(/cannot be mapped/)).toBeInTheDocument();
  });

  /*
   * The restriction state is the API's, resolved by the same function the
   * reservation guard consults. The page shows it and never recomputes it.
   */
  it('states the permission per channel in words and not by colour alone', async () => {
    render(<ProspectDetailPage />);

    await waitFor(() => expect(screen.getByText('Contact permission')).toBeInTheDocument());

    expect(screen.getAllByText('Allowed')).toHaveLength(4);
    expect(screen.queryByText(/Do not contact/)).not.toBeInTheDocument();
  });

  it('makes an opposition operationally obvious', async () => {
    listConsentsMock.mockResolvedValue(
      consents({
        restrictions: [
          { channel: 'phone', blocked: true },
          { channel: 'email', blocked: false },
          { channel: 'sms', blocked: false },
          { channel: 'visit', blocked: true },
        ],
      }),
    );

    render(<ProspectDetailPage />);

    await waitFor(() =>
      expect(screen.getByText('Do not contact by phone, visit.')).toBeInTheDocument(),
    );

    expect(screen.getAllByText('Do not contact')).toHaveLength(2);
    expect(screen.getAllByText('Allowed')).toHaveLength(2);
  });

  it('fails closed when the restrictions cannot be read', async () => {
    listConsentsMock.mockRejectedValue(new Error('consent read failed'));

    render(<ProspectDetailPage />);

    /*
     * Unknown is not the same as allowed. A failed consent read must not render as
     * a contactable establishment.
     */
    await waitFor(() =>
      expect(screen.getByText(/Treat this establishment as do-not-contact/)).toBeInTheDocument(),
    );

    /* The record itself is still readable. */
    expect(screen.getByText('1 rue du Port')).toBeInTheDocument();
  });

  it('distinguishes no restriction recorded from a failed read', async () => {
    listConsentsMock.mockResolvedValue(consents({ restrictions: [] }));

    render(<ProspectDetailPage />);

    await waitFor(() =>
      expect(screen.getByText(/No restriction has been recorded/)).toBeInTheDocument(),
    );

    expect(
      screen.queryByText(/Treat this establishment as do-not-contact/),
    ).not.toBeInTheDocument();
  });

  it('says an empty contact list is empty, not missing', async () => {
    listProspectContactsMock.mockResolvedValue({ items: [], nextCursor: null });

    render(<ProspectDetailPage />);

    await waitFor(() =>
      expect(
        screen.getByText('No contact has been recorded for this establishment.'),
      ).toBeInTheDocument(),
    );
  });

  it('warns that a merged record is superseded', async () => {
    getProspectMock.mockResolvedValue(detail({ mergedIntoId: 'other-establishment' }));

    render(<ProspectDetailPage />);

    await waitFor(() =>
      expect(
        screen.getByText('This record was merged into another establishment.'),
      ).toBeInTheDocument(),
    );
  });

  it('shows a skeleton while the record loads, not a bare word', async () => {
    getProspectMock.mockReturnValue(new Promise(() => {}));

    render(<ProspectDetailPage />);

    expect(screen.getByText('Loading the establishment')).toBeInTheDocument();
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });

  it('offers a way back when the establishment is not there', async () => {
    getProspectMock.mockRejectedValue(
      new ApiError({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Prospect not found',
        error: 'Not Found',
      }),
    );

    render(<ProspectDetailPage />);

    await waitFor(() => expect(screen.getByText('Establishment not found')).toBeInTheDocument());

    expect(screen.getByRole('link', { name: /Back to Prospects/ })).toHaveAttribute(
      'href',
      '/admin/prospects',
    );
  });

  it('reveals nothing when access is refused', async () => {
    getProspectMock.mockRejectedValue(
      new ApiError({ statusCode: 403, code: 'FORBIDDEN', message: 'no', error: 'Forbidden' }),
    );

    render(<ProspectDetailPage />);

    await waitFor(() =>
      expect(screen.getByText('You do not have access to this establishment.')).toBeInTheDocument(),
    );

    /* Not one field of the record may appear beside a refusal. */
    expect(screen.queryByText('Informations')).not.toBeInTheDocument();
    expect(screen.queryByText('1 rue du Port')).not.toBeInTheDocument();
  });

  it('retries on failure rather than falling back to stale list data', async () => {
    getProspectMock.mockRejectedValueOnce(
      new ApiError({ statusCode: 500, code: 'SERVER', message: 'upstream broke', error: 'Error' }),
    );

    render(<ProspectDetailPage />);

    await waitFor(() => expect(screen.getByText('upstream broke')).toBeInTheDocument());

    /*
     * No fields from the listing row are shown here. Falling back would disguise a
     * real integration failure as a working page.
     */
    expect(screen.queryByText('1 rue du Port')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Try again/ }));

    await waitFor(() => expect(screen.getByText('1 rue du Port')).toBeInTheDocument());
  });

  /*
   * The prospecting context is a separate contract and a separate request. It is
   * the newest thing on the page and the likeliest to break, and a record that
   * reads fine must go on reading fine when it does.
   */
  it('keeps the master record readable when the prospecting context fails', async () => {
    listProspectCampaignMembershipsMock.mockRejectedValue(new Error('context unavailable'));

    render(<ProspectDetailPage />);

    await waitFor(() =>
      expect(screen.getByText('Unable to load prospecting context.')).toBeInTheDocument(),
    );

    /* The establishment itself is untouched by that failure. */
    expect(screen.getByText('1 rue du Port')).toBeInTheDocument();
    expect(screen.getByText('Jean Dupont')).toBeInTheDocument();
    expect(screen.getByText('Contact permission')).toBeInTheDocument();
  });

  it('does not render the record for a workspace without administrator access', () => {
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

    render(<ProspectDetailPage />);

    expect(
      screen.getByText('Administration is scoped to workspace administrators.'),
    ).toBeInTheDocument();
    expect(getProspectMock).not.toHaveBeenCalled();
  });
});
