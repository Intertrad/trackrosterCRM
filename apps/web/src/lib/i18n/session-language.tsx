'use client';

import type { ReactNode } from 'react';

import { useAuth } from '@/lib/auth/auth-context';

import { I18nProvider } from './i18n-context';

/**
 * Feeds the interface language from the signed-in session.
 *
 * Kept separate so `I18nProvider` stays a pure function of a locale string —
 * translation does not need to know that authentication exists, and tests can
 * render a language without standing up a session.
 *
 * Before sign-in there is no membership and therefore no stored locale, so the
 * sign-in screens render in the default language.
 */
export function SessionLanguage({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  return <I18nProvider locale={user?.locale}>{children}</I18nProvider>;
}
