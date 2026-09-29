# Prospect coordinate backfill

The prospect map plots the canonical `establishments.latitude` and
`establishments.longitude` values. The import workbook contains coordinates for
the Prospection sheet, but many other sheets contain an address without
coordinates. Those records remain visible in the map result panel and are
labelled as missing coordinates until they are geocoded.

TrackRoster includes a controlled backfill script using the French BAN address
API. BAN is free for this use. The script is intentionally rate-limited to one
request per 1.1 seconds by default and never replaces coordinates that already
exist.

Preview the first 25 records without writing:

```bash
pnpm geocode:prospects --limit=25
```

Apply a reviewed batch:

```bash
pnpm geocode:prospects --tenant=<tenant-id> --limit=100 --apply
```

The script uses `DATABASE_SEED_URL` (or `DATABASE_MIGRATION_URL`) because the
restricted runtime role must not be given broad backfill privileges. Each write
still sets `trackroster.tenant_id` in a transaction and includes the tenant in
the update predicate.

BAN results are classified for reporting as `exact`, `street`, or
`postcode_or_city` in the command output. Only successful coordinates are
stored. Ambiguous or failed addresses are left untouched and can be corrected
manually before a later run.
