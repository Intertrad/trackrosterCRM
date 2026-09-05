import { describe, expect, it } from 'vitest';

import { PasswordService } from './password.service.js';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes a password using Argon2id', async () => {
    const password = 'StrongPassword123!';

    const hash = await service.hash(password);

    expect(hash).not.toBe(password);
    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  it('verifies the correct password', async () => {
    const password = 'StrongPassword123!';
    const hash = await service.hash(password);

    const valid = await service.verify(hash, password);

    expect(valid).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await service.hash('CorrectPassword123!');

    const valid = await service.verify(hash, 'WrongPassword123!');

    expect(valid).toBe(false);
  });

  it('returns false for an invalid password hash', async () => {
    const valid = await service.verify('not-a-valid-argon2-hash', 'password');

    expect(valid).toBe(false);
  });
});
