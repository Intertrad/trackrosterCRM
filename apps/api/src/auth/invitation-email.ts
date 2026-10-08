import { PERMISSIONS, ROLES } from '../permissions/permission-catalogue.js';
import type { UserRole } from '../database/schema/user-access-grants.js';

export type InvitationEmailRole = UserRole | 'super_admin' | 'support_operator';

export type InvitationEmailInput = {
  recipientName?: string | null;
  workspaceName: string;
  roleDisplayName: string;
  inviterName?: string | null;
  invitationUrl: string;
  expirationDate: string;
  roleDescription: string;
  roleCapabilities: string[];
  logoUrl: string;
};

const CAPABILITY_LABELS: Record<string, string> = {
  'scope.read': 'View resources within your assigned scope',
  'memberships.manage': 'Invite and manage workspace members',
  'scopes.manage': 'Manage role and scope access',
  'permissions.configure': 'Configure supported role capabilities',
  'access_history.read': 'Review membership access history',
  'assignments.manage': 'Assign and reassign work within your scope',
  'collisions.override': 'Review and approve collision overrides',
  'exports.create': 'Create controlled exports within your scope',
  'teams.manage': 'Manage teams within your scope',
  'prospects.read': 'View prospects within your assigned scope',
  'activities.manage': 'Record prospect activities',
  'activities.read': 'Review prospect activities',
  'follow_ups.manage': 'Manage follow-ups for assigned work',
  'reports.read': 'View reports within your assigned scope',
};

const CAPABILITY_KEYS: Record<InvitationEmailRole, string[]> = {
  client_admin: [
    'memberships.manage',
    'scopes.manage',
    'permissions.configure',
    'assignments.manage',
    'access_history.read',
  ],
  director: ['assignments.manage', 'collisions.override', 'exports.create', 'teams.manage'],
  manager: ['assignments.manage', 'collisions.override', 'exports.create', 'teams.manage'],
  prospector: ['prospects.read', 'activities.manage', 'follow_ups.manage', 'scope.read'],
  observer: ['scope.read', 'prospects.read', 'activities.read', 'reports.read'],
  super_admin: [],
  support_operator: [],
};

export function getInvitationRoleContent(role: InvitationEmailRole) {
  const catalogueRole =
    role === 'super_admin'
      ? 'super_admin'
      : role === 'support_operator'
        ? 'support_operator'
        : role === 'client_admin'
          ? 'tenant_admin'
          : role === 'observer'
            ? 'auditor'
            : role;
  const definition = ROLES.find((item) => item.role === catalogueRole);
  const roleDisplayName =
    role === 'super_admin'
      ? 'Super administrator'
      : role === 'support_operator'
        ? 'Support operator'
        : role === 'client_admin'
          ? 'Client administrator'
          : role === 'observer'
            ? 'Observer'
            : role.charAt(0).toUpperCase() + role.slice(1);
  const roleCapabilities = CAPABILITY_KEYS[role]
    .filter((key) => {
      const permission = PERMISSIONS.find((item) => item.permission === key);
      return (
        role === 'super_admin' ||
        (permission?.roles as readonly string[] | undefined)?.includes(catalogueRole)
      );
    })
    .map((key) => CAPABILITY_LABELS[key] ?? key);
  return {
    roleDisplayName,
    roleDescription: definition?.description ?? 'Access to TrackRoster within your assigned scope.',
    roleCapabilities,
  };
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!,
  );
}

function safeText(value: string | null | undefined, fallback: string): string {
  const cleaned = (value ?? '').replace(/[\r\n]+/g, ' ').trim();
  return cleaned || fallback;
}

function listItems(items: string[]): string {
  return items
    .slice(0, 5)
    .map(
      (item) =>
        `<tr><td style="padding:0 0 10px 0;vertical-align:top;width:24px;color:#155eef;font-size:18px;line-height:20px;">&#10003;</td><td style="padding:0 0 10px 0;color:#334155;font-size:14px;line-height:20px;">${escapeHtml(item)}</td></tr>`,
    )
    .join('');
}

