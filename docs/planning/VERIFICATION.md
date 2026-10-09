# Verification evidence

Date: 2026-09-22. Two distinct scopes are reported below.

## Assessed application working tree

Local branch: `feature/manager-prospector-release`; HEAD `572c6b090b0f26c0723e06be01dbfa987acf6f9d` plus existing uncommitted changes. These results are not results for a clean main checkout and do not certify deployment readiness.

Commands and observed results:

```text
pnpm --filter api test
Test Files  1 failed | 68 passed (69)
Tests       4 failed | 625 passed (629)
```

The four failures are in `src/assignments/campaign-prospect-assignment.audit.spec.ts`:

- records assignment creation using the same transaction;
- records reassignment with previous and new ownership;
- does not audit a no-op reassignment;
- propagates audit failure from inside the assignment transaction.

The changed service calls `this.authorizationService.getAssignmentAuthority`, which is missing from this test double. The last test expects `audit insert failed` but receives the missing-method error first. These failures were reproduced by running the already-installed API Vitest binary and the normal pnpm command after an authorized network retry. No assertions were weakened and no runtime files were changed during this evaluation.

```text
./node_modules/.bin/tsc --noEmit -p apps/api/tsconfig.json
Exit 0

node scripts/check-migration-integrity.mjs
Migration integrity check passed: 26 journal entries, SQL files,
and snapshots form one contiguous chain.
```

No new full database/Redis integration run, browser QA, load test or backup restoration was performed for this evaluation. Historical readiness notes are not substituted for fresh execution evidence.

## Planning artifacts

Reproduce the inventory/dependency/publication checks from this PR:

```bash
python3 docs/planning/verify_backlog.py
```

The verifier checks unique ownership of all 381 API operations and 190 design IDs, 85 unique ticket identifiers, issue URLs, dependency references, absence of cycles or later-phase prerequisite inversions, and epic/child consistency. It also guards against the `/me` prefix incorrectly matching `/memberships`, `/messages` and `/metadata`.

Additional checks performed during publication:

- source documents fingerprinted by SHA-256 without committing the original ZIP/PDF/SQL;
- every current implementation reference checked against the assessed local tree;
- exact outgoing issue bodies and evaluation scanned for secret/PII findings: none;
- independent planning review: 9/10, no publication blockers after corrections;
- GitHub issue bodies, titles, priority/area/type labels and milestones fetched back and compared to prepared drafts;
- changed Markdown/JSON formatted with the repository's installed Prettier;
- Git diff whitespace check and documentation-only scope review.

The independent review assessed planning quality only; it did not reproduce application tests or certify the implementation. The application test failures are explicitly carried into TR-100. This PR neither fixes nor ships those unfinished application changes.
