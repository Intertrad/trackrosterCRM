import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes } from 'node:crypto';
import { openSecret, sealSecret } from './mfa-crypto.js';

type Provider = 'google' | 'microsoft';
@Injectable()
export class OAuthProviderService {
  constructor(private readonly config: ConfigService) {}
  private settings(provider: Provider) {
    const prefix = provider === 'google' ? 'GOOGLE' : 'MICROSOFT';
    const clientId = this.config.get<string>(`${prefix}_OAUTH_CLIENT_ID`);
    const clientSecret = this.config.get<string>(`${prefix}_OAUTH_CLIENT_SECRET`);
    const redirect = this.config.get<string>(`${prefix}_OAUTH_REDIRECT_URI`);
    const key = this.config.get<string>('SSO_ENCRYPTION_KEY');
    if (!clientId || !clientSecret || !redirect || !key || !/^[a-f0-9]{64}$/i.test(key))
      throw new ServiceUnavailableException(`${provider} OAuth is not configured`);
    return { clientId, clientSecret, redirect, key: Buffer.from(key, 'hex') };
  }
  start(provider: Provider, tenantId: string, membershipId: string) {
    const s = this.settings(provider);
    const exp = Math.floor(Date.now() / 1000) + 600;
    const nonce = randomBytes(18).toString('base64url');
    const payload = `${provider}.${tenantId}.${membershipId}.${exp}.${nonce}`;
    const sig = createHmac('sha256', s.key).update(payload).digest('base64url');
    const state = Buffer.from(`${payload}.${sig}`).toString('base64url');
    const endpoint =
      provider === 'google'
        ? 'https://accounts.google.com/o/oauth2/v2/auth'
        : 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
    const params = new URLSearchParams({
      client_id: s.clientId,
      redirect_uri: s.redirect,
      response_type: 'code',
      scope: provider === 'google' ? 'openid email profile' : 'openid email profile User.Read',
      state,
      access_type: 'offline',
      prompt: 'consent',
    });
    return {
      provider,
      authorizationUrl: `${endpoint}?${params}`,
      expiresAt: new Date(exp * 1000).toISOString(),
    };
  }
  async callback(provider: Provider, code: string, state: string) {
    const s = this.settings(provider);
    let decoded: string;
    try {
      decoded = Buffer.from(state, 'base64url').toString();
    } catch {
      throw new BadRequestException('Invalid OAuth state');
    }
    const parts = decoded.split('.');
    if (parts.length !== 6 || parts[0] !== provider)
      throw new BadRequestException('Invalid OAuth state');
    const payload = parts.slice(0, 5).join('.');
    const expected = createHmac('sha256', s.key).update(payload).digest('base64url');
    if (expected !== parts[5] || Number(parts[3]) < Math.floor(Date.now() / 1000))
      throw new BadRequestException('Expired or invalid OAuth state');
    const endpoint =
      provider === 'google'
        ? 'https://oauth2.googleapis.com/token'
        : 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: s.clientId,
        client_secret: s.clientSecret,
        code,
        redirect_uri: s.redirect,
        grant_type: 'authorization_code',
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new BadRequestException('OAuth code exchange failed');
    const tokens = (await response.json()) as Record<string, unknown>;
    const encryptedTokens = sealSecret(
      Buffer.from(JSON.stringify(tokens)),
      s.key,
      `${provider}:${parts[1]}:${parts[2]}`,
    );
    return { provider, tenantId: parts[1], membershipId: parts[2], encryptedTokens };
  }
  decrypt(provider: Provider, tenantId: string, membershipId: string, encryptedTokens: string) {
    const s = this.settings(provider);
    return JSON.parse(
      openSecret(encryptedTokens, s.key, `${provider}:${tenantId}:${membershipId}`).toString(),
    ) as Record<string, unknown>;
  }
}
