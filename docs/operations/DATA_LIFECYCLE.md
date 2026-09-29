# TrackRoster data lifecycle

TrackRoster separates application code from tenant data. The repository contains
schema migrations, import code, synthetic fixtures, and operational instructions.
It does not contain real prospect workbooks, production records, database dumps,
or provider credentials.

## Development data

Use the development seed for local development and UI work:

```bash
DEV_ADMIN_PASSWORD='use-a-local-password' \
DEV_ROLE_PASSWORD='use-a-local-password' \
pnpm --filter api db:seed
```

The seed is idempotent and creates only synthetic data in the local development
database. It creates the `intertrad` development tenant, a France Sales
organization, a Paris Prospecting team, role users, grants, campaigns, prospects,
activities, assignments, and follow-ups used by the frontend work queue.

The development accounts use `@intertrad.test` addresses. Their passwords come
only from `DEV_ADMIN_PASSWORD` and `DEV_ROLE_PASSWORD`; no password is stored in
the repository. Do not run this seed against staging or production.

The full French prospect workbook is intentionally not part of the seed. It is
real business data and must remain in private storage.

## Importing a real workbook

Import real data only into a disposable development database first, then staging,
and finally production after review. The workbook is larger than the per-job
10,000-row limit, so convert it into category CSV files:

```bash
python3 scripts/convert-prospect-workbook.py \
  /private/path/TrackRoster_Base_Prospection_Interpretes_France.xlsx \
  /tmp/trackroster-prospects
```

The converter writes temporary CSV files and does not connect to PostgreSQL. Keep
the source workbook and generated CSVs outside the repository. The staged import
workflow is documented in [IMPORT_EXPORT_JOBS.md](../backend/IMPORT_EXPORT_JOBS.md):

1. Create an import job as a tenant administrator.
2. Upload one CSV to `POST /imports/{importId}/file`.
3. Validate and inspect rows and issues.
4. Resolve every invalid row or duplicate.
5. Commit only after the validation summary is approved.
6. Repeat for each category and record the job IDs in the deployment evidence.

An import writes establishments and contacts only at commit time. The original
XLS/XLSX binary is not stored by the import job; only parsed staging records,
metadata, hashes, and review results are held in PostgreSQL. Cancelled or expired
staging data is cleared according to the import retention policy.

## Environment separation

Each environment must have its own PostgreSQL database, Redis instance, object
storage bucket, and provider credentials. Set `DATABASE_URL` to the runtime role
and keep migration/seed URLs separate. Never point the development seed at a
production database.

Before a production import:

- apply and verify all migrations;
- confirm the runtime role and tenant RLS policies;
- take an encrypted database backup;
- verify the target tenant and administrator account;
- run a small canary category and review the resulting records;
- import the remaining categories with validation and commit evidence;
- run `ANALYZE` on the affected tables;
- verify counts, contacts, categories, and a sample of records through the API.

## Backups and recovery

Production data belongs in managed PostgreSQL backups with encryption, retention,
access control, and point-in-time recovery where available. Follow
[BACKUP_RESTORE.md](BACKUP_RESTORE.md) for restoration requirements. A backup is
not considered usable until it has been restored into an isolated database and
validated with the restricted runtime role.

## Repository safeguards

The repository ignores `.xls`, `.xlsx`, database dumps, and private import/export
directories. If a real dataset is ever staged locally, verify `git status` before
committing and remove the local copy after the import or move it to approved private
storage.
