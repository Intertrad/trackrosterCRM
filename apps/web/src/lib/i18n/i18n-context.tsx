'use client';

import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';

import { DICTIONARY, type MessageKey } from './dictionary';
import { DEFAULT_LANGUAGE, resolveLanguage, type UiLanguage } from './languages';

export type Translate = (key: MessageKey, values?: Record<string, string | number>) => string;

interface I18nValue {
  language: UiLanguage;

  /** The account's stored locale, used for dates and numbers. */
  locale: string | undefined;

  t: Translate;
}

const I18nContext = createContext<I18nValue | null>(null);

/**
 * Interface language, derived from the locale the account already stores.
 *
 * `account_settings.locale` is written by `PATCH /me` and read back on every
 * session, so the choice follows the person to any device without this app
 * keeping a second copy of the setting. The provider only translates; it never
 * writes, which keeps one owner for the value.
 */
export function I18nProvider({
  locale,
  children,
}: {
  locale: string | null | undefined;
  children: ReactNode;
}) {
  const language = resolveLanguage(locale);

  useEffect(() => {
    /*
     * The document is rendered on the server before the session is known, so
     * the language attribute is corrected here. Screen readers and browser
     * translation both key off it.
     */
    document.documentElement.lang = locale?.trim() || language;
  }, [language, locale]);

  const value = useMemo<I18nValue>(
    () => ({
      language,
      locale: locale?.trim() || undefined,
      t: (key, values) => format(DICTIONARY[key][language], values),
    }),
    [language, locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * Translation for the current account.
 *
 * Falls back to the default language rather than throwing when used outside a
 * provider: a missing provider should not blank a screen, and the fallback is
 * visible in tests.
 */
export function useTranslation(): I18nValue {
  const value = useContext(I18nContext);

  if (value) {
    return value;
  }

  return {
    language: DEFAULT_LANGUAGE,
    locale: undefined,
    t: (key, values) => format(DICTIONARY[key][DEFAULT_LANGUAGE], values),
  };
}

/** `{name}` placeholders, filled from the values passed alongside the key. */
function format(template: string, values?: Record<string, string | number>): string {
  if (!values) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}
