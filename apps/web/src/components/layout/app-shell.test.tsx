/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

const { useAuthMock, replaceMock, pathnameMock, unreadMessagesMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  replaceMock: vi.fn(),
  pathnameMock: vi.fn(),
  unreadMessagesMock: vi.fn(),
}));

vi.mock('@/lib/auth/auth-context', () => ({ useAuth: useAuthMock }));
vi.mock('@/lib/api/messaging-client', () => ({
  getUnreadMessageCount: unreadMessagesMock,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn(), refresh: vi.fn() }),
  usePathname: pathnameMock,
}));

import { I18nProvider } from '@/lib/i18n/i18n-context';

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
    unreadMessagesMock.mockResolvedValue({ count: 0 });
    window.localStorage.clear();
  });

  afterEach(cleanup);

  it('renders the prospector navigation in the designed order', () => {
    authenticated();

    render(<AppShell>content</AppShell>);

    const sidebar = screen.getByRole('navigation', { name: 'Workspace' });

    expect(
      within(sidebar)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual([
      'My day',
      'Prospects',
      'Map',
      'Follow-ups',
      'Actions / History',
      'My Performance',
      'Messages',
    ]);
  });

  it('shows the unread message count on the sidebar', async () => {
    unreadMessagesMock.mockResolvedValue({ count: 4 });
    authenticated();

    render(<AppShell>content</AppShell>);

    await waitFor(() => expect(screen.getByLabelText('4 unread messages')).toBeInTheDocument());
    expect(
      within(screen.getByRole('navigation', { name: 'Workspace' })).getByRole('link', {
        name: /Messages/,
      }),
    ).toHaveTextContent('4');
  });

  it('renders the sidebar in the language the membership stores', () => {
    authenticated();

    render(
      <I18nProvider locale="fr-FR">
        <AppShell>content</AppShell>
      </I18nProvider>,
    );

    const sidebar = screen.getByRole('navigation', { name: 'Espace de travail' });

    /* The sidebar is the most-read text in the product: an English menu above a
     * French page is the tell that i18n was bolted on. */
    expect(within(sidebar).getByRole('link', { name: 'Ma journée' })).toBeInTheDocument();
    expect(within(sidebar).getByRole('link', { name: 'Relances' })).toBeInTheDocument();
    expect(within(sidebar).queryByRole('link', { name: 'Today' })).not.toBeInTheDocument();
  });

  it('connects administrator overrides to the shared approval workflow', () => {
    authenticated('admin');

    render(<AppShell>content</AppShell>);

    expect(screen.getByRole('link', { name: 'Overrides' })).toHaveAttribute(
      'href',
      '/manager/approvals',
    );

    expect(screen.getAllByRole('link', { name: 'Team' }).length).toBeGreaterThan(0);
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

    for (const label of ['My day', 'Prospects', 'Map', 'Follow-ups', 'Messages']) {
      expect(screen.getAllByRole('link', { name: label }).length).toBeGreaterThan(0);
    }
  });

  it('marks the current screen for assistive technology', () => {
    authenticated();
    pathnameMock.mockReturnValue('/work-queue/campaign/prospect');

    render(<AppShell>content</AppShell>);

    const current = screen
      .getAllByRole('link', { name: 'Prospects' })
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

  it('exposes sign out from the top-right account menu', () => {
    authenticated();

    render(<AppShell>content</AppShell>);

    /* Mobile and desktop render their responsive account controls together in jsdom. */
    expect(screen.getAllByRole('button', { name: 'Account menu' })).toHaveLength(2);
    fireEvent.click(screen.getAllByRole('button', { name: 'Account menu' })[1]!);

    expect(screen.getAllByRole('menuitem', { name: /Sign out/ }).length).toBeGreaterThan(0);
  });
});
