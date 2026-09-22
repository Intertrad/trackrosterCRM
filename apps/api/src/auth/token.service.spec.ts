import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { beforeEach, describe, expect, it } from 'vitest';

import { TokenService } from './token.service.js';

const identityId = '11111111-1111-4111-8111-111111111111';
const membershipId = '22222222-2222-4222-8222-222222222222';
const tenantId = '33333333-3333-4333-8333-333333333333';
const sessionId = '44444444-4444-4444-8444-444444444444';
const tokenId = '55555555-5555-4555-8555-555555555555';
const accessSecret = 'access-secret-that-is-long-enough-for-tests';
const refreshSecret = 'refresh-secret-that-is-long-enough-for-tests';

describe('TokenService', () => {
  let jwtService: JwtService;
  let service: TokenService;

  beforeEach(() => {
    jwtService = new JwtService();

    service = new TokenService(
      jwtService,
      new ConfigService({
        JWT_ACCESS_SECRET: accessSecret,
        JWT_REFRESH_SECRET: refreshSecret,
        JWT_ACCESS_TTL: '15m',
        JWT_REFRESH_TTL: '7d',
      }),
    );
  });

  it('creates strict v2 access and refresh tokens for one exact session principal', async () => {
    const tokens = await service.createTokens({
      identityId,
      membershipId,
      tenantId,
      sessionId,
    });

    const accessPayload = await service.verifyAccessToken(tokens.accessToken);
    const refreshPayload = await service.verifyRefreshToken(tokens.refreshToken);

    expect(accessPayload).toMatchObject({
      sub: identityId,
      membershipId,
      tenantId,
      sid: sessionId,
      ver: 2,
      type: 'access',
    });
    expect(refreshPayload).toMatchObject({
      sub: identityId,
      membershipId,
      tenantId,
      sid: sessionId,
      ver: 2,
      type: 'refresh',
    });
    expect(accessPayload.jti).toMatch(/^[0-9a-f-]{36}$/i);
    expect(refreshPayload.jti).toMatch(/^[0-9a-f-]{36}$/i);
    expect(accessPayload.jti).not.toBe(refreshPayload.jti);

    const accessHeader = jwtService.decode(tokens.accessToken, { complete: true })?.header;
    const refreshHeader = jwtService.decode(tokens.refreshToken, { complete: true })?.header;

    expect(accessHeader).toMatchObject({ alg: 'HS256', kid: 'tenant-hs256-v2' });
    expect(refreshHeader).toMatchObject({ alg: 'HS256', kid: 'tenant-hs256-v2' });
  });

  it('does not allow access and refresh tokens to cross verification boundaries', async () => {
    const tokens = await service.createTokens({
      identityId,
      membershipId,
      tenantId,
      sessionId,
    });

    await expect(service.verifyAccessToken(tokens.refreshToken)).rejects.toThrow();
    await expect(service.verifyRefreshToken(tokens.accessToken)).rejects.toThrow();
  });

  it.each([
    ['v1 token', { ver: 1, membershipId }],
    ['missing membership', { ver: 2, membershipId: undefined }],
    ['malformed identity', { ver: 2, membershipId, sub: 'identity-id' }],
    ['malformed membership', { ver: 2, membershipId: 'membership-id' }],
    ['malformed tenant', { ver: 2, membershipId, tenantId: 'tenant-id' }],
    ['malformed session', { ver: 2, membershipId, sid: 'session-id' }],
    ['malformed token id', { ver: 2, membershipId, jti: 'token-id' }],
  ])('rejects an access token with %s', async (_label, overrides) => {
    const token = await jwtService.signAsync(
      Object.assign(
        {
          sub: identityId,
          membershipId,
          tenantId,
          sid: sessionId,
          jti: tokenId,
          ver: 2,
          type: 'access',
        },
        overrides,
      ),
      {
        secret: accessSecret,
        algorithm: 'HS256',
        issuer: 'trackroster-api',
        audience: 'trackroster-tenant-access',
        keyid: 'tenant-hs256-v2',
        expiresIn: '15m',
      },
    );

    await expect(service.verifyAccessToken(token)).rejects.toThrow();
  });

  it.each([
    ['wrong issuer', { issuer: 'not-trackroster' }],
    ['wrong audience', { audience: 'not-tenant-access' }],
    ['wrong key id', { keyid: 'tenant-hs256-v1' }],
  ])('rejects an otherwise valid access token with %s', async (_label, signOverrides) => {
    const token = await jwtService.signAsync(
      {
        sub: identityId,
        membershipId,
        tenantId,
        sid: sessionId,
        jti: tokenId,
        ver: 2,
        type: 'access',
      },
      {
        secret: accessSecret,
        algorithm: 'HS256',
        issuer: 'trackroster-api',
        audience: 'trackroster-tenant-access',
        keyid: 'tenant-hs256-v2',
        expiresIn: '15m',
        ...signOverrides,
      },
    );

    await expect(service.verifyAccessToken(token)).rejects.toThrow();
  });

  it('rejects a token signed with the wrong secret', async () => {
    const token = await jwtService.signAsync(
      {
        sub: identityId,
        membershipId,
        tenantId,
        sid: sessionId,
        jti: tokenId,
        ver: 2,
        type: 'access',
      },
      {
        secret: 'wrong-secret',
        algorithm: 'HS256',
        issuer: 'trackroster-api',
        audience: 'trackroster-tenant-access',
        keyid: 'tenant-hs256-v2',
        expiresIn: '15m',
      },
    );

    await expect(service.verifyAccessToken(token)).rejects.toThrow();
  });

  it('hashes refresh tokens deterministically and matches only the correct token', () => {
    const first = service.hashRefreshToken('example-refresh-token');
    const second = service.hashRefreshToken('example-refresh-token');

    expect(first).toBe(second);
    expect(first).toHaveLength(64);
    expect(first).not.toBe('example-refresh-token');
    expect(service.matchesRefreshToken('example-refresh-token', first)).toBe(true);
    expect(service.matchesRefreshToken('wrong-refresh-token', first)).toBe(false);
    expect(service.matchesRefreshToken('example-refresh-token', 'not-a-valid-hash')).toBe(false);
  });

  it('extracts a signed token expiration', async () => {
    const tokens = await service.createTokens({
      identityId,
      membershipId,
      tenantId,
      sessionId,
    });

    expect(service.getExpiration(tokens.refreshToken).getTime()).toBeGreaterThan(Date.now());
  });
});
