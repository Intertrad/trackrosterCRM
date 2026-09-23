# Outcomes, follow-ups and dashboards

All paths use `/api/v1` and bearer authentication. This document records the supported contract, not production deployment certification.

## Configurable action outcomes

`GET /settings/default-statuses` returns tenant `outcomes`, fixed `lifecycleStages`, `updatedAt` and `etag`. Every authenticated workspace member can read the catalogue. `PATCH` requires a tenant administrator, `Idempotency-Key`, and optional `If-Match` from the current configuration. Its body replaces the entire outcomes array (1–100 definitions).

Each definition contains `code` (lowercase letters/digits/underscores, starts with a letter, maximum 40), `label` (nonblank, maximum 100), `behavior`, `enabled`, and a nonempty unique `actionTypes` array. Example custom definition:

```json
{
  "code": "review_finished",
  "label": "Review finished",
  "behavior": "completed",
  "enabled": true,
  "actionTypes": ["task"]
}
```

Behaviors: `no_answer`, `contacted`, `interested`, `not_interested`, `qualified`, `converted`, `do_not_contact`, `completed`. Action types: `call`, `email`, `message`, `visit`, `task`, `note`. Task/note definitions must use `completed`; contact definitions cannot. Every action type must retain an enabled option, and every contact type must retain enabled opposition. Built-in codes cannot be reassigned different semantics.

Completion accepts configured codes, validates current availability inside the transaction, and snapshots the definition in action event evidence. Custom opposition codes create the same consent block as built-in opposition and cannot schedule another contact. Configuration changes cannot rewrite historical outcomes. Corrections append evidence only; they do not replay business effects. Explicit lifecycle changes remain separate completion inputs; lifecycle enum customization is not supported.

Migration 0047 adds tenant outcome settings. Validation includes custom codes, history, removal, opposition, tenant isolation, administrator restrictions, stale ETags and permission checks before cached replay.
