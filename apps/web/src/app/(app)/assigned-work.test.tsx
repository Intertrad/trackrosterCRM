/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

import { ApiError } from '@/lib/api/api-error';
import type { WorkQueueItem } from '@/lib/api/work-queue-types';

const { listWorkQueueMock } = vi.hoisted(() => ({ listWorkQueueMock: vi.fn() }));

vi.mock('@/lib/api/work-queue-client', () => ({ listWorkQueue: listWorkQueueMock }));
vi.mock('@/components/prospector/prospect-detail', () => ({
  ProspectDetail: ({ campaignId, prospectId }: { campaignId: string; prospectId: string }) => (
    <p>
      Detail {campaignId} {prospectId}
    </p>
  ),
}));

import { AssignedWork } from './assigned-work';

const teamId = '11111111-1111-4111-8111-111111111111';

function item(over: Partial<WorkQueueItem> = {}): WorkQueueItem {
  return {
    campaignProspectId: '22222222-2222-4222-8222-222222222222',
    lifecycleStage: 'to_contact',
    latestActivity: null,
    nextFollowUp: null,
    campaign: { id: '33333333-3333-4333-8333-333333333333', name: 'Gendarmeries 2026' },
    assignment: {
      id: '44444444-4444-4444-8444-444444444444',
      organizationId: 'org-1',
      teamId,
      assignedAt: '2026-09-28T08:00:00.000Z',
    },
    establishment: {
      id: '55555555-5555-4555-8555-555555555555',
      regionId: null,
      name: 'Brigade de Bastia',
      addressLine1: '1 rue du Port',
      postalCode: '20200',
      city: 'Bastia',
      countryCode: 'FR',
      latitude: 42.7,
      longitude: 9.45,
      phone: '0495000000',
      website: null,
      status: 'active',
    },
    ...over,
  };
}

function page(items: WorkQueueItem[], nextCursor: string | null = null) {
  return { items, page: { limit: 25, hasMore: nextCursor !== null, nextCursor } };
}

