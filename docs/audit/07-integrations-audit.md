# Integrations audit

| Integration            | Source                                 | Readiness                                                         |
| ---------------------- | -------------------------------------- | ----------------------------------------------------------------- |
| Email/Brevo/Mailpit    | `auth-mail.service.ts`, outbox retries | Credentials, deliverability, terminal alert not verified          | NOT_VERIFIED |
| Object storage         | communications/object-storage services | Production bucket, CORS, presign/attach/download not verified     | NOT_VERIFIED |
| Maps/geocoding         | map UI and location data               | Keys, rate limits, attribution, viewport performance not verified | NOT_VERIFIED |
| Webhooks/provider APIs | integration modules/retry paths        | Signatures, replay/idempotency, sandbox probes not verified       | NOT_VERIFIED |
| Redis/BullMQ           | producer and worker                    | Hosted durability/failover not verified                           | NOT_VERIFIED |

Auth mail canonicalizes production links to `https://www.trackroaster.com` and preserves fragment tokens; verify DNS and deployed origin before real invites.
**Mode:** read-only audit. No application code, production data, branches, or deployment settings were changed. Static evidence is labelled; unverified runtime claims remain unverified.
