# TR-FIX-002 contention evidence — 2026-10-13

Against the isolated backend-test PostgreSQL role, the following focused Vitest
files were run three consecutive times:

```text
node scripts/backend-test.mjs api \
  test/reservation.integration.spec.ts \
  test/collision-workflows.integration.spec.ts \
  test/campaign-prospect-assignment.integration.spec.ts
```

Each repetition completed with 3 test files and 54 tests passed. The suites assert
that concurrent reservation, collision-request, manager-decision, and assignment
requests produce one winning state, preserve the unique active row, and reject
the losing mutation. This is local repeated evidence; hosted-scale contention and
production replica behavior remain external gates.
