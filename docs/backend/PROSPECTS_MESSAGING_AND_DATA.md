# Prospects, messaging and data APIs

Base URL `/api/v1`. Bearer authentication is required. Prospect IDs are existing establishment IDs, not campaign-prospect IDs.

## Prospect master data

- `GET /prospects`: scoped cursor pagination (`limit` 1–100, `cursor`), literal `search`, `campaignId`, `regionId`, `status` active/inactive/archived/all, `sort` name/createdAt, and `direction` asc/desc. Default active, name ascending. The response includes `total`, the number of records matching all filters, so clients can render an exact range for the current page. Retain query parameters when following `nextCursor`.
- `POST /prospects`: tenant administrator; required `name`, two-letter `countryCode`. Optional addressLine1, postalCode, city, phone, website, regionId, externalReference, latitude and longitude. Coordinates must be paired. Requires `Idempotency-Key`.
- `GET/PATCH /prospects/{prospectId}`: detail and partial master-data update. GET returns an ETag; PATCH accepts `If-Match`, returning 412 for stale data. Unknown fields are rejected. Status changes use dedicated archive/restore operations.
- `DELETE /prospects/{prospectId}`: archive, 204. Open assignments, actions, follow-ups, reservations, or override requests prevent archival (409). No history is erased. Database guards reject new open work for archived prospects.
- `POST /prospects/{prospectId}/restore`: restore, 200.
- `GET/POST /prospects/{prospectId}/addresses`: paginated list/create. Body: required line1 and countryCode; optional label, line2, postalCode, city, region, latitude/longitude, isPrimary. Supplied coordinates are validated; no external geocoding is implied. Primary address changes update master coordinates used by maps. Creation requires `Idempotency-Key`.
- `PATCH/DELETE /prospect-addresses/{addressId}`: partial update/soft deletion; optional If-Match. Selecting a primary address clears the previous primary atomically. Delete returns 204.
- `GET/POST /prospects/{prospectId}/contacts`: paginated list/create. Body: name, jobTitle, email, phone, isPrimary. At least name/email/phone is required. Emails are normalized. Creation requires `Idempotency-Key`.
- `PATCH/DELETE /prospect-contacts/{contactId}`: partial update/archive; optional If-Match. Primary contact changes are atomic. Historical consent references remain intact.

Master-data reads follow existing operational access. Writes require operational write authority across every campaign linked to that master record, or tenant administration. This prevents editing shared master data through authority over only one campaign. Existing conservative explicit-deny rules apply. Tenant-safe foreign keys, transactional audit events and role restriction checks apply to writes.

Migrations 0057–0058 add addresses and archive-work protection. Validation has been performed only in the isolated backend database; deployment must apply migrations before enabling the routes.
