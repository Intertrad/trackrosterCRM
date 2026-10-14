# Integrations audit

| Integration            | Source                                 | Readiness                                                                                                                       |
| ---------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Email/Brevo/Mailpit    | `auth-mail.service.ts`, outbox retries | Local Mailpit contract is verified; hosted credentials, deliverability, and terminal alert remain unverified                    | PARTIAL      |
| Object storage         | communications/object-storage services | Local S3-compatible round-trip and signed download are verified; production bucket, CORS, and attach/download remain unverified | PARTIAL      |
| Maps/geocoding         | map UI and location data               | Keys, rate limits, attribution, viewport performance not verified                                                               | NOT_VERIFIED |
| Webhooks/provider APIs | integration modules/retry paths        | Signature/retry unit coverage exists; hosted sandbox replay/idempotency probe remains unverified                                | PARTIAL      |
| Redis/BullMQ           | producer and worker                    | Hosted durability/failover not verified                                                                                         | NOT_VERIFIED |

Auth mail canonicalizes production links to `https://www.trackroaster.com` and preserves fragment tokens; verify DNS and deployed origin before real invites.
**Mode:** read-only audit. No application code, production data, branches, or deployment settings were changed. Static evidence is labelled; unverified runtime claims remain unverified.
