# Observability and operations audit

Request-id API errors, worker lifecycle logs, and transaction warning thresholds exist.

| ID         | Priority | Finding                                                                                                                        | Status       |
| ---------- | -------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| TR-AUD-030 | P1       | No deployed dashboard/alert evidence for pool exhaustion, RLS failures, 5xx, queue lag, mail terminal failure, and backup age. | NOT_VERIFIED |
| TR-AUD-031 | P2       | Request IDs should trace API, worker, outbox, and provider callbacks.                                                          | NOT_VERIFIED |
| TR-AUD-032 | P2       | SLOs and escalation ownership are not evidenced as active runbooks.                                                            | NOT_VERIFIED |
| TR-AUD-033 | P2       | Redacted release evidence retention is not defined in CI artifacts.                                                            | NOT_VERIFIED |

Do not add verbose payload logging; preserve token, credential, and tenant-data minimization.
**Mode:** read-only audit. No application code, production data, branches, or deployment settings were changed. Static evidence is labelled; unverified runtime claims remain unverified.
