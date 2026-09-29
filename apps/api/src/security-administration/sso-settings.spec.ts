import { describe, expect, it } from 'vitest';
import { createDecipheriv } from 'node:crypto';
import { publicSso, storeSso } from './sso-settings.js';
describe('OIDC configuration secrets', () => {
  const input = {
    provider: 'oidc' as const,
    mode: 'configured' as const,
    issuer: 'https://id.example.test',
    clientId: 'app',
    allowedDomains: ['example.test'],
    clientSecret: 'secret',
  };
  it('authenticates encrypted secrets to the tenant and requires a provisioned key', () => {
    expect(() => storeSso(input, null, undefined, 'tenant')).toThrow('SSO_ENCRYPTION_KEY');
    const row = storeSso(input, null, '22'.repeat(32), 'tenant');
    expect(publicSso(row)).not.toHaveProperty('encryptedClientSecret');
    const [, nonce, tag, ciphertext] = row.encryptedClientSecret!.split('.');
    const open = (tenant: string) => {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        Buffer.from('22'.repeat(32), 'hex'),
        Buffer.from(nonce!, 'base64url'),
      );
      decipher.setAAD(Buffer.from(`trackroster:oidc:v1:${tenant}`));
      decipher.setAuthTag(Buffer.from(tag!, 'base64url'));
      return Buffer.concat([
        decipher.update(Buffer.from(ciphertext!, 'base64url')),
        decipher.final(),
      ]).toString();
    };
    expect(open('tenant')).toBe('secret');
    expect(() => open('other')).toThrow();
  });
  it('does not carry a secret into a different issuer or client registration', () => {
    const row = storeSso(input, null, '22'.repeat(32), 'tenant');
    expect(() =>
      storeSso({ ...input, clientId: 'other', clientSecret: undefined }, row, undefined, 'tenant'),
    ).toThrow('require a client secret');
  });
});
