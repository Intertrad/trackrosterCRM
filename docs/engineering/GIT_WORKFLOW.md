# TrackRoster Git Workflow

**Status:** Proposed team standard

## 1. Default branch

`main` is the protected integration branch.

Production releases should be created from reviewed, tested commits on `main` or from a
defined release process if introduced later.

## 2. Branch naming

Format:

```text
<type>/<ticket>-<short-description>
```

Examples:

```text
feature/TR-42-reservation-claim
fix/TR-83-reservation-race-condition
docs/TR-102-api-conventions
```

## 3. Branch lifetime

Keep branches short-lived.

Prefer incremental PRs over long-running branches with many unrelated changes.

### Branch cleanup

Delete a branch only after its changes are merged or intentionally archived, and
only after confirming that no worktree or active task still uses it. For a merged
local branch:

```bash
git branch -d <branch>
```

For its merged remote branch:

```bash
git push origin --delete <branch>
```

Never use `-D` or delete a remote branch solely because it is old. Unmerged
branches can contain the only copy of unfinished work. The active delivery branch
must remain until its pull request is reviewed and merged.

## 4. Commit messages

Use Conventional Commits.

Allowed common types:

- `feat`
- `fix`
- `docs`
- `refactor`
- `test`
- `chore`
- `perf`
- `ci`
- `build`

Examples:

```text
feat(reservations): add atomic prospect claim
fix(collision): reject overlapping active reservation
docs(architecture): document tenant isolation strategy
test(reservations): add concurrent claim integration test
```

Avoid:

```text
changes
fix
update
final
working
```

## 5. Pull request titles

Use the same Conventional Commit style.

Example:

```text
feat(reservations): implement atomic prospect claiming
```

## 6. Pull request size

Prefer PRs that a reviewer can understand in one sitting.

Split changes when they mix unrelated domains.

## 7. Required checks

A PR should not merge unless relevant checks pass:

- lint;
- type-check;
- unit tests;
- integration tests;
- build;
- migration checks where applicable.

## 8. Review requirements

At least one reviewer should verify:

- correctness;
- business-rule impact;
- tenant / authorization impact;
- tests;
- naming;
- documentation;
- migration safety.

## 9. Database changes

Any schema change must include a migration.

PR description must explain:

- why the migration exists;
- destructive risk;
- backfill needs;
- production rollout concerns.

## 10. Business-rule changes

A PR that changes a core invariant must update the matching docs.

Examples:

- collision rules;
- assignment rules;
- status transitions;
- override policy;
- tenant scope.

## 11. Merge strategy

Recommended default: squash merge.

Benefits:

- one clean logical commit per PR;
- easier changelog;
- easier rollback reasoning.

## 12. Hotfixes

Use:

```text
hotfix/<ticket>-<description>
```

Hotfixes still require review unless an emergency process explicitly allows otherwise.
Any emergency bypass must be documented after the incident.
