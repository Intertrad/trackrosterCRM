import { describe, expect, it } from 'vitest';

import { resolveLanguage } from '@/lib/i18n/languages';

import { LOCALE_OPTIONS, withCurrentValue } from './locales';

describe('language locale options', () => {
  it('only offers locales backed by an interface translation catalog', () => {
    expect(LOCALE_OPTIONS.map((option) => resolveLanguage(option.value))).toEqual(['fr', 'en']);
  });

  it('keeps an existing unsupported locale visible without advertising it as translated', () => {
    const options = withCurrentValue(LOCALE_OPTIONS, 'de-DE');

    expect(options[0]).toEqual({ value: 'de-DE', label: 'de-DE' });
    expect(resolveLanguage(options[0]!.value)).toBe('en');
  });
});
