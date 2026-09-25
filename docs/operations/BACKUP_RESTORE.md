---

# TrackRoster Backup and Restore

**Status:** Initial Draft — requirements only, no tooling exists yet.

This document states what production must do. Nothing here is implemented: there is no
backup script, no scheduled job, and no restore has been rehearsed. Tracked as TR-906
in [Remaining Work](../TRACKROSTER_REMAINING_WORK.md).

One constraint discovered while enforcing tenant isolation, which the restore procedure
must account for: the application connects as the non-privileged `trackroster_app`
role. A database restored without that role, or without the grants in
`infrastructure/docker/postgres/init/01-runtime-role.sql`, will lock the application
out of its own data even though the restore itself reports success.

## Scope

The production backup strategy must cover:

- PostgreSQL;
- object storage, which now exists — MinIO in Compose, with
  `apps/api/src/providers/object-storage.service.ts` and the worker's artifact
  storage writing to it;
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
