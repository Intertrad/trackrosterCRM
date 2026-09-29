# Staged imports and asynchronous exports

Base path `/api/v1`. All routes require a bearer access token. See [frontend route table](FRONTEND_API_HANDOFF.md) for the complete method/path list. These contracts are verified in the isolated development/test environment; production deployment is not yet signed off.

## Import workflow

Only active tenant administrators can manage import jobs. Jobs and staged data are tenant-isolated. Import mutations require `Idempotency-Key`, except file upload, which uses a content hash for safe retries. Use the latest job `etag` in optional `If-Match`; stale versions return 412.

1. `POST /imports` creates a draft job (201).
2. `POST /imports/{id}/file` uploads multipart field `file` containing CSV or XLSX. Matching canonical headers are mapped automatically. The same file hash is a no-op; replacing the file clears previous staging/review.
3. `PUT /imports/{id}/mapping` saves canonical-field-to-source-header mappings. Example: `{"mapping":{"name":"Business","country_code":"Country","contact_email":"Email"}}`. `name` and `country_code` mappings are required. Headers must exist and cannot be reused for multiple fields.
4. `POST /imports/{id}/validate` persists normalized rows, duplicate matches and issues. A new idempotency key reruns validation against current database contents.
5. Inspect `/rows?afterRow=0&limit=25` and `/issues?limit=25`. Rows return `items,nextAfterRow`; issue/job lists return `items,nextCursor`. Limits are 1–100.
6. `PATCH /import-issues/{issueId}` accepts `{"resolution":"skip"}`, `{"resolution":"reuse"}`, or `{"resolution":"correct","values":{"Business":"Corrected name"}}`. Corrections use source header names and string values. They invalidate **all** staged review, so validate and review again. Skip applies to the entire row. Reuse accepts a valid existing match without overwriting it; within-file duplicates must be skipped or corrected.
7. `POST /imports/{id}/commit` atomically writes resolved establishments/contacts, row results and audit evidence. Invalid or unresolved duplicate rows block the entire commit. Changed live duplicate matches return 409 with no partial writes; revalidate and review. Successful retries return the committed job.
8. Download `/report` after commit or cancellation. The CSV contains processing results and spreadsheet-safe cells. `/cancel` cancels an unfinished job and clears staged/raw contents.

Canonical fields: `external_reference`, `name`, `address_line1`, `postal_code`, `city`, `country_code`, `phone`, `website`, `latitude`, `longitude`, `contact_name`, `contact_job_title`, `contact_email`, `contact_phone`, `is_primary`, `category`.

Limits: 5 MiB input, 10,000 data rows, 100 distinct nonempty headers, 255 characters per header, 10,000 characters per cell. XLSX accepts one sheet, rejects formulas and encrypted/unsupported ZIP entries, and enforces an actual 20 MiB aggregate decompression bound before workbook parsing. Field-specific validation applies after normalization. When `external_reference` is supplied, that source ID is authoritative: exact existing IDs and repeated IDs in a file require review. Distinct IDs remain separate even when name and town match. Without a source ID, normalized name/postal-code/city/country identity matching applies; this is not a general fuzzy duplicate merge workflow. Imports do not automatically enroll prospects in campaigns or allocate assignments.

## Export workflow

Export types are `assignments`, `activities`, and `follow_ups`; formats are `csv` (default) and `xlsx`. Only currently permitted administrator/director/manager scopes qualify. Jobs belong to the requesting membership. Role/scope changes invalidate access to jobs made under the previous grant fingerprint, including old download links.

Example request for both `POST /exports/preview` and `POST /exports`:

```json
{
  "type": "assignments",
  "format": "csv",
  "from": "2026-09-01T00:00:00Z",
  "to": "2026-09-22T00:00:00Z",
  "fields": ["id", "campaignId", "assignedUserId", "assignedAt"]
}
```

Optional filters: `organizationId`, `teamId`, `userId`, `campaignId`. From/to must be supplied together or both omitted; existing reporting date-range limits apply. Preview returns selected fields, scope/estimate information and warnings without creating a job. Omit fields to select all allowed columns; arbitrary database columns are rejected. Canonical field keys are defined in `apps/api/src/exports/export-columns.ts`.

Create requires `Idempotency-Key` and returns 202 with a queued job. Poll `GET /exports/{id}` until completed/failed. Lists and `/audit` support `cursor` and `limit` (1–100). Cancel requires `Idempotency-Key` and works only while queued (or already cancelled).

For a completed job, `GET /exports/{id}/download` returns `url,expiresAt,filename`. Fetch that relative URL with bearer authentication; the token alone is insufficient. It expires after at most five minutes, and requesting another link invalidates the previous one. Artifact lifetime is 24 hours. Download issuance and content access are audited, and current permission is rechecked. The content route is the extension `GET /exports/{id}/file?token=...`.

Limits: 10,000 rows and 20 MiB generated content. Spreadsheet values are sanitized. Job responses omit stored artifact data, hashes and leases. The legacy synchronous `/exports/assignments`, `/exports/activities`, and `/exports/follow_ups` routes retain their existing behavior.

## Operations and validation

Migration `0046_import_export_jobs.sql` adds four tables (59 total schema tables, 47 migrations). It has been applied only to the isolated validation database. Apply the committed migration chain before using these endpoints elsewhere.

The API process polls durable PostgreSQL export jobs every five seconds; `DATA_JOBS_POLLING=off` disables polling for controlled tests. Keep a polling API process running. Database leases coordinate instances, recover crashed processing after five minutes, and prevent stale workers from publishing. Three abandoned attempts exhaust recovery. Generation errors mark jobs failed; request a new job after correcting the cause. Completed content is held in PostgreSQL and cleared after expiry by the poller. Production storage sizing, import-data retention and recovery/load validation remain deployment work.

Validation: 651 API unit tests, 515 API integration tests, and 10 worker integration tests passed, along with API build/typecheck, affected-file lint and migration integrity. The 17 data-job integration cases exercise rollback, concurrent commits, permissions, stale leases, downloads, CSV/XLSX and duplicate review. Additional parser tests reject malformed input and compressed data exceeding its declared size.
