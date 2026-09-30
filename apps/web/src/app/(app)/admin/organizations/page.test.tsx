// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import Page from './page';
vi.stubGlobal('React', React);
vi.mock('@/lib/i18n/i18n-context', () => ({ useTranslation: () => ({ language: 'en' }) }));
vi.mock('@/components/admin/admin-guard', () => ({
  AdminGuard: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@/lib/live/use-live-pages', () => ({
  useLivePages: () => ({
    rows: [
      { id: 'active', name: 'Active company', slug: 'test', status: 'active', color: '#7c3aed' },
      {
        id: 'inactive',
        name: 'Archived company',
        slug: 'archive',
        status: 'inactive',
        color: '#e8790a',
      },
    ],
    cursor: null,
    error: null,
    busy: false,
    load: vi.fn(),
    loadMore: vi.fn(),
  }),
}));
vi.mock('@/lib/workspace/client', () => ({
  rowsOf: (value: unknown) => value,
  readOperation: vi.fn(async () => ({
    resource: { id: 'active', name: 'Active company' },
    etag: 'version',
  })),
}));
vi.mock('@/components/workspace/action-editor', () => ({
  ActionEditor: ({
    action,
    onPermanentDelete,
  }: {
    action: { operation: string; description?: { en: string } };
    onPermanentDelete?: () => void;
  }) => (
    <div role="dialog">
      {onPermanentDelete && <button onClick={onPermanentDelete}>Delete</button>}
      <p>{action.operation}</p>
      <p>{action.description?.en}</p>
    </div>
  ),
}));
afterEach(cleanup);
it('uses stored card colors and lets admins reveal inactive companies', () => {
  render(<Page />);
  expect(
    screen.getByRole('heading', { name: /Active company/ }).closest('section')?.style
      .borderLeftColor,
  ).toBe('rgb(124, 58, 237)');
  expect(screen.queryByRole('heading', { name: /Archived company/ })).toBeNull();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Show inactive companies' }));
  expect(screen.getByRole('heading', { name: /Archived company/ })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: /Active company/ })).toBeNull();
  const badge = screen.getAllByText('Inactive').find((element) => element.tagName === 'SPAN');
  expect(badge?.className).toContain('text-danger');
  expect(badge?.className).not.toContain('text-success');
  fireEvent.click(screen.getByRole('checkbox', { name: 'Show inactive companies' }));
  expect(screen.queryByRole('heading', { name: /Archived company/ })).toBeNull();
  expect(screen.getByRole('heading', { name: /Active company/ })).toBeTruthy();
});
it('offers deletion only after opening the company editor', async () => {
  render(<Page />);
  expect(screen.queryByRole('button', { name: /Delete/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Edit company' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
  const dialog = screen.getByRole('dialog');
  expect(dialog.textContent).toContain('DELETE /organizations/:organizationId/permanent');
  expect(dialog.textContent).toContain('cannot be undone');
});
