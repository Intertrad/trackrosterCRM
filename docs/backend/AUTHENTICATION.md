# Authentication stage — local backend

Implemented on 2026-09-22. Frontend pages are outside this stage. These APIs support both `/api/v1` and the existing unversioned URLs.

## Local configuration

The main stack now provides Mailpit itself: `docker compose up -d` publishes it at http://127.0.0.1:58025, so account email works without a second stack. The disposable backend-validation stack (`docker compose -p trackroster-backend-validation -f docker-compose.backend-test.yml up -d`) still carries its own Mailpit on that same port, so run one mailbox at a time. It captures messages locally; no external SMTP relay is configured.

For an ordinary development API instance, configure:

```dotenv
# Generate a private 32-byte random key encoded as 64 hex characters.
# Keep it stable across restarts and replicas; changing it without re-encryption
# makes existing authenticator secrets and pending mail unreadable.
MFA_ENCRYPTION_KEY=<64-hex-characters>
MAILPIT_URL=http://127.0.0.1:58025
AUTH_PUBLIC_ORIGIN=http://localhost:3000
```

Apply migrations through 0031 to that development database before starting the updated API. Only the isolated database was migrated during implementation. `scripts/backend-test.mjs` supplies synthetic test configuration automatically.

The local email adapter deliberately refuses production mode and non-local mailbox hosts. In production, `AUTH_PUBLIC_ORIGIN` must be the public HTTPS frontend origin (for example `https://trackroaster.com`); startup rejects localhost origins so invitations cannot contain unreachable links. Never deploy the synthetic test key.

## Contracts

| Method | Endpoint                              | Request / response                                                                                                                                                                                             |
| ------ | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/auth/config`                        | Enabled password, TOTP, recovery, and SSO capabilities; no secrets. SSO is disabled.                                                                                                                           |
| POST   | `/auth/login`                         | Existing email/password request. Returns tokens, an MFA challenge, required MFA enrollment, or workspace selection.                                                                                            |
| POST   | `/auth/mfa/enroll`                    | Authenticated; `{password}`. Returns `challengeToken`, `setupKey`, `otpauthUri`, and 300-second expiration.                                                                                                    |
| POST   | `/auth/mfa/verify`                    | `{challengeToken, code}`. Enrollment returns ten recovery codes; login returns tokens or workspace selection.                                                                                                  |
| POST   | `/auth/mfa/recovery`                  | `{challengeToken, code}`. Consumes one recovery code for a password-authenticated login challenge.                                                                                                             |
| POST   | `/auth/mfa/recovery-codes/regenerate` | Authenticated; `{password, code}`. Replaces all recovery codes and revokes sessions; sign in again.                                                                                                            |
| DELETE | `/auth/mfa`                           | Authenticated; `{password, code}`. Disables MFA unless a workspace requires it. Revokes sessions.                                                                                                              |
| POST   | `/auth/password/forgot`               | `{email}`. Always the same 202 acknowledgement for known/unknown accounts; queues mail for eligible accounts.                                                                                                  |
| GET    | `/auth/password-reset/{token}/status` | `{valid}`; does not consume the token or expose account information.                                                                                                                                           |
| POST   | `/auth/password/reset`                | `{token, password}`. 204 on success; 400 if invalid/expired. Enforces the strictest active workspace password policy.                                                                                          |
| POST   | `/memberships`                        | Tenant admin; `{email, role, organizationId?, teamId?, displayName?}`. Creates an invited membership and initial grant, then queues mail. Requires `Idempotency-Key`.                                          |
| POST   | `/memberships/{id}/resend-invite`     | Tenant admin; replaces the old invitation after a one-minute cooldown. Requires `Idempotency-Key`.                                                                                                             |
| GET    | `/invitations/{token}`                | Safe workspace name, masked email, expiry, existing-account and MFA requirements.                                                                                                                              |
| POST   | `/invitations/{token}/accept`         | `{password, mfaCode?}`. New identities choose a password compliant with the accepting workspace; existing identities confirm their current password and MFA. Returns membership ID and `signInRequired: true`. |
| GET    | `/settings/security`                  | Tenant admin; `requireMfa`, `passwordMinLength`, `sessionMaxHours`.                                                                                                                                            |
| PATCH  | `/settings/security`                  | Tenant admin; partial update, `Idempotency-Key`, optional `If-Match`. MFA required before an admin can enable tenant-wide enforcement.                                                                         |

Public invitation roles are `tenant_admin`, `director`, `manager`, `prospector`, and `auditor`. Platform roles cannot be invited through a tenant API. Directors require organization scope, managers/prospectors require team scope, and tenant administrators require tenant scope. All provided scope IDs must belong to the current tenant.

## Login and enrollment

Enrolled identities receive `{mfaRequired: true, challengeToken, expiresIn: 300}` after password verification. No session or workspace list is issued until MFA verification succeeds. Multi-workspace selection occurs afterward using the existing single-use selection token.

If an identity without MFA belongs to a workspace requiring it, password login returns `{mfaEnrollmentRequired: true, challengeToken, setupKey, otpauthUri, expiresIn: 300}`. Complete enrollment using `/auth/mfa/verify`, save the recovery codes, and sign in again. Ordinary authenticated enrollment follows the same verification step.

TOTP uses RFC 6238 HMAC-SHA1, six digits, 30-second steps, and one adjacent step of clock tolerance. Accepted time steps cannot be reused. Secrets are protected with AES-256-GCM bound to the identity. Recovery codes have 128 bits of randomness; only SHA-256 hashes are stored, and plaintext is returned once. Challenges expire after five minutes and permit five failed attempts. Security and credential epochs invalidate outstanding challenges after security changes.

## Recovery and invitations

Reset tokens have 256 bits of randomness, expire after 30 minutes, and can be consumed once. Issuing a replacement invalidates previous tokens. A password reset revokes all sessions but does not remove MFA. The request endpoint has IP/account throttling and a one-minute account cooldown.

Invitation tokens have 256 bits of randomness, expire after seven days, and allow ten credential attempts. Resending invalidates the previous token. Acceptance is serialized with identity/membership changes. Existing identities retain their password and other workspaces. Acceptance never issues a session, so enforced MFA still applies at login.

Invitation email uses a responsive, table-based TrackRoster template with inline-compatible styles, the workspace name, inviter, actual role, permission-backed capabilities, expiry date, HTTPS logo asset, and a prominent accept button. The encrypted outbox stores both the HTML body and the plain-text fallback; Brevo receives `htmlContent` plus `textContent`, while local Mailpit receives `HTML` plus `Text`. Password-reset and other existing messages remain plain text.

Emails use a fragment token, such as `/reset-password#token=...`, to keep the secret out of page request URLs. The frontend must extract it and send it in the appropriate API request; these frontend pages are not implemented by this stage. The required token-status/invitation API paths themselves contain tokens, so infrastructure access logs must redact those paths before production use. The HTML template does not add analytics parameters or third-party tracking URLs.

