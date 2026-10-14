import { describe, expect, it } from 'vitest';
import { readResetTokenFromHash } from './reset-password-hash-form';

describe('password reset fragment links', () => {
  it('extracts the token from the email link fragment', () => {
    const token = 'a'.repeat(43);
    expect(readResetTokenFromHash(`#token=${token}`)).toBe(token);
  });

  it('rejects missing, malformed, and unrelated fragments', () => {
    expect(readResetTokenFromHash('')).toBeNull();
    expect(readResetTokenFromHash('#token=short')).toBeNull();
    expect(readResetTokenFromHash(`#other=${'a'.repeat(43)}`)).toBeNull();
  });
});
