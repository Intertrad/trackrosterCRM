# TrackRoster Testing Strategy

**Status:** Proposed team standard

## 1. Testing objective

Testing should prove product invariants, not only code coverage.

The most important TrackRoster tests protect:

- tenant isolation;
- authorization;
- reservation exclusivity;
- collision decisions;
- immutable action history;
- override audit;
- import quality;
- critical user workflows.

## 2. Test pyramid

### Unit tests

Use for:

- pure collision rules;
- lifecycle transitions;
- policy evaluation;
- mapping / normalization;
- validators;
- small domain services.

### Integration tests

Use for:

- repositories;
- database constraints;
- NestJS modules;
- transaction behavior;
- authorization + persistence interactions.

### End-to-end tests

Use for:

- authentication;
- reservation claim;
- action logging;
- manager override;
- import preview/finalization;
- manager dashboard access;
- export authorization.

## 3. Concurrency tests

This is a release-blocking area.

Test at least:

1. two simultaneous incompatible reservation claims;
2. exactly one claim succeeds;
3. the rejected request receives a stable conflict result;
4. expired reservations no longer block;
5. idempotent repeated request does not create duplicate state;
6. override workflow does not bypass unauthorized rules.

## 4. Tenant isolation tests

For every high-risk module, test:

- tenant A cannot read tenant B data;
- tenant A cannot mutate tenant B entity by guessing ID;
- tenant-scoped list endpoints do not leak counts;
- worker jobs resolve the correct tenant;
- exports remain scoped.

## 5. Authorization tests

Test by role:

- super administrator;
- client administrator;
- director;
- manager;
- prospector;
- observer / auditor.

Include negative tests.

## 6. Action immutability tests

Verify:

- action creation appends timeline;
- normal update path cannot rewrite historical meaning;
- correction behavior, if later introduced, remains explicit and auditable.

## 7. Import tests

Test:

- valid CSV / Excel mapping;
- malformed files;
- normalization;
- duplicate detection;
- anomaly reporting;
- tenant isolation;
- finalization idempotency.

## 8. Frontend tests

Focus on behavior:

- decision state rendering;
- disabled / blocked actions;
- form validation;
- mobile critical flows;
- loading / error states.

Do not duplicate backend business logic in frontend tests.

## 9. Coverage

Coverage is a signal, not the goal.

Critical business modules should have substantially higher test depth than low-risk
presentation code.

## 10. CI

CI should run:

```text
lint
type-check
unit tests
integration tests
build
```

Concurrency / E2E suites may run in a dedicated job if they require database services.

## 11. Test data

Use synthetic data.

Never copy real prospect or customer datasets into the repository.
