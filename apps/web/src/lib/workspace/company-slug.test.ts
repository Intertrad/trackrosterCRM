import { describe, expect, it } from 'vitest';
import { companySlug } from './company-slug';
describe('companySlug', () => {
  it.each([
    ['InterTrad France', 'intertrad-france'],
    ['  TESTE  ', 'teste'],
    ['Soci\u00e9t\u00e9 d\u2019Interpr\u00e8tes', 'societe-d-interpretes'],
    ['GFTIJ___Paris -- 2', 'gftij-paris-2'],
    ['C\u0153ur', 'coeur'],
    ['---', ''],
    ['test-123', 'test-123'],
  ])('normalizes %s to %s', (input, expected) => {
    const result = companySlug(input);
    expect(result).toBe(expected);
    if (result) expect(result).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });
});
