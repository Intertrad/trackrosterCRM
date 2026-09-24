/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

const { useAuthMock, replaceMock, pathnameMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  replaceMock: vi.fn(),
  pathnameMock: vi.fn(),
}));

vi.mock('@/lib/auth/auth-context', () => ({ useAuth: useAuthMock }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn(), refresh: vi.fn() }),
  usePathname: pathnameMock,
}));

import { AppShell } from './app-shell';

function authenticated(mode = 'prospector', overrides: Record<string, unknown> = {}) {
  useAuthMock.mockReturnValue({
    status: 'authenticated',
    user: { email: 'nabil.benali@intertrad.test', displayName: 'Nabil Benali' },
    activeWorkspace: { mode, scopeType: 'team', teamId: 'team-1' },
    sessionError: null,
    refreshSession: vi.fn(),
    ...overrides,
  });
}

describe('AppShell', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    pathnameMock.mockReturnValue('/');
    window.localStorage.clear();
  });

  afterEach(cleanup);

  it('renders the prospector navigation in the designed order', () => {
    authenticated();

    render(<AppShell>content</AppShell>);

    const sidebar = screen.getByRole('navigation', { name: 'Workspace' });

    /* The design handoff specifies these five and nothing else; the
     * occasional screens sit behind the disclosure below them. */
    expect(sidebar).toHaveTextContent('Today');
    expect(sidebar).toHaveTextContent('My prospects');
    expect(sidebar).toHaveTextContent('Map');
    expect(sidebar).toHaveTextContent('Actions');
    expect(sidebar).toHaveTextContent('Messages');

    expect(sidebar).not.toHaveTextContent('Routes');
    expect(sidebar).not.toHaveTextContent('Logged actions');
  });

  it('keeps the occasional prospector screens reachable behind More', () => {
    authenticated();

    render(<AppShell>content</AppShell>);

    const sidebar = screen.getByRole('navigation', { name: 'Workspace' });

    fireEvent.click(within(sidebar).getByRole('button', { name: 'More' }));

    /* Taking a working screen out of the list must not strand it at a URL
     * nothing links to. */
    for (const label of ['Routes', 'Logged actions', 'Search']) {
      expect(within(sidebar).getByRole('link', { name: label })).toBeInTheDocument();
    }
  });

  it('opens More on its own when the current page lives inside it', () => {
    pathnameMock.mockReturnValue('/routes');

    authenticated();

    render(<AppShell>content</AppShell>);

    const sidebar = screen.getByRole('navigation', { name: 'Workspace' });

    /* Otherwise the sidebar would show nothing highlighted while the
     * prospector is standing on one of these screens. */
    expect(within(sidebar).getByRole('link', { name: 'Routes' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('never renders a link for a screen that does not exist', () => {
    authenticated('admin');

    render(<AppShell>content</AppShell>);

    /* Overrides has no page yet, so it must render without a link. */
    expect(screen.queryByRole('link', { name: 'Overrides' })).not.toBeInTheDocument();

    expect(screen.getAllByRole('link', { name: 'Users & roles' }).length).toBeGreaterThan(0);
  });

  it('links every manager screen that exists', () => {
    authenticated('manager');

    render(<AppShell>content</AppShell>);

    for (const label of [
      'Overview',
      'Team',
      'Assignments',
      'Collision center',
      'Approvals',
      'Reports',
    ]) {
      expect(screen.getAllByRole('link', { name: label }).length).toBeGreaterThan(0);
    }
  });

  it('links every prospector screen once its page exists', () => {
    authenticated();

    render(<AppShell>content</AppShell>);

    for (const label of ['Today', 'My prospects', 'Map', 'Actions', 'Messages']) {
      expect(screen.getAllByRole('link', { name: label }).length).toBeGreaterThan(0);
    }
  });

  it('marks the current screen for assistive technology', () => {
    authenticated();
    pathnameMock.mockReturnValue('/work-queue/campaign/prospect');

    render(<AppShell>content</AppShell>);

    const current = screen
      .getAllByRole('link', { name: 'My prospects' })
      .find((link) => link.getAttribute('aria-current') === 'page');

    expect(current).toBeDefined();
  });

  it('collapses the sidebar and remembers the choice for this viewer', () => {
    authenticated();

    render(<AppShell>content</AppShell>);

    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));

    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
    expect(window.localStorage.getItem('trackroster.sidebar.collapsed')).toBe('true');
  });

  it('offers a mobile bottom bar with room for the More tab', () => {
    authenticated();

    render(<AppShell>content</AppShell>);

    const bottomBar = screen.getByRole('navigation', { name: 'Primary' });

    expect(bottomBar).toHaveTextContent('More');
  });

  it('switches navigation when the active workspace is a manager', () => {
    authenticated('manager');

    render(<AppShell>content</AppShell>);

    const sidebar = screen.getByRole('navigation', { name: 'Workspace' });

    expect(sidebar).toHaveTextContent('Assignments');
    expect(sidebar).toHaveTextContent('Approvals');
    expect(sidebar).not.toHaveTextContent('My prospects');
  });

  it('sends an unauthenticated visitor to sign in instead of rendering the app', () => {
    useAuthMock.mockReturnValue({
      status: 'unauthenticated',
      user: null,
      activeWorkspace: null,
      sessionError: null,
      refreshSession: vi.fn(),
    });

    render(<AppShell>secret content</AppShell>);

    expect(replaceMock).toHaveBeenCalledWith('/login');
    expect(screen.queryByText('secret content')).not.toBeInTheDocument();
  });

  it('offers recovery instead of a redirect when the session check itself failed', () => {
    authenticated('prospector', {
      status: 'error',
      user: null,
      sessionError: 'TrackRoster could not restore your session.',
    });

    render(<AppShell>content</AppShell>);

    /* A network failure is not an authentication failure. */
    expect(replaceMock).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('exposes sign out from the sidebar account menu', () => {
    authenticated();

    render(<AppShell>content</AppShell>);

    /* Sign out used to exist only in the mobile More sheet. */
    fireEvent.click(screen.getAllByRole('button', { name: 'Account menu' })[0]!);

    expect(screen.getAllByRole('menuitem', { name: /Sign out/ }).length).toBeGreaterThan(0);
  });
});
