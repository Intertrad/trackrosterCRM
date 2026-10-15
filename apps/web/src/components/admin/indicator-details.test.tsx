/* @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminIndicatorDetails } from './indicator-details';
const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/lib/api/browser-json', () => ({ browserJson: get }));
vi.mock('@/lib/live/use-live-refresh', () => ({ useLiveRefresh: () => {} }));
afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());
describe('admin indicator details', () => {
  it('opens a role list and returns to the role sectors', async () => {
    get.mockImplementation(async (url: string) => ({
      total: 3,
      active: 2,
      invitations: 1,
      roles: [{ role: 'manager', count: 2, invitations: 1 }],
      items: url.includes('role=manager')
        ? [
            {
              id: 'member',
              displayName: 'Camille',
              email: 'camille@example.test',
              status: 'invited',
              pendingInvitation: true,
              roles: ['manager'],
            },
          ]
        : [],
      nextCursor: null,
    }));
    render(<AdminIndicatorDetails kind="people" />);
    fireEvent.click(await screen.findByRole('button', { name: /Manager/ }));
    expect(await screen.findByText('Camille')).toBeVisible();
    expect(screen.getByText('Invitation pending')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Back to roles' }));
    expect(await screen.findByRole('button', { name: /Manager/ })).toBeVisible();
    await waitFor(() => expect(screen.queryByText('Camille')).not.toBeInTheDocument());
  });
  it('shows both names and matching fields for pending duplicates', async () => {
    get.mockResolvedValue({
      items: [
        {
          id: 'pair',
          leftId: 'left',
          leftName: 'Alpha',
          rightId: 'right',
          rightName: 'Alpha SARL',
          matchingKeys: ['phone'],
          createdAt: '2026-01-01',
        },
      ],
      nextCursor: null,
    });
    render(<AdminIndicatorDetails kind="duplicates" />);
    expect(await screen.findByText('Alpha')).toBeVisible();
    expect(screen.getByText('↔ Alpha SARL')).toBeVisible();
    expect(screen.getByText(/phone/)).toBeVisible();
  });
});
