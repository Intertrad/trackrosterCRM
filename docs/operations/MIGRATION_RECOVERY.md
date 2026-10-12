# TrackRoster Migration Recovery

TrackRoster uses forward-only Drizzle migrations. There are no down migrations,
because destructive rollback scripts are unsafe for tenant data and can diverge
from the immutable audit/RLS history. A failed release is recovered by restoring
the last known-good backup into an isolated database, applying a forward fix, and
then promoting that verified database through the deployment platform.

## Before applying a migration

Run the repository checks and create a version-matched backup with the migration
role. Never use `trackroster_app` to create a backup or apply schema changes.

```sh
pnpm db:migrations:recovery-check
DATABASE_MIGRATION_URL='postgresql://owner@db/trackroster' \
  PG_CLIENT_IMAGE=postgres:16 BACKUP_DIR=/secure/backups \
  node scripts/backup-postgres.mjs
```

Record the migration tag, backup checksum, database client version, and deploy
release together. Apply migrations once with the owner connection:

```sh
DATABASE_MIGRATION_URL='postgresql://owner@db/trackroster' \
  pnpm --filter api db:migrate
```

## Recovery after a failed migration

1. Stop application rollout and keep the previous application release available.
2. Preserve the migration output and identify the last applied tag from the
   migration table. Do not edit the journal or delete a migration already applied.
3. Restore the last known-good custom-format backup into a new isolated PostgreSQL
   database using PostgreSQL 16 or newer clients.
4. Apply `infrastructure/docker/postgres/init/01-runtime-role.sql`, then run the
   migration-integrity check and the pending forward migrations against the isolated
   database.
5. Verify tenant/RLS access with the non-privileged `trackroster_app` role, and run
   schema smoke queries for tenants, memberships, prospects, assignments, action
   history, and audit history.
6. Ship a forward repair migration that is idempotent and compatible with both the
   previous and repaired application versions. The repair must be reviewed before
   it is applied to production.
7. Re-run the backup/restore evidence, then promote the repaired database and app
   release together. Keep the original database read-only until the cutover is
   verified.

The procedure preserves tenant isolation, RLS policies, audit immutability, and
transaction boundaries. It does not change production credentials or database
infrastructure; those values are supplied by the deployment operator.
