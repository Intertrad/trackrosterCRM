import { describe, expect, it } from 'vitest';
import { base32, openSecret, sealSecret, totp, verifyTotp } from './mfa-crypto.js';
describe('Authenticator cryptography', () => {
  it.each([
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
    [20000000000, '65353130'],
  ])('matches RFC 6238 SHA1 vector at %s', (seconds, expected) => {
    expect(totp(Buffer.from('12345678901234567890'), Math.floor(Number(seconds) / 30), 8)).toBe(
      expected,
    );
  });
  it('encodes RFC 4648 base32 without padding', () => {
    expect(base32(Buffer.from('foobar'))).toBe('MZXW6YTBOI');
  });
  it('rejects replay, malformed codes and codes beyond clock tolerance', () => {
    const secret = Buffer.alloc(20, 7),
      step = 123456;
    const code = totp(secret, step);
    expect(verifyTotp(secret, code, step - 1, step * 30000)).toBe(step);
    expect(verifyTotp(secret, code, step, step * 30000)).toBeNull();
    expect(verifyTotp(secret, code, -1, (step + 3) * 30000)).toBeNull();
    expect(verifyTotp(secret, 'abcdef', -1)).toBeNull();
  });
  it('binds authenticated encryption to the identity and key', () => {
    const secret = Buffer.alloc(20, 1),
      key = Buffer.alloc(32, 2);
    const encrypted = sealSecret(secret, key, 'identity-a');
    expect(openSecret(encrypted, key, 'identity-a')).toEqual(secret);
    expect(() => openSecret(encrypted, key, 'identity-b')).toThrow();
    expect(() => openSecret(encrypted, Buffer.alloc(32, 3), 'identity-a')).toThrow();
  });
});
