# Role pages

The dedicated manager, director, observer and platform destinations are listed with evidence in [the role completion report](../../output/role-completion/REPORT.md).

`RoleModulePage` reuses registered workspace module definitions and canonical drawers. `OversightOverview` composes the observer audit and platform health/tenant reads. Login root redirects use `getRoleHome`; platform navigation is based on explicit platform authority, not a tenant-role fallback.

## Observer read-only workspace

The observer shell exposes four connected destinations: `/observer/audit`,
`/observer/prospects`, `/observer/actions` and `/observer/exports`. These pages
are intentionally separate from manager and administrator work queues so the
read-only persona can verify decisions without receiving mutation controls.

- Audit reads use `GET /audit/events` and `GET /audit/events/:eventId`; selecting
  an event opens a read-only detail drawer and can request a scoped evidence
  export with `POST /audit/evidence-exports`.
- Prospects read through `GET /prospects`. The API applies the observer's
  tenant, organization or team grant before returning rows. The UI masks phone,
  e-mail and contact-person values and pseudonymises owners for presentation.
- Actions read through `GET /actions` and show only the action summary fields
  returned by the scoped API. No action mutation client is imported by these
  pages.
- Exports list the audit export stream and creates evidence requests through
  the audit endpoint. Observers do not call controlled operational export
  creation, because that endpoint intentionally requires administrator,
  director or manager authority.

All observer evidence requests are bounded by the server-side scope and are
logged. The responsive table containers scroll horizontally on narrow screens;
the scope banner and masked-data explanation remain visible above the data on
mobile.

Manager/director roster reads use `listScopedMemberships` over the authorized team capacity endpoint. Do not replace this with the administrator-only `/memberships` directory or the prospector-only work queue. `GET /assignments` returns an additive `prospectName` field and retains the assignment's own ETag.

Local demo data is opt-in: `node scripts/seed-beta-demo.mjs` describes the operation; `--apply` writes only to the expected local Beta database. It preserves the imported base and existing account passwords. New examples use deterministic IDs and are visibly labelled.

Frontend capabilities still depend on registered server contracts. Do not represent session planning, template authoring or company cooldown configuration as working before those backend contracts exist.
