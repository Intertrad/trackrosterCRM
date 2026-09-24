import {
  BadRequestException,
  Inject,
  Injectable,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes } from 'node:crypto';
import { openSecret, sealSecret } from './mfa-crypto.js';
import { DATABASE } from '../database/database.constants.js';
import type { Database } from '../database/database.types.js';
import { integrations } from '../database/schema/index.js';
import { and, eq } from 'drizzle-orm';

type Provider = 'google' | 'microsoft';
@Injectable()
export class OAuthProviderService {
  constructor(
    private readonly config: ConfigService,
    @Optional() @Inject(DATABASE) private readonly db?: Database,
  ) {}
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
    const tenantId = parts[1]!;
    const membershipId = parts[2]!;
    if (!this.db) throw new ServiceUnavailableException('OAuth persistence is not configured');
    const [existing] = await this.db
      .select({ id: integrations.id })
      .from(integrations)
      .where(
        and(
          eq(integrations.tenantId, tenantId),
          eq(integrations.provider, provider),
          eq(integrations.connectedBy, membershipId),
        ),
      )
      .limit(1);
    const config = { encryptedTokens, tokenUpdatedAt: new Date().toISOString() };
    if (existing)
      await this.db
        .update(integrations)
        .set({ status: 'connected', config, updatedAt: new Date() })
        .where(eq(integrations.id, existing.id));
    else
      await this.db
        .insert(integrations)
        .values({ tenantId, provider, status: 'connected', config, connectedBy: membershipId });
    return { provider, tenantId, membershipId, connected: true };
  }
  decrypt(provider: Provider, tenantId: string, membershipId: string, encryptedTokens: string) {
    const s = this.settings(provider);
    return JSON.parse(
      openSecret(encryptedTokens, s.key, `${provider}:${tenantId}:${membershipId}`).toString(),
    ) as Record<string, unknown>;
  }

  async refresh(provider: Provider, tenantId: string, membershipId: string) {
    if (!this.db) throw new ServiceUnavailableException('OAuth persistence is not configured');
    const [row] = await this.db
      .select({ id: integrations.id, config: integrations.config })
      .from(integrations)
      .where(
        and(
          eq(integrations.tenantId, tenantId),
          eq(integrations.provider, provider),
          eq(integrations.connectedBy, membershipId),
          eq(integrations.status, 'connected'),
        ),
      )
      .limit(1);
    const encrypted = (row?.config as { encryptedTokens?: string } | undefined)?.encryptedTokens;
    if (!row || !encrypted) throw new BadRequestException('OAuth connection not found');
    const tokens = this.decrypt(provider, tenantId, membershipId, encrypted);
    const refreshToken =
      typeof tokens.refresh_token === 'string' ? tokens.refresh_token : undefined;
    if (!refreshToken) throw new BadRequestException('Provider did not issue a refresh token');
    const s = this.settings(provider);
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
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new BadRequestException('OAuth token refresh failed');
    const next = (await response.json()) as Record<string, unknown>;
    if (!next.refresh_token) next.refresh_token = refreshToken;
    const encryptedTokens = sealSecret(
      Buffer.from(JSON.stringify(next)),
      s.key,
      `${provider}:${tenantId}:${membershipId}`,
    );
    await this.db
      .update(integrations)
      .set({
        config: { encryptedTokens, tokenUpdatedAt: new Date().toISOString() },
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, row.id));
    return { provider, refreshed: true };
  }
}
