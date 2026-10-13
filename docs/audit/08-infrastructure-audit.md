# Infrastructure and deployment audit

| ID         | Priority | Finding                                                                                               | Status          |
| ---------- | -------- | ----------------------------------------------------------------------------------------------------- | --------------- |
| TR-AUD-022 | P1       | Hosted API/web/worker topology, replica counts, and pooler mode are absent from repository manifests. | NOT_VERIFIED    |
| TR-AUD-023 | P1       | Backup schedule, off-account retention, PITR, restore target, and RPO/RTO drill are incomplete.       | NOT_VERIFIED    |
| TR-AUD-024 | P1       | DNS/TLS routing for `trackroaster.com` and `www.trackroaster.com` needs live evidence.                | NOT_VERIFIED    |
| TR-AUD-025 | P2       | Production preflight was blocked locally because it requires `NODE_ENV=production`.                   | BLOCKED LOCALLY |

No credentials, infrastructure, domain, migration, or deployment settings were changed.
**Mode:** read-only audit. No application code, production data, branches, or deployment settings were changed. Static evidence is labelled; unverified runtime claims remain unverified.
