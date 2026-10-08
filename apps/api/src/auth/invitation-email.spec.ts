import { describe, expect, it } from 'vitest';
import { getInvitationRoleContent, renderInvitationEmail } from './invitation-email.js';

describe('invitation email', () => {
  it('renders a branded HTML email and matching plain-text fallback', () => {
    const result = renderInvitationEmail({
      recipientName: 'Ada Lovelace',
      workspaceName: 'Groupe <Intertrad>',
      roleDisplayName: 'Manager',
      inviterName: 'Samir & team',
      invitationUrl: 'https://trackroaster.com/accept-invitation#token=abc',
      expirationDate: 'October 15, 2026',
      roleDescription: 'Management within assigned teams',
      roleCapabilities: ['Assign and reassign work within your scope'],
      logoUrl: 'https://trackroaster.com/trackroster-logo.png',
    });

    expect(result.subject).toContain('Groupe <Intertrad>');
    expect(result.text).toContain('https://trackroaster.com/accept-invitation#token=abc');
    expect(result.html).toContain('Accept invitation');
    expect(result.html).toContain('Groupe &lt;Intertrad&gt;');
    expect(result.html).toContain('Samir &amp; team');
    expect(result.html).toContain('role="presentation"');
    expect(result.html).toContain('max-width:640px');
  });

  it('uses the permission catalogue for role content', () => {
    const prospector = getInvitationRoleContent('prospector');
    const observer = getInvitationRoleContent('observer');
    const platformAdmin = getInvitationRoleContent('super_admin');

    expect(prospector.roleDescription).toContain('Prospecting');
    expect(prospector.roleCapabilities).toContain('Record prospect activities');
    expect(observer.roleDescription).toContain('Read-only');
    expect(observer.roleCapabilities).not.toContain('Record prospect activities');
    expect(platformAdmin.roleDisplayName).toBe('Super administrator');
  });

  it('falls back safely when optional names are missing', () => {
    const result = renderInvitationEmail({
      workspaceName: 'Intertrad',
      roleDisplayName: 'Observer',
      invitationUrl: 'https://trackroaster.com/accept-invitation#token=abc',
      expirationDate: 'October 15, 2026',
      roleDescription: 'Read-only access',
      roleCapabilities: [],
      logoUrl: 'https://trackroaster.com/trackroster-logo.png',
    });

    expect(result.text).toContain('Hi there,');
    expect(result.text).toContain('Your workspace administrator invited you');
  });
});
