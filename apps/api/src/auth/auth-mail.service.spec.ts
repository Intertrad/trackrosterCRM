import { describe, expect, it } from 'vitest';
import { AuthMailService } from './auth-mail.service.js';

function service(values: Record<string, string>) {
  return new AuthMailService({} as never, { get: (key: string) => values[key] } as never);
}

const base = {
  BREVO_API_KEY: 'brevo-test-key',
  MFA_ENCRYPTION_KEY: 'a'.repeat(64),
};

describe('AuthMailService configuration', () => {
  it('rejects localhost invitation origins in production', () => {
    expect(() =>
      service({
        ...base,
        NODE_ENV: 'production',
        AUTH_PUBLIC_ORIGIN: 'http://localhost:3000',
      }).assertConfigured(),
    ).toThrow('external HTTPS origin');
  });

  it('accepts the public HTTPS origin and keeps invitation tokens in fragments', () => {
    const mail = service({
      ...base,
      NODE_ENV: 'production',
      AUTH_PUBLIC_ORIGIN: 'https://trackroaster.com',
    });

    expect(mail.publicLink('/accept-invitation', 'token-value')).toBe(
      'https://trackroaster.com/accept-invitation#token=token-value',
    );
    expect(mail.publicAsset('/trackroster-logo.png')).toBe(
      'https://trackroaster.com/trackroster-logo.png',
    );
  });
});
