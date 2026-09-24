/* @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { DICTIONARY } from './dictionary';
import { I18nProvider, useTranslation } from './i18n-context';
import { DEFAULT_LANGUAGE, UI_LANGUAGES, resolveLanguage } from './languages';

function Probe() {
  const { t, language } = useTranslation();

  return (
    <>
      <span data-testid="language">{language}</span>
      <span data-testid="nav">{t('nav.today')}</span>
      <span data-testid="interpolated">{t('call.start', { name: 'Garage Dupont' })}</span>
    </>
  );
}

afterEach(cleanup);

describe('language resolution', () => {
  it('reads the interface language from the stored locale', () => {
    expect(resolveLanguage('fr-FR')).toBe('fr');
    expect(resolveLanguage('fr')).toBe('fr');
    expect(resolveLanguage('en-GB')).toBe('en');
    expect(resolveLanguage('EN_us')).toBe('en');
  });

  it('falls back to the default for a locale with no catalogue', () => {
    /*
     * `PATCH /me` validates with IsLocale, so a membership can legitimately
     * store Arabic or German for date formatting long before the interface is
     * translated. That must read as English words, never as raw message keys.
     */
    expect(resolveLanguage('ar')).toBe(DEFAULT_LANGUAGE);
    expect(resolveLanguage('de-DE')).toBe(DEFAULT_LANGUAGE);
    expect(resolveLanguage(null)).toBe(DEFAULT_LANGUAGE);
    expect(resolveLanguage('')).toBe(DEFAULT_LANGUAGE);
  });
});

describe('dictionary', () => {
  it('translates every key into every shipped language', () => {
    /* A half-translated catalogue shows English inside a French screen, which
     * is worse than not offering the language at all. */
    const gaps: string[] = [];

    for (const [key, entry] of Object.entries(DICTIONARY)) {
      for (const language of UI_LANGUAGES) {
        if (!entry[language]?.trim()) {
          gaps.push(`${key}.${language}`);
        }
      }
    }

    expect(gaps).toEqual([]);
  });

  it('keeps placeholders consistent across languages', () => {
    /* A placeholder that exists in one language and not another renders a
     * literal "{name}" to some users. */
    const mismatched: string[] = [];

    for (const [key, entry] of Object.entries(DICTIONARY)) {
      const expected = [...entry[DEFAULT_LANGUAGE].matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

      for (const language of UI_LANGUAGES) {
        const actual = [...entry[language].matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

        if (actual.join(',') !== expected.join(',')) {
          mismatched.push(`${key}.${language}`);
        }
      }
    }

    expect(mismatched).toEqual([]);
  });
});

describe('I18nProvider', () => {
  it('renders French for a French membership', () => {
    render(
      <I18nProvider locale="fr-FR">
        <Probe />
      </I18nProvider>,
    );

    expect(screen.getByTestId('language')).toHaveTextContent('fr');
    expect(screen.getByTestId('nav')).toHaveTextContent("Aujourd'hui");
    expect(screen.getByTestId('interpolated')).toHaveTextContent('Appeler Garage Dupont');
  });

  it('sets the document language so assistive technology follows it', () => {
    render(
      <I18nProvider locale="fr-FR">
        <Probe />
      </I18nProvider>,
    );

    expect(document.documentElement.lang).toBe('fr-FR');
  });

  it('keeps formatting locale and wording separate', () => {
    /* German formats dates its own way; the interface stays English until a
     * German catalogue exists. */
    render(
      <I18nProvider locale="de-DE">
        <Probe />
      </I18nProvider>,
    );

    expect(screen.getByTestId('nav')).toHaveTextContent('Today');
    expect(document.documentElement.lang).toBe('de-DE');
  });

  it('works without a provider rather than blanking the screen', () => {
    render(<Probe />);

    expect(screen.getByTestId('nav')).toHaveTextContent('Today');
  });
});
