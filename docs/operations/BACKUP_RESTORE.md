---

# TrackRoster Backup and Restore

**Status:** Version-matched tooling and a disposable restore rehearsal passed on
2026-10-02. Production scheduling, encrypted off-account retention, and an operator-
approved restore target remain pending.

This document states what production must do. The repository now includes a safe
custom-format backup command and a non-destructive readability check. A production
schedule, encrypted off-account destination, and isolated restore into a second database
still require environment credentials and an operator-approved target. Tracked as TR-906 in
[Remaining Work](../TRACKROSTER_REMAINING_WORK.md).

## Local or staging commands

```sh
DATABASE_MIGRATION_URL='postgresql://owner@db/trackroster' \
  PG_CLIENT_IMAGE=postgres:16 \
  BACKUP_DIR=/secure/backups \
  node scripts/backup-postgres.mjs

PG_CLIENT_IMAGE=postgres:16 \
  node scripts/verify-postgres-backup.mjs /secure/backups/trackroster-<timestamp>.dump
```

The backup command refuses the restricted `trackroster_app` role, writes a SHA-256
sidecar, and records the runtime-role migration that must be restored alongside the
database. The verification command only reads the archive catalog; it never connects
to or mutates a target database. A restore rehearsal must use an isolated database,
restore the runtime role/grants from
`infrastructure/docker/postgres/init/01-runtime-role.sql`, run migrations/compatibility
checks, and capture tenant/RLS/API/worker evidence before production scheduling.
Both commands require PostgreSQL 16 or newer clients. They resolve an explicit
`PG_DUMP_BIN`/`PG_RESTORE_BIN` or `PG_CLIENT_BIN_DIR` first; setting `PG_CLIENT_IMAGE`
uses a version-pinned Docker client and mounts the archive directory so paths outside
the repository are available inside the container. The scripts reject older clients instead of
silently attempting a PostgreSQL 16 backup with PostgreSQL 14 tooling.

### Disposable rehearsal evidence (2026-10-02)

Against the PostgreSQL 16 disposable test database, `backup-postgres.mjs` created a
513,580-byte custom-format archive with a SHA-256 sidecar using `postgres:16/pg_dump`.
`verify-postgres-backup.mjs` read 994 archive entries successfully using
`postgres:16/pg_restore`. The archive was restored into a fresh disposable database,
the runtime role/grants were applied, and 94 public tables were present before the
database was removed. The host's PostgreSQL 14 client is rejected with an actionable
version error; operators must use the version-matched container path or PostgreSQL 16+
native clients.

One constraint discovered while enforcing tenant isolation, which the restore procedure
must account for: the application connects as the non-privileged `trackroster_app`
role. A database restored without that role, or without the grants in
`infrastructure/docker/postgres/init/01-runtime-role.sql`, will lock the application
out of its own data even though the restore itself reports success.

## Scope

The production backup strategy must cover:

- PostgreSQL;
- object storage, using the S3-compatible API in
  `apps/api/src/providers/object-storage.service.ts` and the worker's artifact storage;
  the disposable Compose MinIO image could not be pulled in this environment, so an
  object-store archive rehearsal remains open;
- critical infrastructure configuration.

Redis must not be treated as the only owner of critical business history.

## Database Backups

Production must use automated database backups.

Backups must:

- be encrypted;
- have defined retention;
- be access controlled.

Point-in-time recovery should be enabled when supported by the hosting provider.

## Restore Testing

A backup is not considered reliable until it has successfully been restored.

Restore testing must occur before the national pilot / production rollout.

## Restore Validation

After restoration verify:

- tenant data;
- users;
- prospects;
- assignments;
- action history;
- audit history;
- application connectivity.

## RPO and RTO

Recovery Point Objective and Recovery Time Objective are not yet defined.

These must be agreed with management before production deployment.
