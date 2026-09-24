/* @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api/api-error';
import type { SearchResult } from '@/lib/api/search-types';

const { facetsMock, replaceMock, searchMock, searchParamsMock } = vi.hoisted(() => ({
  facetsMock: vi.fn(),

  replaceMock: vi.fn(),

  searchMock: vi.fn(),

  searchParamsMock: vi.fn(() => new URLSearchParams()),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: replaceMock, refresh: vi.fn() }),
  useSearchParams: () => searchParamsMock(),
}));

vi.mock('@/lib/api/search-client', () => ({
  search: searchMock,
  searchFacets: facetsMock,
}));

import SearchPage from './page';

const prospect: SearchResult = {
  id: '11111111-1111-4111-8111-111111111111',

  type: 'prospect',

  title: 'Boulangerie Noël',

  subtitle: 'Lyon',

  updatedAt: '2026-09-20T09:00:00.000Z',
};

const campaign: SearchResult = {
  id: '22222222-2222-4222-8222-222222222222',

  type: 'campaign',

  title: 'Autumn bakery push',

  subtitle: 'active',

  updatedAt: '2026-09-19T09:00:00.000Z',
};

/** Advances past the debounce so a query is actually dispatched. */
async function settleDebounce() {
  await act(async () => {
    vi.advanceTimersByTime(400);
  });
}

describe('SearchPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    searchParamsMock.mockReturnValue(new URLSearchParams());

    searchMock.mockResolvedValue({ items: [prospect, campaign], nextCursor: null });

    facetsMock.mockResolvedValue({
      query: 'bou',
      facets: [
        { type: 'prospect', count: 1 },
        { type: 'organization', count: 0 },
        { type: 'campaign', count: 1 },
      ],
    });
  });

  afterEach(() => {
    cleanup();

    vi.useRealTimers();
  });

  it('asks for nothing until the query is long enough for the API to accept it', async () => {
    render(<SearchPage />);

    fireEvent.change(await screen.findByLabelText('Search'), { target: { value: 'b' } });

    await settleDebounce();

    expect(searchMock).not.toHaveBeenCalled();
    expect(screen.getByText('Type at least 2 characters.')).toBeInTheDocument();
  });

  it('searches once the query is long enough and lists what came back', async () => {
    render(<SearchPage />);

    fireEvent.change(await screen.findByLabelText('Search'), { target: { value: 'bou' } });

    await settleDebounce();

    await waitFor(() => expect(searchMock).toHaveBeenCalledTimes(1));

    expect(searchMock).toHaveBeenCalledWith(
      'bou',
      expect.objectContaining({ type: 'all' }),
      expect.any(AbortSignal),
    );

    expect(await screen.findByText('Boulangerie Noël')).toBeInTheDocument();
    expect(screen.getByText('Autumn bakery push')).toBeInTheDocument();
  });

  it('links each result only where a route actually exists', async () => {
    render(<SearchPage />);

    fireEvent.change(await screen.findByLabelText('Search'), { target: { value: 'bou' } });

    await settleDebounce();

    const campaignLink = await screen.findByRole('link', { name: /Autumn bakery push/ });

    expect(campaignLink).toHaveAttribute('href', `/manager/campaigns/${campaign.id}`);

    /* A prospect has no standalone route, so it opens the queue with the
     * term applied rather than a URL that would 404. */
    expect(screen.getByRole('link', { name: /Boulangerie No/ })).toHaveAttribute(
      'href',
      '/work-queue?search=Boulangerie%20No%C3%ABl',
    );
  });

  it('narrows the request when a facet scope is chosen', async () => {
    render(<SearchPage />);

    fireEvent.change(await screen.findByLabelText('Search'), { target: { value: 'bou' } });

    await settleDebounce();

    fireEvent.click(await screen.findByRole('button', { name: /Campaign/ }));

    await settleDebounce();

    await waitFor(() =>
      expect(searchMock).toHaveBeenLastCalledWith(
        'bou',
        expect.objectContaining({ type: 'campaign' }),
        expect.any(AbortSignal),
      ),
    );
  });

  it('seeds the query from the URL so a shared search reopens as sent', async () => {
    searchParamsMock.mockReturnValue(new URLSearchParams('q=bou'));

    render(<SearchPage />);

    expect(await screen.findByLabelText('Search')).toHaveValue('bou');

    await settleDebounce();

    await waitFor(() => expect(searchMock).toHaveBeenCalled());
  });

  it('says plainly when the workspace is not permitted to search', async () => {
    searchMock.mockRejectedValue(
      new ApiError({
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Forbidden',
        error: 'Forbidden',
      }),
    );

    render(<SearchPage />);

    fireEvent.change(await screen.findByLabelText('Search'), { target: { value: 'bou' } });

    await settleDebounce();

    expect(
      await screen.findByText('You do not have access to search this workspace.'),
    ).toBeInTheDocument();
  });

  it('still shows results when only the facet count request fails', async () => {
    facetsMock.mockRejectedValue(new Error('facets down'));

    render(<SearchPage />);

    fireEvent.change(await screen.findByLabelText('Search'), { target: { value: 'bou' } });

    await settleDebounce();

    expect(await screen.findByText('Boulangerie Noël')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('reports an empty result set as empty rather than as a failure', async () => {
    searchMock.mockResolvedValue({ items: [], nextCursor: null });

    render(<SearchPage />);

    fireEvent.change(await screen.findByLabelText('Search'), { target: { value: 'zzz' } });

    await settleDebounce();

    expect(await screen.findByText(/Nothing matches/)).toBeInTheDocument();
  });
});
