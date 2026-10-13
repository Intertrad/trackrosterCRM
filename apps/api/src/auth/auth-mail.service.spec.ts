import { describe, expect, it } from 'vitest';
import { AuthMailService } from './auth-mail.service.js';

function service(values: Record<string, string>) {
  return new AuthMailService({} as never, { get: (key: string) => values[key] } as never);
}

const base = {
  BREVO_API_KEY: 'brevo-test-key',
  BREVO_SENDER_EMAIL: 'accounts@example.test',
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

  it('rejects a production Brevo configuration without a sender address', () => {
    const withoutSender: Record<string, string> = { ...base };
    delete withoutSender.BREVO_SENDER_EMAIL;

    expect(() =>
      service({
        ...withoutSender,
        NODE_ENV: 'production',
        AUTH_PUBLIC_ORIGIN: 'https://www.trackroster.com',
      }).assertConfigured(),
    ).toThrow('Account email is not configured');
  });

  it('canonicalizes the production host and keeps invitation tokens in fragments', () => {
    const mail = service({
      ...base,
      NODE_ENV: 'production',
      AUTH_PUBLIC_ORIGIN: 'https://trackroaster.com',
    });

    expect(mail.publicLink('/accept-invitation', 'token-value')).toBe(
      'https://www.trackroster.com/accept-invitation#token=token-value',
    );
    expect(mail.publicAsset('/trackroster-logo.png')).toBe(
      'https://www.trackroster.com/trackroster-logo.png',
    );
  });
});
