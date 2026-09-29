/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import type { Prospect } from '@/lib/api/prospect-types';
import { ApiError } from '@/lib/api/api-error';
const api = vi.hoisted(() => ({
  enrollPreview: vi.fn(),
  enroll: vi.fn(),
  preview: vi.fn(),
  assign: vi.fn(),
  resolve: vi.fn(),
}));
vi.mock('@/lib/api/campaign-client', () => ({
  previewCampaignEnrolment: api.enrollPreview,
  applyCampaignEnrolment: api.enroll,
}));
vi.mock('@/lib/api/assignment-client', () => ({
  previewAssignment: api.preview,
  applyAssignment: api.assign,
}));
vi.mock('@/lib/api/browser-json', () => ({ browserJson: api.resolve }));
vi.mock('@/components/workspace/record-picker', () => ({
  RecordPicker: ({
    name,
    label,
    onRecordChange,
    disabled,
  }: {
    name: string;
    label: string;
    onRecordChange: (r: object) => void;
    disabled: boolean;
  }) => (
    <button
      disabled={disabled}
      onClick={() =>
        onRecordChange({ id: name, name: name, displayName: 'Prospector A', organizationId: 'org' })
      }
    >
      {label}
    </button>
  ),
}));
import { ProspectAssignmentDrawer } from './assignment-drawer';
const records = [{ id: 'establishment-1', name: 'Hospital A' }] as Prospect[];
async function choose() {
  fireEvent.click(screen.getByText('Active campaign'));
  fireEvent.click(screen.getByText('Team'));
  fireEvent.click(screen.getByText('Prospector'));
  fireEvent.click(screen.getByText('Preview selection'));
  await screen.findByText('Add and preview assignment');
}
async function enroll() {
  fireEvent.click(screen.getByText('Add and preview assignment'));
  await screen.findByText('Assign 1 prospects');
}
describe('prospect base assignment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.enrollPreview.mockResolvedValue({
      selected: 1,
      enrollable: 1,
      alreadyActive: 0,
      alreadyExcluded: 0,
    });
    api.enroll.mockResolvedValue({ enrolled: 1 });
    api.resolve.mockResolvedValue([
      { id: 'campaign-prospect-1', establishmentId: 'establishment-1', status: 'active' },
    ]);
    api.preview.mockResolvedValue({
      canApply: true,
      proposed: 1,
      conflicts: 0,
      decisions: [{ prospectId: 'campaign-prospect-1', outcome: 'proposed' }],
    });
    api.assign.mockResolvedValue({ assigned: 1 });
  });
  afterEach(cleanup);
  it('confirms enrollment then assigns campaign IDs to the chosen team and member', async () => {
    const saved = vi.fn();
    render(<ProspectAssignmentDrawer records={records} onClose={vi.fn()} onAssigned={saved} />);
    await choose();
    expect(api.enroll).not.toHaveBeenCalled();
    await enroll();
    expect(api.assign).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Assign 1 prospects'));
    await screen.findByText('1 prospects assigned');
    expect(api.assign).toHaveBeenCalledWith(
      {
        campaignId: 'campaignId',
        teamId: 'teamId',
        assignedUserId: 'assignedUserId',
        prospectIds: ['campaign-prospect-1'],
      },
      expect.any(String),
    );
    expect(saved).toHaveBeenCalledWith(1);
  });
  it('retains the enrollment retry identity after an uncertain response', async () => {
    api.enroll.mockRejectedValueOnce(
      new ApiError({ statusCode: 0, code: 'NETWORK_ERROR', message: 'lost', error: 'Network' }),
    );
    render(<ProspectAssignmentDrawer records={records} onClose={vi.fn()} onAssigned={vi.fn()} />);
    await choose();
    fireEvent.click(screen.getByText('Add and preview assignment'));
    await screen.findByRole('alert');
    await enroll();
    expect(api.enroll.mock.calls[0]?.[2]).toBe(api.enroll.mock.calls[1]?.[2]);
    expect(api.assign).not.toHaveBeenCalled();
  });
  it('blocks assignment on server conflicts and requires a refreshed preview after a race', async () => {
    api.assign.mockRejectedValueOnce(
      new ApiError({ statusCode: 409, code: 'CONFLICT', message: 'changed', error: 'Conflict' }),
    );
    render(<ProspectAssignmentDrawer records={records} onClose={vi.fn()} onAssigned={vi.fn()} />);
    await choose();
    await enroll();
    fireEvent.click(screen.getByText('Assign 1 prospects'));
    await screen.findByText(/selection or capacity changed/);
    expect(screen.getByText('Assign 1 prospects')).toBeDisabled();
    api.preview.mockResolvedValue({
      canApply: false,
      proposed: 0,
      conflicts: 1,
      decisions: [{ prospectId: 'campaign-prospect-1', outcome: 'capacity_exhausted' }],
    });
    fireEvent.click(screen.getByText('Refresh preview'));
    await screen.findByText(/Team or member capacity reached/);
    expect(screen.getByRole('button', { name: /^Assign 0/ })).toBeDisabled();
    expect(api.enroll).toHaveBeenCalledTimes(1);
  });
  it('does not reactivate excluded records or silently assign a smaller selection', async () => {
    api.enrollPreview.mockResolvedValue({
      selected: 1,
      enrollable: 0,
      alreadyActive: 0,
      alreadyExcluded: 1,
    });
    render(<ProspectAssignmentDrawer records={records} onClose={vi.fn()} onAssigned={vi.fn()} />);
    fireEvent.click(screen.getByText('Active campaign'));
    fireEvent.click(screen.getByText('Team'));
    fireEvent.click(screen.getByText('Prospector'));
    fireEvent.click(screen.getByText('Preview selection'));
    await screen.findByText(/Excluded records are not reactivated/);
    expect(screen.getByText('Preview assignment')).toBeDisabled();
    expect(api.enroll).not.toHaveBeenCalled();
  });
});
