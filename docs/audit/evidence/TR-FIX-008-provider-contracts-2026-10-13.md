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
