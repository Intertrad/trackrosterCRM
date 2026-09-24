/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

import { ApiError } from '@/lib/api/api-error';
import type { OverrideRequestDetail, OverrideRequestSummary } from '@/lib/api/override-types';

const { listMock, getMock, decideMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  getMock: vi.fn(),
  decideMock: vi.fn(),
}));

vi.mock('@/lib/api/override-client', () => ({
  listOverrideRequests: listMock,
  getOverrideRequest: getMock,
  decideOverrideRequest: decideMock,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/manager/approvals',
}));

import ApprovalsQueuePage from './page';
import { OverrideRequestView } from './[requestId]/override-request-view';

const requestId = '11111111-1111-4111-8111-111111111111';

const summary: OverrideRequestSummary = {
  id: requestId,
  collisionId: '22222222-2222-4222-8222-222222222222',
  campaignProspectId: '33333333-3333-4333-8333-333333333333',
  requestedBy: '44444444-4444-4444-8444-444444444444',
  reason: 'Client asked for a call today about the new range.',
  status: 'pending',
  decidedBy: null,
  decisionReason: null,
  decidedAt: null,
  overrideId: null,
  createdAt: '2026-09-22T13:22:00.000Z',
  updatedAt: '2026-09-22T13:22:00.000Z',
  etag: '"v1"',
};

const detail: OverrideRequestDetail = {
  ...summary,
  approval: null,
  collision: {
    id: summary.collisionId,
    campaignId: '55555555-5555-4555-8555-555555555555',
    campaignProspectId: summary.campaignProspectId,
    assignmentId: null,
    detectedBy: summary.requestedBy,
    createdAt: '2026-09-22T13:20:00.000Z',
    expiresAt: '2026-09-22T18:00:00.000Z',
    decision: 'require_override',
    reasonCode: 'ACTIVE_RESERVATION',
    policy: { evaluatorVersion: 'v3', defaultCoolingOffMinutes: 1440 },
    overrideable: true,
  },
};

describe('Approvals queue', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    listMock.mockResolvedValue({ items: [summary], nextCursor: null });
  });

  afterEach(cleanup);

  it('asks the backend for pending requests by default', async () => {
    render(<ApprovalsQueuePage />);

    await screen.findByText(summary.reason);

    expect(listMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending' }),
      expect.any(AbortSignal),
    );
  });

  it('refetches when the status tab changes rather than filtering locally', async () => {
    render(<ApprovalsQueuePage />);

    await screen.findByText(summary.reason);

    fireEvent.click(screen.getByRole('button', { name: 'Approved' }));

    await waitFor(() => {
      expect(listMock).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'approved' }),
        expect.any(AbortSignal),
      );
    });
  });

  it('links each row to its decision screen', async () => {
    render(<ApprovalsQueuePage />);

    expect(await screen.findByRole('link', { name: new RegExp(summary.reason) })).toHaveAttribute(
      'href',
      `/manager/approvals/${requestId}`,
    );
  });

  it('surfaces a permission failure instead of an empty queue', async () => {
    listMock.mockRejectedValue(
      new ApiError({ statusCode: 403, code: 'FORBIDDEN', message: 'no', error: 'Forbidden' }),
    );

    render(<ApprovalsQueuePage />);

    expect(
      await screen.findByText('You do not have override authority for this scope.'),
    ).toBeInTheDocument();
  });
});

describe('Override request decision', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getMock.mockResolvedValue(detail);
    decideMock.mockResolvedValue({
      ...detail,
      status: 'approved',
      decidedAt: '2026-09-22T13:40:00.000Z',
      decisionReason: 'Time-sensitive client request.',
    });
  });

  afterEach(cleanup);

  it('shows the server collision decision, not an invented rule list', async () => {
    render(<OverrideRequestView requestId={requestId} />);

    expect(await screen.findByText('Manager decision required')).toBeInTheDocument();
    expect(screen.getByText('Another member holds an active reservation')).toBeInTheDocument();
  });

  it('refuses a decision until the mandatory reason is long enough', async () => {
    render(<OverrideRequestView requestId={requestId} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Approve override' }));

    expect(screen.getByText('A reason of at least 10 characters is required')).toBeInTheDocument();

    expect(decideMock).not.toHaveBeenCalled();
  });

  it('echoes the validator back so a concurrent decision cannot be overwritten', async () => {
    render(<OverrideRequestView requestId={requestId} />);

    fireEvent.change(await screen.findByLabelText('Decision reason'), {
      target: { value: 'Time-sensitive client request, owner informed.' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Approve override' }));

    await waitFor(() => {
      expect(decideMock).toHaveBeenCalledWith(
        requestId,
        'approve',
        'Time-sensitive client request, owner informed.',
        '"v1"',
      );
    });
  });

  it('reloads the current state when the request changed underneath', async () => {
    decideMock.mockRejectedValue(
      new ApiError({
        statusCode: 412,
        code: 'RESOURCE_VERSION_CONFLICT',
        message: 'changed',
        error: 'Precondition Failed',
      }),
    );

    render(<OverrideRequestView requestId={requestId} />);

    fireEvent.change(await screen.findByLabelText('Decision reason'), {
      target: { value: 'Approving after reviewing the conflict.' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Approve override' }));

    expect(await screen.findByText(/This request changed since you opened it/)).toBeInTheDocument();

    /* The screen must re-read rather than leave stale data on display. */
    await waitFor(() => {
      expect(getMock.mock.calls.length).toBeGreaterThan(1);
    });
  });

  it('hides the decision controls once a request is decided', async () => {
    getMock.mockResolvedValue({ ...detail, status: 'approved', decidedAt: detail.createdAt });

    render(<OverrideRequestView requestId={requestId} />);

    await screen.findByText('Decision');

    expect(screen.queryByRole('button', { name: 'Approve override' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Decision reason')).not.toBeInTheDocument();
  });
});
