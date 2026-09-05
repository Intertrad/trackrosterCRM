import { describe, expect, it } from 'vitest';

import { TokenService } from './token.service.js';

describe('TokenService', () => {
  it('hashes refresh tokens deterministically', () => {
    const jwtService = {} as never;
    const configService = {} as never;

    const service = new TokenService(jwtService, configService);

    const first = service.hashRefreshToken('example-refresh-token');

    const second = service.hashRefreshToken('example-refresh-token');

    expect(first).toBe(second);
    expect(first).toHaveLength(64);
    expect(first).not.toBe('example-refresh-token');
  });

  it('produces different hashes for different refresh tokens', () => {
    const jwtService = {} as never;
    const configService = {} as never;

    const service = new TokenService(jwtService, configService);

    const first = service.hashRefreshToken('token-one');
    const second = service.hashRefreshToken('token-two');

    expect(first).not.toBe(second);
  });
});

it('matches the correct refresh token hash', () => {
  const jwtService = {} as never;
  const configService = {} as never;

  const service = new TokenService(jwtService, configService);

  const refreshToken = 'example-refresh-token';

  const storedHash = service.hashRefreshToken(refreshToken);

  expect(service.matchesRefreshToken(refreshToken, storedHash)).toBe(true);
});

it('rejects a refresh token that does not match the stored hash', () => {
  const jwtService = {} as never;
  const configService = {} as never;

  const service = new TokenService(jwtService, configService);

  const storedHash = service.hashRefreshToken('correct-token');

  expect(service.matchesRefreshToken('wrong-token', storedHash)).toBe(false);
});
