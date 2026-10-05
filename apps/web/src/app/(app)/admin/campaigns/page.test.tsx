/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

import { ApiError } from '@/lib/api/api-error';
import type { CampaignEnrolmentResult } from '@/lib/api/campaign-types';

const {
  useAuthMock,
  listCampaignsMock,
  previewCampaignEnrolmentMock,
  applyCampaignEnrolmentMock,
  listUnassignedProspectsMock,
} = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  listCampaignsMock: vi.fn(),
  previewCampaignEnrolmentMock: vi.fn(),
  applyCampaignEnrolmentMock: vi.fn(),
  listUnassignedProspectsMock: vi.fn(),
}));

vi.mock('@/lib/auth/auth-context', () => ({ useAuth: useAuthMock }));

vi.mock('@/lib/api/campaign-client', () => ({
  listCampaigns: listCampaignsMock,
  previewCampaignEnrolment: previewCampaignEnrolmentMock,
  applyCampaignEnrolment: applyCampaignEnrolmentMock,
}));

vi.mock('@/lib/api/assignment-client', () => ({
  listUnassignedProspects: listUnassignedProspectsMock,
}));

import CampaignEnrolmentPage from './page';

const campaignId = '22222222-2222-4222-8222-222222222222';

function result(over: Partial<CampaignEnrolmentResult> = {}): CampaignEnrolmentResult {
  return {
    campaignId,
    mode: 'preview',
    matched: 4524,
    selected: 4524,
    truncated: false,
    enrollable: 4390,
    enrolled: 0,
    alreadyActive: 118,
    alreadyExcluded: 16,
    limit: 10_000,
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

/* The two filters TR-923 added and TR-924 selects on. */
function chooseSection(value = 'prospection'): void {
  fireEvent.change(screen.getByLabelText('Section'), { target: { value } });
}

function typeDepartment(value: string): void {
  fireEvent.change(screen.getByLabelText('Department'), { target: { value } });
}

describe('admin campaign enrolment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue(adminWorkspace());
    listCampaignsMock.mockResolvedValue({
      items: [
        {
          id: campaignId,
          tenantId: 't',
          organizationId: 'o',
          name: 'Gendarmeries 2026',
          description: null,
          status: 'active',
          startsAt: null,
          endsAt: null,
        },
      ],
      nextCursor: null,
    });
    previewCampaignEnrolmentMock.mockResolvedValue(result());
    applyCampaignEnrolmentMock.mockResolvedValue(
      result({ mode: 'apply', enrolled: 4390, enrollable: 4390 }),
    );
    listUnassignedProspectsMock.mockResolvedValue({ items: [], nextCursor: null });
  });

  afterEach(cleanup);

  it('refuses to act until a criterion is chosen, so the whole base cannot be enrolled by accident', async () => {
    render(<CampaignEnrolmentPage />);

    await waitFor(() => expect(screen.getByLabelText('Section')).toBeInTheDocument());

    expect(
      screen.getByText(
        'Select at least one criterion to define which establishments are added to the campaign.',
      ),
    ).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Check the selection' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add to the campaign' })).toBeDisabled();

    chooseSection();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Check the selection' })).toBeEnabled(),
    );
  });

  it('sends the section and department the API names, and only when the department is complete', async () => {
    render(<CampaignEnrolmentPage />);

    await waitFor(() => expect(screen.getByLabelText('Section')).toBeInTheDocument());

    chooseSection();

    /*
     * A half-typed department is not a filter. Sending "9" would be a 400 on the
     * API's shape rule and would read to the operator as a broken screen.
     */
    typeDepartment('9');
    fireEvent.click(screen.getByRole('button', { name: 'Check the selection' }));

    await waitFor(() => expect(previewCampaignEnrolmentMock).toHaveBeenCalled());
    expect(previewCampaignEnrolmentMock.mock.calls[0]?.[1]).not.toHaveProperty('department');

    typeDepartment('974');
    fireEvent.click(screen.getByRole('button', { name: 'Check the selection' }));

    await waitFor(() => expect(previewCampaignEnrolmentMock).toHaveBeenCalledTimes(2));

    expect(previewCampaignEnrolmentMock.mock.calls[1]).toEqual([
      campaignId,
      { category: 'prospection', department: '974', limit: 10_000 },
    ]);
  });

  it('previews without enrolling, then enrols and re-reads the queue from the server', async () => {
    render(<CampaignEnrolmentPage />);

    await waitFor(() => expect(screen.getByLabelText('Section')).toBeInTheDocument());

    chooseSection();
    fireEvent.click(screen.getByRole('button', { name: 'Check the selection' }));

    await waitFor(() => expect(screen.getByText('4524')).toBeInTheDocument());

    /* A preview must not write. */
    expect(applyCampaignEnrolmentMock).not.toHaveBeenCalled();
    expect(screen.getByText('To be added')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Add to the campaign' }));

    await waitFor(() => expect(screen.getByText('Added')).toBeInTheDocument());

    expect(applyCampaignEnrolmentMock).toHaveBeenCalledTimes(1);

    /*
     * The queue is re-fetched rather than guessed at locally: whether a prospect
     * is dispatchable depends on oppositions and on other campaigns, which only
     * the server knows.
     */
    expect(listUnassignedProspectsMock).toHaveBeenCalled();
  });

  it('asks the dispatch queue for the same population it enrolled', async () => {
    render(<CampaignEnrolmentPage />);

    await waitFor(() => expect(screen.getByLabelText('Section')).toBeInTheDocument());

    chooseSection();
    typeDepartment('974');
    fireEvent.click(screen.getByRole('button', { name: 'Add to the campaign' }));

    await waitFor(() => expect(listUnassignedProspectsMock).toHaveBeenCalled());

    const enrolled = applyCampaignEnrolmentMock.mock.calls[0]?.[1] as Record<string, unknown>;
    const queried = listUnassignedProspectsMock.mock.calls[0]?.[0] as Record<string, unknown>;

    /*
     * This is the guarantee the shared filter helper exists for: what was enrolled
     * and what is then shown as dispatchable must be described by the same
     * criteria. A divergence here is how "I added 4,000 prospects and the queue is
     * empty" happens.
     */
    expect(queried.campaignId).toBe(campaignId);
    expect(queried.category).toBe(enrolled.category);
    expect(queried.department).toBe(enrolled.department);
  });

  it('reports already-enrolled and excluded as outcomes, and offers no bulk reactivation', async () => {
    previewCampaignEnrolmentMock.mockResolvedValue(
      result({
        matched: 134,
        selected: 134,
        enrollable: 0,
        alreadyActive: 118,
        alreadyExcluded: 16,
      }),
    );

    render(<CampaignEnrolmentPage />);

    await waitFor(() => expect(screen.getByLabelText('Section')).toBeInTheDocument());

    chooseSection();
    fireEvent.click(screen.getByRole('button', { name: 'Check the selection' }));

    await waitFor(() =>
      expect(
        screen.getByText(
          'Nothing to add: every matching establishment is already in this campaign.',
        ),
      ).toBeInTheDocument(),
    );

    /* Excluded stays excluded; the UI says so and gives no way to undo it in bulk. */
    expect(
      screen.getByText(
        'Establishments excluded from this campaign stay excluded. Reactivate them one at a time if that was a mistake.',
      ),
    ).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: /reactivate/i })).not.toBeInTheDocument();

    /* Nothing to add means the commit is not offered. */
    expect(screen.getByRole('button', { name: 'Add to the campaign' })).toBeDisabled();
  });

  it('discloses truncation instead of silently enrolling part of the selection', async () => {
    previewCampaignEnrolmentMock.mockResolvedValue(
      result({ matched: 14_649, selected: 10_000, truncated: true, limit: 10_000 }),
    );

    render(<CampaignEnrolmentPage />);

    await waitFor(() => expect(screen.getByLabelText('Section')).toBeInTheDocument());

    chooseSection();
    fireEvent.click(screen.getByRole('button', { name: 'Check the selection' }));

    await waitFor(() =>
      expect(screen.getByText(/14649 match and 10000 were taken/)).toBeInTheDocument(),
    );
  });

  it("shows the API's own validation message rather than a generic failure", async () => {
    previewCampaignEnrolmentMock.mockRejectedValue(
      new ApiError({
        statusCode: 400,
        code: 'BAD_REQUEST',
        message: 'Select establishments by id or by at least one filter',
        error: 'Bad Request',
      }),
    );

    render(<CampaignEnrolmentPage />);

    await waitFor(() => expect(screen.getByLabelText('Section')).toBeInTheDocument());

    chooseSection();
    fireEvent.click(screen.getByRole('button', { name: 'Check the selection' }));

    await waitFor(() =>
      expect(
        screen.getByText('Select establishments by id or by at least one filter'),
      ).toBeInTheDocument(),
    );
  });

  it('does not render the workflow for a workspace without administrator access', async () => {
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

    render(<CampaignEnrolmentPage />);

    expect(
      screen.getByText('Administration is scoped to workspace administrators.'),
    ).toBeInTheDocument();

    /* A guard that still fetched would be a screen of 403s. */
    expect(listCampaignsMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Add to the campaign' })).not.toBeInTheDocument();
  });
});
