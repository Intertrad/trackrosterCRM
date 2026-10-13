export type PasswordResetEmailInput = {
  resetUrl: string;
  expirationDate: string;
  logoUrl: string;
};

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!,
  );
}

function safeText(value: string, fallback: string): string {
  const cleaned = value.replace(/[\r\n]+/g, ' ').trim();
  return cleaned || fallback;
}

/**
 * Transactional password recovery email. The token remains in the URL
 * fragment so it is not sent in HTTP request logs or referrer headers.
 */
export function renderPasswordResetEmail(input: PasswordResetEmailInput) {
  const resetUrl = input.resetUrl;
  const expirationDate = safeText(input.expirationDate, '30 minutes from delivery');
  const logoUrl = input.logoUrl;
  const subject = 'Reset your TrackRoster password';
  const text = [
    'Reset your TrackRoster password',
    '',
    `Use this secure link within 30 minutes to choose a new password: ${resetUrl}`,
    '',
    `This link expires on ${expirationDate} and can be used once.`,
    'If you did not request this, you can ignore this email. Your password has not changed.',
    '',
    'TrackRoster · Secure workspace access',
  ].join('\n');
  const escaped = {
    resetUrl: escapeHtml(resetUrl),
    expirationDate: escapeHtml(expirationDate),
    logoUrl: escapeHtml(logoUrl),
  };
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="x-apple-disable-message-reformatting">
    <title>${subject}</title>
    <style>
      @media screen and (max-width: 600px) {
        .email-shell { width: 100% !important; }
        .email-gutter { padding: 0 !important; }
        .email-card { border-radius: 0 !important; }
        .email-content { padding-left: 24px !important; padding-right: 24px !important; }
        .email-title { font-size: 27px !important; line-height: 34px !important; }
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
                          <td style="vertical-align:middle;padding-right:10px;"><img src="${escaped.logoUrl}" width="34" height="34" alt="TrackRoster logo" style="display:block;width:34px;height:34px;border:0;"></td>
                          <td style="vertical-align:middle;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-.2px;">TrackRoster</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td class="email-content" style="padding:38px 42px 12px;">
                      <p style="margin:0 0 12px;color:#155eef;font-size:13px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;">Account security</p>
                      <h1 class="email-title" style="margin:0;color:#05124a;font-size:32px;line-height:38px;letter-spacing:-.6px;">Reset your password</h1>
                      <p style="margin:16px 0 0;color:#536788;font-size:16px;line-height:25px;">We received a request to choose a new password for your TrackRoster account.</p>
                    </td>
                  </tr>
                  <tr>
                    <td class="email-content" style="padding:18px 42px 10px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#eef4ff;border:1px solid #cfe0ff;border-radius:12px;">
                        <tr><td style="padding:18px 20px;"><p style="margin:0;color:#334155;font-size:14px;line-height:22px;">Use the button below to create a new password. The link expires on <strong style="color:#14224a;">${escaped.expirationDate}</strong> and can be used once.</p></td></tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td class="email-content" style="padding:24px 42px 12px;"><a class="email-button" href="${escaped.resetUrl}" style="display:inline-block;background:#155eef;border-radius:9px;color:#ffffff;font-size:16px;font-weight:700;line-height:22px;padding:14px 24px;text-decoration:none;">Reset my password</a></td>
                  </tr>
                  <tr>
                    <td class="email-content" style="padding:4px 42px 30px;"><p style="margin:0;color:#64748b;font-size:13px;line-height:20px;">If the button does not work, copy and paste this address into your browser:</p><p style="margin:8px 0 0;word-break:break-all;color:#536788;font-size:12px;line-height:18px;">${escaped.resetUrl}</p><p style="margin:16px 0 0;color:#64748b;font-size:13px;line-height:20px;">If you did not request this, you can ignore this message. Your password has not changed.</p></td>
                  </tr>
                  <tr>
                    <td class="email-content" style="padding:20px 42px;background:#f8fafc;border-top:1px solid #e5eaf2;"><p style="margin:0;color:#64748b;font-size:12px;line-height:19px;">For your security, TrackRoster support will never ask for your password or reset token.</p><p style="margin:12px 0 0;color:#64748b;font-size:12px;line-height:19px;">TrackRoster · Secure workspace access</p></td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr><td style="padding:16px 10px 0;text-align:center;color:#94a3b8;font-size:11px;line-height:17px;">This is an automated security message from TrackRoster.</td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}
