/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

const { replaceMock, refreshSessionMock, browserJsonMock } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  refreshSessionMock: vi.fn(),
  browserJsonMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({ refreshSession: refreshSessionMock }),
}));

vi.mock('@/lib/api/browser-json', () => ({ browserJson: browserJsonMock }));

import { ProfileMenu } from './profile-menu';

function renderMenu(collapsed = false) {
  return render(
    <ProfileMenu
      displayName="Laurent Bernard"
      email="manager@intertrad.test"
      roleLabel="Manager"
      collapsed={collapsed}
    />,
  );
}

describe('ProfileMenu', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    browserJsonMock.mockResolvedValue(undefined);
    refreshSessionMock.mockResolvedValue(null);
  });

  afterEach(cleanup);

  it('keeps the menu closed until the avatar is activated', () => {
    renderMenu();

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));

    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('offers sign out, which the sidebar previously had no way to reach', () => {
    renderMenu();

    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));

    expect(screen.getByRole('menuitem', { name: /Sign out/ })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Account settings/ })).toBeInTheDocument();
  });

  it('revokes the session server-side and returns to sign in', async () => {
    renderMenu();

    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Sign out/ }));

    await waitFor(() => {
      expect(browserJsonMock).toHaveBeenCalledWith(
        '/api/auth/logout',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    expect(refreshSessionMock).toHaveBeenCalled();
    expect(replaceMock).toHaveBeenCalledWith('/login');
  });

  it('still signs the user out locally when revocation fails', async () => {
    browserJsonMock.mockRejectedValue(new Error('network'));

    renderMenu();

    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Sign out/ }));

    /*
     * A failed revoke must not strand someone in an authenticated shell —
     * the session may already be gone server-side.
     */
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/login');
    });
  });

  it('closes on Escape', () => {
    renderMenu();

    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes when the pointer goes elsewhere', () => {
    renderMenu();

    fireEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
