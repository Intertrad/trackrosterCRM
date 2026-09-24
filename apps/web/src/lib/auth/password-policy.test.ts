import { describe, expect, it } from 'vitest';

import { assessPassword } from './password-policy';

describe('assessPassword', () => {
  it('accepts a password the backend would accept, even without composition rules', () => {
    /* The API enforces length only; the UI must not invent a stricter policy. */
    const assessment = assessPassword('aaaaaaaaaaaa');

    expect(assessment.acceptable).toBe(true);
    expect(assessment.satisfied.has('length')).toBe(true);
    expect(assessment.satisfied.has('uppercase')).toBe(false);
  });

  it('rejects a password shorter than the enforced minimum', () => {
    const assessment = assessPassword('Short1!');

    expect(assessment.acceptable).toBe(false);
    expect(assessment.strength).toBe('weak');
  });

  it('rejects a password longer than the API maximum', () => {
    const assessment = assessPassword('a'.repeat(129));

    expect(assessment.acceptable).toBe(false);
  });

  it('reports strong only when every advisory rule is met', () => {
    const assessment = assessPassword('Corr3ct-Horse-Battery');

    expect(assessment.strength).toBe('strong');
    expect(assessment.score).toBe(4);
    expect(assessment.acceptable).toBe(true);
  });
});