export function renderInvitationEmail(input: InvitationEmailInput) {
  const recipientName = safeText(input.recipientName, 'there');
  const workspaceName = safeText(input.workspaceName, 'your TrackRoster workspace');
  const inviterName = safeText(input.inviterName, 'Your workspace administrator');
  const roleDisplayName = safeText(input.roleDisplayName, 'Workspace member');
  const roleDescription = safeText(
    input.roleDescription,
    'Access to TrackRoster within your assigned scope.',
  );
  const expirationDate = safeText(input.expirationDate, 'seven days from delivery');
  const invitationUrl = input.invitationUrl;
  const logoUrl = input.logoUrl;
  const subject = `You're invited to ${workspaceName} on TrackRoster`
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 180);
  const text = [
    `Hi ${recipientName},`,
    '',
    `${inviterName} invited you to join ${workspaceName} on TrackRoster.`,
    '',
    `Your role: ${roleDisplayName}`,
    roleDescription,
    ...(input.roleCapabilities.length
      ? ['', 'What you can do:', ...input.roleCapabilities.slice(0, 5).map((item) => `- ${item}`)]
      : []),
    '',
    `Accept your invitation: ${invitationUrl}`,
    '',
    `This invitation expires on ${expirationDate}. It can be used once.`,
    'If you already have a TrackRoster account, confirm your current password and authenticator code when MFA is enabled.',
    '',
    'If you did not expect this invitation, you can ignore this message or contact your workspace administrator.',
    '',
    'TrackRoster — Prospect together. Without ever crossing paths.',
  ].join('\n');
  const escaped = {
    recipientName: escapeHtml(recipientName),
    workspaceName: escapeHtml(workspaceName),
    inviterName: escapeHtml(inviterName),
    roleDisplayName: escapeHtml(roleDisplayName),
    roleDescription: escapeHtml(roleDescription),
    expirationDate: escapeHtml(expirationDate),
    invitationUrl: escapeHtml(invitationUrl),
    logoUrl: escapeHtml(logoUrl),
  };
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="x-apple-disable-message-reformatting">
    <title>${escapeHtml(subject)}</title>
    <style>
      @media screen and (max-width: 600px) {
        .email-shell { width: 100% !important; }
        .email-gutter { padding-left: 18px !important; padding-right: 18px !important; }
        .email-card { border-radius: 0 !important; }
        .email-title { font-size: 26px !important; line-height: 32px !important; }
        .email-button { display: block !important; width: 100% !important; box-sizing: border-box !important; text-align: center !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#f4f7fb;color:#14224a;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;background:#f4f7fb;">
      <tr>
        <td class="email-gutter" align="center" style="padding:28px 12px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="640" class="email-shell" style="width:100%;max-width:640px;">
            <tr>
              <td class="email-card" style="background:#ffffff;border:1px solid #dbe3f0;border-radius:16px;overflow:hidden;box-shadow:0 8px 28px rgba(5,18,74,.08);">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td style="padding:24px 32px;background:#05124a;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="vertical-align:middle;padding-right:10px;">
                            <img src="${escaped.logoUrl}" width="34" height="34" alt="TrackRoster logo" style="display:block;width:34px;height:34px;border:0;">
                          </td>
                          <td style="vertical-align:middle;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-.2px;">TrackRoster</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:38px 42px 12px;">
                      <p style="margin:0 0 12px;color:#155eef;font-size:13px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;">Workspace invitation</p>
                      <h1 class="email-title" style="margin:0;color:#05124a;font-size:32px;line-height:38px;letter-spacing:-.6px;">You’re invited to TrackRoster</h1>
                      <p style="margin:16px 0 0;color:#536788;font-size:16px;line-height:25px;">Hi ${escaped.recipientName}, ${escaped.inviterName} invited you to join <strong style="color:#14224a;">${escaped.workspaceName}</strong>.</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:14px 42px 8px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#eef4ff;border:1px solid #cfe0ff;border-radius:12px;">
                        <tr>
                          <td style="padding:18px 20px;">
                            <p style="margin:0 0 6px;color:#5b6f91;font-size:12px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;">Your role</p>
                            <p style="margin:0 0 8px;color:#0b3b9e;font-size:19px;line-height:26px;font-weight:700;">${escaped.roleDisplayName}</p>
                            <p style="margin:0;color:#334155;font-size:14px;line-height:21px;">${escaped.roleDescription}</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  ${input.roleCapabilities.length ? `<tr><td style="padding:20px 42px 4px;"><p style="margin:0 0 12px;color:#14224a;font-size:16px;font-weight:700;">What you can do</p><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${listItems(input.roleCapabilities)}</table></td></tr>` : ''}
                  <tr>
                    <td style="padding:26px 42px 12px;">
                      <a class="email-button" href="${escaped.invitationUrl}" style="display:inline-block;background:#155eef;border-radius:9px;color:#ffffff;font-size:16px;font-weight:700;line-height:22px;padding:14px 24px;text-decoration:none;">Accept invitation</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:4px 42px 30px;">
                      <p style="margin:0;color:#64748b;font-size:13px;line-height:20px;">This invitation expires on <strong style="color:#334155;">${escaped.expirationDate}</strong> and can be used once.</p>
                      <p style="margin:12px 0 0;color:#64748b;font-size:13px;line-height:20px;">Already have an account? Sign in with your current password. If MFA is enabled, you’ll also confirm your authenticator code.</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:20px 42px;background:#f8fafc;border-top:1px solid #e5eaf2;">
                      <p style="margin:0;color:#64748b;font-size:12px;line-height:19px;">If you did not expect this invitation, you can safely ignore this email or contact your workspace administrator.</p>
                      <p style="margin:12px 0 0;color:#64748b;font-size:12px;line-height:19px;">TrackRoster · Prospect together. Without ever crossing paths.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 10px 0;text-align:center;color:#94a3b8;font-size:11px;line-height:17px;">This is an automated security message from TrackRoster.</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}
