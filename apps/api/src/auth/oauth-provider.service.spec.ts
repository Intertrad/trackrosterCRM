import { describe, expect, it } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { OAuthProviderService } from './oauth-provider.service.js';

const config = new ConfigService({
  GOOGLE_OAUTH_CLIENT_ID: 'google-client',
  GOOGLE_OAUTH_CLIENT_SECRET: 'google-secret',
  GOOGLE_OAUTH_REDIRECT_URI: 'https://app.example.test/auth/sso/google/callback',
  SSO_ENCRYPTION_KEY: 'a'.repeat(64),
});

describe('OAuthProviderService', () => {
  it('creates a signed, expiring provider authorization URL', () => {
    const result = new OAuthProviderService(config).start(
      'google',
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    );
    expect(result.authorizationUrl).toContain('accounts.google.com');
    expect(result.authorizationUrl).toContain('state=');
    expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('rejects malformed callback state before contacting a provider', async () => {
    await expect(
      new OAuthProviderService(config).callback('google', 'code', 'bad-state'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
