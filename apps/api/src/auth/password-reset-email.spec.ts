import { describe, expect, it } from 'vitest';
import { renderPasswordResetEmail } from './password-reset-email.js';

describe('password reset email', () => {
  it('renders a branded responsive email with a fragment reset link', () => {
    const result = renderPasswordResetEmail({
      resetUrl: 'https://www.trackroster.com/reset-password#token=abc123',
      expirationDate: '13 October 2026, 12:30 UTC',
      logoUrl: 'https://www.trackroster.com/trackroster-logo.png',
    });

    expect(result.subject).toBe('Reset your TrackRoster password');
    expect(result.text).toContain('https://www.trackroster.com/reset-password#token=abc123');
    expect(result.html).toContain('Reset my password');
    expect(result.html).toContain('role="presentation"');
    expect(result.html).toContain('max-width:640px');
    expect(result.html).toContain('https://www.trackroster.com/reset-password#token=abc123');
  });

  it('escapes dynamic values in the HTML', () => {
    const result = renderPasswordResetEmail({
      resetUrl: 'https://example.test/reset-password#token=x&y',
      expirationDate: '<tomorrow>',
      logoUrl: 'https://example.test/logo?a=1&b=2',
    });

    expect(result.html).toContain('&lt;tomorrow&gt;');
    expect(result.html).toContain('token=x&amp;y');
    expect(result.html).not.toContain('<tomorrow>');
  });
});
