# TR-FIX-008 provider contract evidence — 2026-10-13

`scripts/check-local-provider-contracts.mjs` exercises the disposable local
providers without contacting production:

- S3-compatible storage: create bucket if needed, upload, download, signed GET,
  and cleanup.
- Mailpit: readiness, send, and indexed-message search.

The probe ran successfully against the local MinIO and Mailpit containers:

```json
{
  "s3": { "roundTrip": true, "signedGet": true },
  "mailpit": { "ready": true, "send": true, "indexed": true }
}
```

The same contract harness can run against a staging S3-compatible endpoint and
Mailpit-compatible sandbox by supplying explicit `PROVIDER_*` variables. Brevo,
hosted object storage, SSO, maps, and webhook sandbox credentials are still
required for hosted certification.

The CI quality job now has explicit `pnpm --filter worker test` and
`pnpm --filter web test` steps in addition to the workspace test gate, so a
worker-only or web-only regression is visible as its own required check.

## Webhook signature and retry contract

The worker test verifies the exact wire contract for a webhook delivery:

```text
signing key = SHA-256(raw secret)
signature   = HMAC-SHA-256(signing key, raw JSON body)
header      = x-trackroster-signature: sha256=<hex digest>
```

The test also confirms that the delivery ID and event are included in the signed
body, and the existing retry test verifies that the fifth failed attempt moves to
`dead_letter` without another delivery. A hosted receiver replay/idempotency drill
is still required for the deployment-specific part of this ticket.
