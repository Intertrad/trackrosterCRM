/* @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

const { listNotificationsMock, getUnreadCountMock } = vi.hoisted(() => ({
  listNotificationsMock: vi.fn(),
  getUnreadCountMock: vi.fn(),
}));

vi.mock('@/lib/api/notification-client', () => ({
  listNotifications: listNotificationsMock,
  getUnreadCount: getUnreadCountMock,
  markAllNotificationsRead: vi.fn(),
  markNotificationRead: vi.fn(),
}));

vi.mock('@/lib/live/use-live-refresh', () => ({ useLiveRefresh: vi.fn() }));

import NotificationsPage from './page';

const notification = {
  id: 'notification-1',
  type: 'collision_or_recent_contact',
  severity: 'critical' as const,
  title: 'Collision detected',
  message: 'The prospect was contacted too recently.',
  followUpId: null,
  scheduledFor: null,
  readAt: null,
  createdAt: '2026-10-01T10:00:00.000Z',
};

describe('NotificationsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listNotificationsMock.mockResolvedValue({ items: [notification], nextCursor: null });
    getUnreadCountMock.mockResolvedValue({ count: 1 });
  });

  afterEach(cleanup);

  it('renders the inbox when both notification requests succeed', async () => {
    render(<NotificationsPage />);

    expect(await screen.findByText('Collision detected')).toBeInTheDocument();
    expect(screen.getByText('1 unread')).toBeInTheDocument();
  });

  it('keeps the inbox visible when only the unread count request fails', async () => {
    getUnreadCountMock.mockRejectedValue(new Error('count endpoint unavailable'));

    render(<NotificationsPage />);

    expect(await screen.findByText('Collision detected')).toBeInTheDocument();
    expect(
      await screen.findByText('We could not refresh the notification count. Please try again.'),
    ).toBeInTheDocument();
    expect(document.querySelector('[aria-busy="true"]')).not.toBeInTheDocument();
  });

  it('shows an empty retryable inbox instead of leaving skeletons after a list failure', async () => {
    listNotificationsMock.mockRejectedValue(new Error('inbox unavailable'));

    render(<NotificationsPage />);

    await waitFor(() =>
      expect(
        screen.getByText('We could not load notifications. Please try again.'),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText('No notifications yet')).toBeInTheDocument();
  });
});
