---

# TrackRoster Backup and Restore

**Status:** Tooling added; disposable archive rehearsal passed on 2026-10-01. Production
scheduling, encrypted off-account retention, and a full restore into an isolated
database remain pending.

This document states what production must do. The repository now includes a safe
custom-format backup command and a non-destructive readability check. A production
schedule, encrypted off-account destination, and isolated restore into a second database
still require environment credentials and an operator-approved target. Tracked as TR-906 in
[Remaining Work](../TRACKROSTER_REMAINING_WORK.md).

## Local or staging commands

```sh
DATABASE_MIGRATION_URL='postgresql://owner@db/trackroster' \
  BACKUP_DIR=/secure/backups \
  node scripts/backup-postgres.mjs

node scripts/verify-postgres-backup.mjs /secure/backups/trackroster-<timestamp>.dump
```

The backup command refuses the restricted `trackroster_app` role, writes a SHA-256
sidecar, and records the runtime-role migration that must be restored alongside the
database. The verification command only reads the archive catalog; it never connects
to or mutates a target database. A restore rehearsal must use an isolated database,
restore the runtime role/grants from
`infrastructure/docker/postgres/init/01-runtime-role.sql`, run migrations/compatibility
checks, and capture tenant/RLS/API/worker evidence before production scheduling.

### Disposable rehearsal evidence (2026-10-01)

Against the PostgreSQL 16 disposable test database, `backup-postgres.mjs` created a
496,470-byte custom-format archive with a SHA-256 sidecar. `verify-postgres-backup.mjs`
read 988 archive entries successfully with a PostgreSQL 18 client. The host's
PostgreSQL 14 client is rejected by the newer server/archive; production operators must
use a client compatible with the server major version (or newer).

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