## Delivery and operations

Email requests are committed to a durable database outbox alongside their tokens. Message bodies and addresses are encrypted at rest. Each API process polls pending messages, using row locks with `SKIP LOCKED` to coordinate replicas. Failed deliveries back off for up to eight attempts; expiration stops delivery. Successful, expired, and permanently failed rows have their encrypted payload removed. A crash after mailbox acceptance but before the database commit can cause duplicate delivery; the underlying token remains single-use.

The outbox exposes `attempts`, `next_attempt_at`, `delivered_at`, and `failed_at` for operational diagnosis. No message body or token is written to application logs. Long-term cleanup/retention and production delivery monitoring remain part of the production-readiness stage.

Unaccepted invitations do not impose account-wide security policy. The target workspace password policy is checked when a new identity accepts its invitation.

Tenant session limits are enforced on every authenticated request, including existing sessions. Password minimums apply to newly chosen passwords; changing a policy does not retroactively alter passwords. Unsupported SSO settings are rejected rather than stored as unenforced policy.

## Verification

Run `node scripts/backend-test.mjs integration` for real PostgreSQL/Redis/Mailpit coverage. Focused suites are `mfa.integration.spec.ts`, `password-recovery.integration.spec.ts`, and `invitations-security.integration.spec.ts`. Cryptographic tests include published RFC 6238 vectors, encrypted-secret identity binding, drift, and replay rejection.

References: [RFC 6238](https://www.rfc-editor.org/rfc/rfc6238), [OWASP MFA guidance](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html), [Mailpit API](https://mailpit.axllent.org/docs/api-v1/).
