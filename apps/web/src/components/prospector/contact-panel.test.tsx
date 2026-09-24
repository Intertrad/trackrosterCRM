/* @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api/api-error';
import type { ProspectAddress, ProspectContact } from '@/lib/api/prospect-contact-types';
import { contactDisplayName, formatAddress, sortContacts } from '@/lib/api/prospect-contact-types';

const { addressesMock, contactsMock } = vi.hoisted(() => ({
  addressesMock: vi.fn(),
  contactsMock: vi.fn(),
}));

vi.mock('@/lib/api/prospect-contact-client', () => ({
  listProspectContacts: contactsMock,
  listProspectAddresses: addressesMock,
}));

import { ContactPanel } from './contact-panel';

const establishmentId = '11111111-1111-4111-8111-111111111111';

function contact(overrides: Partial<ProspectContact> = {}): ProspectContact {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    establishmentId,
    name: 'Amélie Rousseau',
    jobTitle: 'Head of purchasing',
    email: 'amelie@example.test',
    phone: '+33 4 78 00 00 00',
    isPrimary: false,
    status: 'active',
    source: 'manual',
    createdAt: '2026-09-01T09:00:00.000Z',
    updatedAt: '2026-09-01T09:00:00.000Z',
    ...overrides,
  };
}

function address(overrides: Partial<ProspectAddress> = {}): ProspectAddress {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    prospectId: establishmentId,
    label: 'Delivery entrance',
    line1: '12 rue de la Part-Dieu',
    line2: null,
    postalCode: '69003',
    city: 'Lyon',
    region: null,
    countryCode: 'FR',
    latitude: null,
    longitude: null,
    isPrimary: true,
    ...overrides,
  };
}

describe('contact helpers', () => {
  it('puts the primary contact first, then orders by name', () => {
    const ordered = sortContacts([
      contact({ id: 'b', name: 'Zoé Martin' }),
      contact({ id: 'a', name: 'Bruno Tan' }),
      contact({ id: 'p', name: 'Yann Colin', isPrimary: true }),
    ]);

    expect(ordered.map((entry) => entry.name)).toEqual(['Yann Colin', 'Bruno Tan', 'Zoé Martin']);
  });

  it('falls back to whatever identity the contact does carry', () => {
    /* The table only guarantees one of name, email or phone is present, so a
     * nameless contact must still be listed as something. */
    expect(contactDisplayName(contact({ name: null }))).toBe('amelie@example.test');
    expect(contactDisplayName(contact({ name: null, email: null }))).toBe('+33 4 78 00 00 00');
    expect(contactDisplayName(contact({ name: '  ', email: null, phone: null }))).toBe(
      'Unnamed contact',
    );
  });

  it('skips address parts that were never captured', () => {
    expect(formatAddress(address({ line2: null, region: null }))).toBe(
      '12 rue de la Part-Dieu, 69003, Lyon',
    );
  });
});

describe('ContactPanel', () => {
  beforeEach(() => {
    contactsMock.mockResolvedValue({ items: [contact()], nextCursor: null });

    addressesMock.mockResolvedValue({ items: [address()], nextCursor: null });
  });

  afterEach(cleanup);

  it('shows named contacts with reachable phone and email links', async () => {
    render(<ContactPanel establishmentId={establishmentId} />);

    expect(await screen.findByText('Amélie Rousseau')).toBeInTheDocument();
    expect(screen.getByText('Head of purchasing')).toBeInTheDocument();

    expect(screen.getByRole('link', { name: /\+33 4 78 00 00 00/ })).toHaveAttribute(
      'href',
      'tel:+33 4 78 00 00 00',
    );

    expect(screen.getByRole('link', { name: /amelie@example.test/ })).toHaveAttribute(
      'href',
      'mailto:amelie@example.test',
    );
  });

  it('marks which contact is the primary one', async () => {
    contactsMock.mockResolvedValue({
      items: [contact({ isPrimary: true })],
      nextCursor: null,
    });

    render(<ContactPanel establishmentId={establishmentId} />);

    expect(await screen.findByText('Primary')).toBeInTheDocument();
  });

  it('lists addresses alongside the people', async () => {
    render(<ContactPanel establishmentId={establishmentId} />);

    expect(await screen.findByText('Delivery entrance')).toBeInTheDocument();
    expect(screen.getByText('12 rue de la Part-Dieu, 69003, Lyon')).toBeInTheDocument();
  });

  it('renders nothing when the record holds no contacts or addresses', async () => {
    contactsMock.mockResolvedValue({ items: [], nextCursor: null });

    addressesMock.mockResolvedValue({ items: [], nextCursor: null });

    const { container } = render(<ContactPanel establishmentId={establishmentId} />);

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('disappears rather than showing an error when the viewer is not authorised', async () => {
    contactsMock.mockRejectedValue(
      new ApiError({
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Forbidden',
        error: 'Forbidden',
      }),
    );

    const { container } = render(<ContactPanel establishmentId={establishmentId} />);

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('says so when the read fails for a reason other than authorisation', async () => {
    contactsMock.mockRejectedValue(new Error('network down'));

    render(<ContactPanel establishmentId={establishmentId} />);

    expect(await screen.findByText('We could not load contact details.')).toBeInTheDocument();
  });
});
