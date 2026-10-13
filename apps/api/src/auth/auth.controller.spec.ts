import { describe, expect, it, vi } from 'vitest';

import { AuthController } from './auth.controller.js';

function controller(values: Record<string, string | undefined>) {
  const config = {
    get: vi.fn((key: string) => values[key]),
  };

  return new AuthController({} as never, config as never);
}

describe('AuthController', () => {
  it('advertises password recovery when Brevo is configured', () => {
    const result = controller({
      BREVO_API_KEY: 'brevo-test-key',
      BREVO_SENDER_EMAIL: 'accounts@example.test',
      MFA_ENCRYPTION_KEY: 'a'.repeat(64),
      AUTH_PUBLIC_ORIGIN: 'https://www.trackroster.com',
    }).configuration();

    expect(result.passwordRecovery).toBe(true);
  });

  it('advertises password recovery when Mailpit is configured', () => {
    const result = controller({
      MAILPIT_URL: 'http://127.0.0.1:8025',
      MFA_ENCRYPTION_KEY: 'a'.repeat(64),
      AUTH_PUBLIC_ORIGIN: 'http://localhost:3000',
    }).configuration();

    expect(result.passwordRecovery).toBe(true);
  });

  it('hides password recovery when required mail or reset settings are missing', () => {
    expect(
      controller({
        MFA_ENCRYPTION_KEY: 'a'.repeat(64),
        AUTH_PUBLIC_ORIGIN: 'https://www.trackroster.com',
      }).configuration().passwordRecovery,
    ).toBe(false);

    expect(
      controller({
        BREVO_API_KEY: 'brevo-test-key',
        BREVO_SENDER_EMAIL: 'accounts@example.test',
        AUTH_PUBLIC_ORIGIN: 'https://www.trackroster.com',
      }).configuration().passwordRecovery,
    ).toBe(false);

    expect(
      controller({
        BREVO_API_KEY: 'brevo-test-key',
        MFA_ENCRYPTION_KEY: 'a'.repeat(64),
        AUTH_PUBLIC_ORIGIN: 'https://www.trackroster.com',
      }).configuration().passwordRecovery,
    ).toBe(false);

    expect(
      controller({
        BREVO_API_KEY: 'brevo-test-key',
        MFA_ENCRYPTION_KEY: 'a'.repeat(64),
      }).configuration().passwordRecovery,
    ).toBe(false);
  });
});
