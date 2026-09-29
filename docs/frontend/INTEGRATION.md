# Frontend integration — 29 September 2026

Latest visual authority: the user-selected [GitHub TrackRoster frontend](https://github.com/libehon/TrackRoster/tree/main/TrackRoster), pinned at `a8a5455`. The connected implementation, scope differences and current validation are documented in [the GitHub design report](../../output/github-design-implementation/REPORT.md). This supersedes the earlier HTML styling. Beta uses frontend port 3100 and API port 3101.

Previous visual pass: the attached `TrackRoster-apercu (2).html` now drives the shared shell, sign-in, admin overview/live/base/team/activity/companies/settings and prospector day/detail layouts. Backend-backed forms and permissions remain connected. The current scope, browser evidence and remaining reference gaps are recorded in [the visual implementation report](../../output/visual-reference-implementation/REPORT.md).

Earlier extension: the Beta admin base now supports explicit selection, campaign enrollment and assignment in one guided drawer, with a refreshed prospector daily entry and automatic assignment visibility. **690 frontend tests and 43 targeted backend integration tests pass.** The 14-check live handoff verification and preserved workbook counts are in [the reference integration report](../../output/reference-integration-qa/REPORT.md). The detailed earlier integration evidence below remains useful for the wider workspace modules.

The real Next.js application in `apps/web` now includes a role-aware `/workspace` tools directory and 55 domain screens backed by 189 allowlisted API operations. Existing operational pages remain the primary entry points for daily work, campaigns, assignments, imports, exports, reporting, routes, account management and messaging. The offline design ZIP is a reference artifact; the running application uses authenticated backend responses, not its sample records.

## Run and inspect

Use the existing project development commands in the root README. The active development frontend is `http://localhost:3000` and the API is `http://localhost:3001`. `apps/web/.env.local` supplies the API origin. Keep credentials in environment files; do not copy them into a frontend bundle. Sign in with an existing account and open **Workspace tools**. Tenant and identity permissions continue to be enforced by NestJS.

`SCREEN_MAPPING.csv` maps all 215 designed pages, drawers and states to the live implementation or explicitly identifies remaining work. The 215 designs do not represent 215 independent routes. Forms, confirmations, success states and record detail drawers are implemented within their parent screens. A mapping confirms the destination and contract, not end-to-end certification of every scenario.

`WORKSPACE_API_MAP.md` lists each new screen and its read/write operations. Detailed backend accepted fields and response shapes remain in `docs/api/API_ENDPOINTS.md` and `docs/api/API_REQUEST_SCHEMAS.md`.

## What changed

- Added forms and data views for organizations, teams, territories, regions, objectives, campaign configuration, assignment rules, tags, custom fields, duplicates, prospect records/contacts/addresses/consents, settings, notifications, saved views, scheduled reports, access reviews, integrations, API clients, webhooks, audit and platform administration.
- Inputs come from registered Nest DTOs, including required fields, enum values, nested records, dates and numeric limits. Lists use server pagination. Common relation fields have named record selectors. Open-ended provider/geometry contracts remain advanced structured JSON fields.
- Added same-origin `/api/workspace/[...segments]` handlers with an explicit operation allowlist. Browser tokens and tenant headers are not forwarded. Existing HTTP-only session handling authenticates upstream requests. Errors, ETags, idempotency keys and 204 responses are preserved.
- Added validation, retry/error states, destructive confirmations, unsaved-edit protection for drawer close/link navigation, and 412 conflict handling. Editable data is kept separate from background reads. Browser back/forward does not yet offer a full application-wide draft guard.
- Added conversation settings/member management, message editing/deletion confirmation, older-message paging and attachment upload/download controls. Attachment metadata is returned in authorized message lists, without object storage keys. Upload retries keep a stable attachment request key. Files require configured, reachable object storage and browser CORS.
- Account appearance preferences now affect the application. English/French labels, mobile layouts, reduced motion, density and contrast settings use the shared components. Some pre-existing operational screens retain English copy.
- Fixed empty DELETE requests being advertised as JSON, which Fastify rejected. Added platform administration visibility based on an active identity-level grant; tenant administration alone cannot enable it.
- Use the bundled Inter font locally. Restrict Tailwind class discovery to application source so parallel Next build caches are not scanned as CSS classes.

## Live update behavior

Successful mutations trigger local and same-browser-tab invalidation. Focus/reconnect also refreshes. Background reads run approximately every **10 seconds**, with **5-second** messaging/import status checks. Hidden or offline pages pause reads. The shared refresh hook aborts on unmount/scope changes, avoids overlapping requests and coalesces invalidations. Drafts are not replaced by list refreshes; message refreshes preserve scroll position when reading history.

This is near-real-time polling. There is no server WebSocket/SSE event feed in the current integration. A change from another device appears on the next successful poll, subject to network/API availability. Immediate cross-device push requires a tenant-authorized event service, delivery/reconnect handling and a multi-client test.

## Verification

Evidence is in `output/frontend-integration-qa/`:

- **677 frontend tests passed** across 77 files; **9 targeted backend tests passed** for authorization and attachment metadata.
- Frontend/API TypeScript and changed-file lint passed. Production Next build passed in an isolated output directory.
- Live two-session browser test: create through UI, update in a second session, automatic visibility, preserved draft, rejected stale ETag, offline recovery, mobile overflow and test-record cleanup.
- **45 live read checks returned 200**: 35 unscoped module reads and 10 scoped team/campaign/prospect/access reads. Assignment suggestions lacked a matching rule/roster fixture and were not included in the successful-read count.
- Desktop/mobile screenshots and a dark theme layout check. The dark layout check uses a controlled preferences response to verify the runtime theme adapter; it does not claim a persisted preference round trip.
- Strict design audit scoped to the new workspace components: **0 findings**.

No external emails, webhooks or messages to other people were sent during verification. Provider delivery, full business workflows for every role, and load testing are not certified by these checks.

## Remaining work before claiming “everything works”

1. Configure and verify the deployment's email provider, object storage/CORS, OAuth credentials, integration connections and background workers. Exercise import/export/report artifact delivery and webhook retry against controlled test destinations.
2. Complete a true unauthenticated SSO sign-in contract and browser callback. The current backend OAuth link flow requires an authenticated account. Saving SSO policy or a provider connection record is not a complete sign-in or sync implementation.
3. Verify/complete audit evidence export artifact generation; its request/status endpoints alone do not create a usable exported file.
4. Implement the presentation's map heatmap visual layer if required. Live markers and territory boundaries already use backend data.
5. Complete scenario-based acceptance tests for all six roles and tenant/platform isolation with representative data. Test concurrent assignments/reservations, long histories, bulk jobs, external delivery failures and production load.
6. If “real time” means instant cross-device push, add a server event feed. Finish application-wide back/forward draft protection and translate remaining pre-existing English-only copy.
7. Dossier ideas absent from current backend contracts—such as broader inter-company sharing rules or mandatory delivery policies—need explicit backend implementation. This integration does not invent those policies or promote blocked readiness entries to production-ready.

## Regenerate reviewed contracts

From the repository root:

```sh
node scripts/extract-api-contracts.cjs /tmp/trackroster-api-data.json
python3 scripts/generate-workspace-contracts.py /tmp/trackroster-api-data.json
```

The generator contains the curated screen/operation allowlist and derives field metadata from registered controllers. Review its diff whenever an API changes. It must not expose every new backend operation automatically. The proxy is an API boundary, not an arbitrary forwarding endpoint.

Verification commands (direct Node commands avoid package-manager bootstrap):

```sh
node node_modules/typescript/bin/tsc --noEmit -p apps/web/tsconfig.json
node node_modules/typescript/bin/tsc --noEmit -p apps/api/tsconfig.json
node apps/web/node_modules/vitest/vitest.mjs run --config apps/web/vitest.config.ts apps/web/src
node apps/api/node_modules/vitest/vitest.mjs run --config apps/api/vitest.config.ts apps/api/src/authorization/self-access.service.spec.ts apps/api/src/messaging/messaging-attachments.spec.ts
cd apps/web
NEXT_DIST_DIR=.next-integration-build node node_modules/next/dist/bin/next build
```

The optional browser QA scripts are `scripts/qa-frontend-live.mjs` and `scripts/qa-frontend-screens.mjs`. They are restricted to localhost, read the local development admin password from `.env`, and never print credentials. The live test creates then deletes its own named tag. Supply `PLAYWRIGHT_MODULE` and, if needed, `CHROME_PATH` for your local browser runtime; `TRACKROSTER_QA_ORIGIN` selects a local frontend port.
