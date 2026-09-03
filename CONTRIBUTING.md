# Contributing to TrackRoster

Thank you for contributing to TrackRoster.

Before starting significant work, read:

- `docs/README.md`
- `docs/BUSINESS_RULES.md`
- `docs/architecture/SYSTEM_ARCHITECTURE.md`
- `docs/engineering/ENGINEERING_STANDARDS.md`
- `docs/engineering/NAMING_CONVENTIONS.md`
- `docs/engineering/GIT_WORKFLOW.md`

## Development workflow

1. Create a ticket / issue.
2. Create a short-lived branch.
3. Implement one focused change.
4. Add or update tests.
5. Update documentation where behavior changed.
6. Open a pull request.
7. Pass CI.
8. Obtain review.
9. Merge according to repository policy.

## Branch naming

```text
feature/TR-42-reservation-claim
fix/TR-83-reservation-race-condition
docs/TR-102-api-conventions
```

## Commits

Use Conventional Commits.

```text
feat(reservations): add atomic claim
fix(collision): reject overlapping reservation
test(reservations): add race-condition regression test
```

## Non-negotiable review areas

Every reviewer should consider whether the change affects:

- tenant isolation;
- authorization;
- collision rules;
- reservation concurrency;
- action history;
- auditability;
- export scope;
- data migrations.

## Database changes

Never modify production schema manually.

Every schema change requires a migration.

## Secrets

Never commit:

- `.env` files containing real secrets;
- API keys;
- database credentials;
- private keys;
- customer / prospect datasets.

## Documentation

If your change alters a business rule, architecture decision, API contract, environment
variable, or operational process, update documentation in the same pull request.
