import { describe, expect, it } from 'vitest';
import { companyLabel } from './company-label';

describe('companyLabel', () => {
  it('adds optional breaks at compound-word boundaries, including accents', () => {
    expect(companyLabel('InterTrad')).toBe('Inter\u200BTrad');
    expect(companyLabel('Soci\u00e9t\u00e9\u00c9quipe')).toBe('Soci\u00e9t\u00e9\u200B\u00c9quipe');
    expect(companyLabel('GFTIJFrance')).toBe('GFTIJ\u200BFrance');
  });
  it('preserves abbreviations, spaces and the visible name', () => {
    for (const name of ['GFTIJ', 'OFTI', 'France Sales', 'InterTrad']) {
      expect(companyLabel(name).replaceAll('\u200B', '')).toBe(name);
    }
    expect(companyLabel('GFTIJ')).toBe('GFTIJ');
    expect(companyLabel('France Sales')).toBe('France Sales');
  });
});
