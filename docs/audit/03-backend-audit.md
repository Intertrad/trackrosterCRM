# Backend audit

| ID         | Priority | Finding                                                                                               | Status         |
| ---------- | -------- | ----------------------------------------------------------------------------------------------------- | -------------- |
| TR-AUD-005 | P1       | Request-wide tenant transaction interceptor can retain a client for an entire request.                | CONFIRMED RISK |
| TR-AUD-006 | P1       | 340 routes are inventoried but 148 are not ledger-verified and none are fully runtime-certified here. | CONFIRMED GAP  |
| TR-AUD-007 | P2       | Sanitized error envelope and request IDs exist; cross-service correlation is not evidenced.           | NOT_VERIFIED   |
| TR-AUD-008 | P2       | Provider-facing operations need sandbox/contract tests.                                               | NOT_VERIFIED   |
| TR-AUD-009 | P2       | Concurrent shared-client `pg` warning path needs a captured deprecation-free run.                     | NOT_VERIFIED   |

Positive controls: strict validation, API versioning, security headers, auth/session guard, sanitized exception filter.
**Mode:** read-only audit. No application code, production data, branches, or deployment settings were changed. Static evidence is labelled; unverified runtime claims remain unverified.
