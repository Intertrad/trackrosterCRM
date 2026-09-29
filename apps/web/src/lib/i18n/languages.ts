/**
 * The interface languages TrackRoster actually ships a catalogue for.
 *
 * Deliberately narrower than the locales the account accepts. `PATCH /me`
 * validates `locale` with `IsLocale`, so a membership can legitimately hold
 * `ar` or `de-DE` for date and number formatting long before the interface is
 * translated into it. Offering a language with no catalogue would mean
 * advertising a translation that does not exist.
 */
export type UiLanguage = 'en' | 'fr';

export const UI_LANGUAGES: UiLanguage[] = ['en', 'fr'];

export const DEFAULT_LANGUAGE: UiLanguage = 'en';

/** Written in its own language, as a language list should be. */
export const LANGUAGE_LABELS: Record<UiLanguage, string> = {
  en: 'English',
  fr: 'Français',
};

/**
 * The interface language implied by a stored locale.
 *
 * One setting drives both formatting and wording: `fr-FR` reads as French,
 * `en-GB` and `en-US` as English. A locale with no catalogue — `ar`, `de-DE` —
 * still formats dates in its own convention while the interface stays in the
 * default language, rather than falling back to raw message keys.
 */
export function resolveLanguage(locale: string | null | undefined): UiLanguage {
  if (!locale) {
    return DEFAULT_LANGUAGE;
  }

  const base = locale.trim().toLowerCase().split(/[-_]/)[0];

  return UI_LANGUAGES.find((language) => language === base) ?? DEFAULT_LANGUAGE;
}

/** Whether a stored locale is one the interface is translated into. */
export function isTranslatedLocale(locale: string | null | undefined): boolean {
  return Boolean(locale) && resolveLanguage(locale) !== DEFAULT_LANGUAGE;
}
