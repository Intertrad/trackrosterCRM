/* @vitest-environment jsdom */
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/api-error';
import Page from './page';

const mocks = vi.hoisted(() => ({
  section: 'objectives',
  json: vi.fn(),
  resource: vi.fn(),
  profile: vi.fn(),
  updateProfile: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams({ section: mocks.section }),
}));
vi.mock('@/components/admin/admin-guard', () => ({
  AdminGuard: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('@/lib/i18n/i18n-context', () => ({ useTranslation: () => ({ language: 'fr' }) }));
vi.mock('@/lib/auth/auth-context', () => ({ useAuth: () => ({ refreshSession: mocks.refresh }) }));
vi.mock('@/lib/api/browser-json', () => ({ browserJson: mocks.json }));
vi.mock('@/lib/api/browser-resource', () => ({ browserResource: mocks.resource }));
vi.mock('@/lib/api/account-client', () => ({
  getAccountProfile: mocks.profile,
  updateAccountProfile: mocks.updateProfile,
}));
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.section = 'objectives';
  mocks.json.mockImplementation(async (url: string) =>
    url.includes('organizations') ? { items: [{ id: 'org', name: 'Example' }] } : { items: [] },
  );
});

describe('objective validation', () => {
  it('explains reversed dates and does not send an invalid objective', async () => {
    render(<Page />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Ajouter l’objectif' })).toBeEnabled(),
    );
    fireEvent.change(screen.getByLabelText('Nom de l’objectif'), { target: { value: 'Test' } });
    fireEvent.change(screen.getByLabelText('Début'), { target: { value: '2030-05-10' } });
    fireEvent.change(screen.getByLabelText('Fin'), { target: { value: '2030-05-09' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter l’objectif' }));
    expect(
      await screen.findByText('La date de fin ne peut pas précéder la date de début.'),
    ).toBeVisible();
    expect(mocks.json.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });
  it('explains invalid targets', async () => {
    render(<Page />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Ajouter l’objectif' })).toBeEnabled(),
    );
    fireEvent.change(screen.getByLabelText('Nom de l’objectif'), { target: { value: 'Test' } });
    fireEvent.change(screen.getByLabelText('Cible'), { target: { value: '1.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter l’objectif' }));
    expect(
      await screen.findByText('La cible doit être un nombre entier entre 1 et 10 000 000.'),
    ).toBeVisible();
  });
});

describe('workspace partial save', () => {
  it('reuses the new tenant version on retry and skips an unchanged account locale', async () => {
    mocks.section = 'workspace-settings';
    const tenant = { id: 'tenant', name: 'Workspace', locale: 'fr-FR', timezone: 'Europe/Paris' };
    const security = { requireMfa: false, sessionMaxHours: 8 };
    let tenantVersion = 'v1';
    let securityFailed = false;
    mocks.profile.mockResolvedValue({ resource: { locale: 'fr-FR' }, etag: 'account-v1' });
    mocks.resource.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/tenant')) {
        if (init?.method === 'PATCH') {
          expect(init.headers).toMatchObject({ 'if-match': tenantVersion });
          tenantVersion = tenantVersion === 'v1' ? 'v2' : 'v3';
        }
        return { resource: tenant, etag: tenantVersion };
      }
      if (init?.method === 'PATCH' && !securityFailed) {
        securityFailed = true;
        throw new ApiError({
          statusCode: 0,
          code: 'NETWORK_ERROR',
          message: 'Network failure',
          error: 'Network',
        });
      }
      return { resource: security, etag: 'security-v1' };
    });
    render(<Page />);
    const button = await screen.findByRole('button', { name: 'Enregistrer les réglages' });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(button);
    expect(
      await screen.findByText('Connexion indisponible. Vérifiez votre connexion.'),
    ).toBeVisible();
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    expect(await screen.findByText('Toutes les modifications sont enregistrées.')).toBeVisible();
    expect(mocks.updateProfile).not.toHaveBeenCalled();
  });
});