describe('assigned work on Ma journée', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listWorkQueueMock.mockResolvedValue(page([item()]));
  });

  afterEach(cleanup);

  /*
   * The reason this section exists: prospector/today builds its priorities from
   * follow-ups alone, so a prospect assigned this morning has none and showed up
   * nowhere. This is the assignment arriving.
   */
  it('shows an assignment that has no follow-up yet', async () => {
    render(<AssignedWork teamId={teamId} />);

    await waitFor(() => expect(screen.getByText('Brigade de Bastia')).toBeInTheDocument());

    expect(screen.getByText('20200 Bastia · Gendarmeries 2026')).toBeInTheDocument();
    /* Stage in words, not by colour alone. Scoped, because the filter shares the label. */
    expect(screen.getByRole('listitem')).toHaveTextContent('To contact');
  });

  it('asks only for the caller own team, never a wider population', async () => {
    render(<AssignedWork teamId={teamId} />);

    await waitFor(() => expect(listWorkQueueMock).toHaveBeenCalled());

    /*
     * The endpoint scopes to the caller's team and user id upstream, so there is no
     * parameter here that could widen it — and none is sent. This is not a search
     * screen over the référentiel.
     */
    const input = listWorkQueueMock.mock.calls[0]?.[0] as Record<string, unknown>;

    expect(input.teamId).toBe(teamId);
    expect(input).not.toHaveProperty('q');
    expect(input).not.toHaveProperty('assignedUserId');
    expect(input.limit).toBe(25);
  });

  it('opens a prospect at its campaign-scoped route', async () => {
    render(<AssignedWork teamId={teamId} />);

    await waitFor(() => expect(screen.getByText('Brigade de Bastia')).toBeInTheDocument());

    /* The whole row is the target, so a thumb does not need precision. */
    expect(screen.getByRole('link', { name: /Brigade de Bastia/ })).toHaveAttribute(
      'href',
      '/work-queue/33333333-3333-4333-8333-333333333333/22222222-2222-4222-8222-222222222222',
    );
  });

  it('marks a prospect that has a follow-up due', async () => {
    listWorkQueueMock.mockResolvedValue(
      page([
        item({
          nextFollowUp: { id: 'f-1', dueAt: '2026-09-30T09:00:00.000Z' },
          lifecycleStage: 'follow_up',
        }),
      ]),
    );

    render(<AssignedWork teamId={teamId} />);

    await waitFor(() => expect(screen.getByText('Follow-up')).toBeInTheDocument());

    expect(screen.getByText('Follow-up overdue since')).toBeInTheDocument();
  });

  it('opens the side panel without losing the list and restores keyboard focus on close', async () => {
    render(<AssignedWork teamId={teamId} />);
    const row = await screen.findByRole('link', { name: /Brigade de Bastia/ });
    row.focus();
    fireEvent.click(row);
    expect(screen.getByRole('dialog', { name: 'Brigade de Bastia' })).toHaveTextContent(
      'Detail 33333333-3333-4333-8333-333333333333 22222222-2222-4222-8222-222222222222',
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(row).toHaveFocus();
  });

  it('filters to first contacts through the server, not the loaded page', async () => {
    render(<AssignedWork teamId={teamId} />);

    await waitFor(() => expect(listWorkQueueMock).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: 'To contact' }));

    await waitFor(() =>
      expect(listWorkQueueMock).toHaveBeenCalledWith(
        expect.objectContaining({ lifecycleStage: 'to_contact' }),
      ),
    );

    expect(screen.getByRole('button', { name: 'To contact' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('separates an empty day from an empty filter', async () => {
    listWorkQueueMock.mockResolvedValue(page([]));

    render(<AssignedWork teamId={teamId} />);

    await waitFor(() => expect(screen.getByText(/No prospects assigned yet/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'To contact' }));

    await waitFor(() =>
      expect(screen.getByText('No new prospects to contact')).toBeInTheDocument(),
    );
  });

  it('shows a skeleton rather than a bare word while loading', () => {
    listWorkQueueMock.mockReturnValue(new Promise(() => {}));

    render(<AssignedWork teamId={teamId} />);

    expect(screen.getByText('Loading your prospects')).toBeInTheDocument();
  });

  it('offers a retry when the list fails, and recovers', async () => {
    listWorkQueueMock.mockRejectedValueOnce(new Error('network'));

    render(<AssignedWork teamId={teamId} />);

    await waitFor(() =>
      expect(
        screen.getByText('Could not refresh your prospects. Retry to get current data.'),
      ).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(screen.getByText('Brigade de Bastia')).toBeInTheDocument());
  });

  it('leaks nothing when the team is no longer the caller own', async () => {
    listWorkQueueMock.mockRejectedValue(
      new ApiError({ statusCode: 403, code: 'FORBIDDEN', message: 'no', error: 'Forbidden' }),
    );

    render(<AssignedWork teamId={teamId} />);

    await waitFor(() =>
      expect(screen.getByText('You no longer have access to this team.')).toBeInTheDocument(),
    );

    /* No row from a previous render may survive a refusal. */
    expect(screen.queryByRole('link', { name: /Brigade de Bastia/ })).not.toBeInTheDocument();
  });

  it('discloses that the list is bounded', async () => {
    listWorkQueueMock.mockResolvedValue(page([item()], 'more'));

    render(<AssignedWork teamId={teamId} />);

    await waitFor(() =>
      expect(screen.getByText('Latest 25 assignments shown')).toBeInTheDocument(),
    );
  });

  it('gives every control a touch-sized target', async () => {
    render(<AssignedWork teamId={teamId} />);

    await waitFor(() => expect(screen.getByText('Brigade de Bastia')).toBeInTheDocument());

    /*
     * Mobile is P0 for this surface, so the row and the filters are thumb-sized.
     * The class is the formatter's canonical form of a 64px minimum, not the
     * arbitrary-value spelling.
     */
    expect(screen.getByRole('link', { name: /Brigade de Bastia/ }).className).toContain(
      'min-h-[66px]',
    );

    for (const control of screen.getAllByRole('button')) {
      expect(control.className).toContain('h-11');
    }
  });

  /*
   * §24. The same follow-up must not read as overdue on one screen and on time on
   * the other. Both now go through one classifier, and this holds that here.
   */
  it('marks a late follow-up as overdue, using the shared classifier', async () => {
    listWorkQueueMock.mockResolvedValue(
      page([
        item({
          nextFollowUp: { id: 'f-1', dueAt: '2020-01-01T09:00:00.000Z' },
          lifecycleStage: 'follow_up',
        }),
      ]),
    );

    render(<AssignedWork teamId={teamId} />);

    /* Said in words for a screen reader, not carried by the colour alone. */
    await waitFor(() => expect(screen.getByText(/Follow-up overdue since/)).toBeInTheDocument());

    expect(screen.queryByText(/^Follow-up due/)).not.toBeInTheDocument();
  });
});
