# Role pages

The dedicated manager, director, observer and platform destinations are listed with evidence in [the role completion report](../../output/role-completion/REPORT.md).

`RoleModulePage` reuses registered workspace module definitions and canonical drawers. `OversightOverview` composes the observer audit and platform health/tenant reads. Login root redirects use `getRoleHome`; platform navigation is based on explicit platform authority, not a tenant-role fallback.

Manager/director roster reads use `listScopedMemberships` over the authorized team capacity endpoint. Do not replace this with the administrator-only `/memberships` directory or the prospector-only work queue. `GET /assignments` returns an additive `prospectName` field and retains the assignment's own ETag.

Local demo data is opt-in: `node scripts/seed-beta-demo.mjs` describes the operation; `--apply` writes only to the expected local Beta database. It preserves the imported base and existing account passwords. New examples use deterministic IDs and are visibly labelled.

Frontend capabilities still depend on registered server contracts. Do not represent session planning, template authoring or company cooldown configuration as working before those backend contracts exist.
