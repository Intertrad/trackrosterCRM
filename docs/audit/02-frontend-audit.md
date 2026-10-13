# Frontend audit

| ID         | Priority | Finding                                                                                                                   | Status       |
| ---------- | -------- | ------------------------------------------------------------------------------------------------------------------------- | ------------ |
| TR-AUD-001 | P1       | No complete authenticated browser matrix for admin, director, manager, prospector, and client-admin.                      | NOT_VERIFIED |
| TR-AUD-002 | P1       | Route transitions, loading/error states, language switching, and invitation flows lack retained production-like evidence. | NOT_VERIFIED |
| TR-AUD-003 | P2       | Map viewport filtering and large list performance have no baseline.                                                       | NOT_VERIFIED |
| TR-AUD-004 | P2       | French/English key/page parity is not checked in CI.                                                                      | NOT_VERIFIED |

Next evidence: role-based Playwright flows with redacted screenshots, console/API assertions, map filtering, messaging, and locale changes.
**Mode:** read-only audit. No application code, production data, branches, or deployment settings were changed. Static evidence is labelled; unverified runtime claims remain unverified.
