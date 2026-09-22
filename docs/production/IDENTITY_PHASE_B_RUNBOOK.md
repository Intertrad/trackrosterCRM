# Identity Phase B Deployment Runbook

This runbook deploys migration `0025_regular_dreadnoughts` and the compatible
identity-backed authentication runtime defined by ADR-005.

Phase B is a security cutover, not a native multi-membership launch. It moves credential
verification to global identities, persists exact identity/membership/tenant session
context, and accepts strict version 2 tokens. It supports only an active same-ID identity
and membership with one active membership in one active tenant.

## Guarantees and non-goals

After a successful cutover:

- credentials are read from `identities`;
- access and refresh tokens identify the global identity, membership, tenant, session,
  token, version, and token type;
- token verification pins issuer, audience, key ID, and algorithm;
- every protected request verifies the persisted session and active identity,
  membership, and tenant;
- refresh rotation is exact-context compare-and-swap and cannot extend the absolute
  session lifetime;
- logout, refresh replay, identity security changes, inactive membership, and inactive
  tenant revoke or invalidate the session;
- every pre-cutover session is revoked and every user must sign in again;
- version 1 tokens are rejected.

Phase B does **not**:

- enable an identity with multiple active memberships;
- enable a distinct-ID membership;
- add tenant-selection or tenant-switching endpoints;
- repoint tenant grants or operational actor foreign keys;
- enable platform or support authorization;
- remove `users` or the Phase A `users_identity_membership_sync_trigger`;
- remove the bounded `auth_sessions_context_trigger` rolling-deployment bridge;
- add RLS or database runtime roles.

Those membership and authorization changes belong to Phase C. Do not work around the
gate by accepting a tenant ID in the password login request or by issuing a token from the
first membership returned by a query.

## Change inventory

Migration `0025`:

1. adds `identity_id`, `membership_id`, `tenant_id`, `absolute_expires_at`, and
   `revoked_reason` to `auth_sessions`;
2. backfills each existing session through the exact same-ID Phase A membership;
3. adds exact identity and composite membership foreign keys plus format, legacy-shape,
   and timestamp checks;
4. makes the new context columns mandatory and leaves `user_id` nullable for the bounded
   compatibility bridge;
5. prevents identity/tenant reparenting of an existing membership;
6. revokes sessions after identity security changes and inactive membership or tenant
   transitions;
7. revokes every pre-cutover session with an attributable reason.

The application cutover:

1. verifies credentials through `identities`;
2. requires one active same-ID compatibility membership and active tenant;
3. issues version 2 access and refresh tokens with distinct audiences;
4. validates exact persisted session state on access, refresh, and logout;
5. retains the public `/auth/me` compatibility response
   `{ "userId": "<membership-id>", "tenantId": "<tenant-id>" }`.

## 1. Prepare the maintenance window

1. Rehearse this exact runbook in a production-like staging environment.
2. Create and verify a restorable database backup.
3. Confirm that Phase A postflight reconciliation is clean.
4. Confirm that the application artifact and migration `0025` come from the same commit.
5. Generate new, independent access- and refresh-signing secrets in the production secret
   manager. Do not expose them to the old API fleet and do not commit them.
6. Announce a forced sign-in: all current sessions will be revoked.
7. Enable maintenance mode or remove external ingress.
8. Drain and stop **all** old API instances before applying the migration.
9. Pause account provisioning, membership changes, login, refresh, and protected API
   traffic until the new application version has passed postflight and smoke checks.

The migration contains a compatibility trigger for old session writers, but that trigger
is not permission to run mixed old and new authentication instances under external
traffic. An old guard can still accept the old token profile without a database session
check.

Run the repository gates:

```bash
pnpm db:migrations:check
pnpm --filter api typecheck
```

Required result: both commands exit successfully. Do not run `db:generate`; migration
`0025_regular_dreadnoughts` and its matching snapshot are already included.

## 2. Run Phase B preflight

Run the checked-in preflight before applying the migration:

```bash
docker compose exec -T postgres psql \
  -v ON_ERROR_STOP=1 \
  -U trackroster \
  -d trackroster \
  < database/verification/identity-phase-b-preflight.sql
```

Required result: the first, labeled issues query returns **zero rows**. The inventory and
multiple-active-membership result sets that follow are informational; multiple active
memberships are allowed in storage but remain runtime-gated. Stop if the issues result set
reports any row. Do not delete, merge, normalize, or reassign production principals
automatically. Resolve each issue deliberately, rerun Phase A reconciliation if relevant,
and repeat preflight.

The migration repeats its critical session checks while holding the source tables, so
skipping this command cannot make invalid rows safe.

## 3. Apply migration 0025

With all old API instances stopped:

```bash
pnpm --filter api db:migrate
```

The migration uses a five-second lock timeout and five-minute statement timeout. It locks
`users`, `tenant_memberships`, and `auth_sessions` for the preflight, backfill, constraint,
trigger, and revocation work. If it reports a timeout or integrity error:

- keep maintenance mode enabled;
- do not edit the journal or applied SQL;
- inspect and correct the blocker;
- rerun preflight before retrying.

Drizzle applies the migration transactionally. A failed migration must leave the schema
and migration journal at `0024`; confirm that before any retry.

## 4. Run Phase B postflight

Run the checked-in postflight immediately after the migration, before starting API
instances or running any login test:

```bash
docker compose exec -T postgres psql \
  -v ON_ERROR_STOP=1 \
  -U trackroster \
  -d trackroster \
  < database/verification/identity-phase-b-postflight.sql
```

Required evidence:

- every authentication session has non-null exact identity, membership, tenant, and
  absolute-expiration context;
- every session satisfies its exact identity/membership/tenant foreign keys;
- every pre-cutover session is revoked;
- all new constraints show `convalidated = t`;
- the Phase A `users_identity_membership_sync_trigger` remains enabled;
- `auth_sessions_context_trigger` and the identity, membership, and tenant revocation
  triggers are enabled for normal-origin writes;
- `identities_security_epoch_trigger` is enabled and credential/security changes must
  advance their corresponding epochs;
- each security-definer trigger function has `search_path=pg_catalog` and no public
  execute privilege;
- platform and support grant counts remain zero.

Treat any mismatch, missing trigger, disabled trigger, unvalidated constraint, or active
pre-cutover session as a failed deployment. Keep ingress closed.

## 5. Deploy one coherent Phase B application version

After the migration and database postflight succeed:

1. deploy the API artifact from the same commit as migration `0025`;
2. install the newly rotated access and refresh JWT secrets prepared for this cutover and
   verify that every Phase B API instance uses the same pair;
3. start all API instances on the Phase B version;
4. keep external ingress closed;
5. do not run an old and new API version concurrently.

There is intentionally no version 1 token compatibility mode. Do not add a fallback to
recover traffic; use the rollback procedure below if the new version cannot pass its
gates.

## 6. Run focused verification

Run the migration and schema checks:

```bash
pnpm db:migrations:check
pnpm --filter api typecheck
```

Run the Phase A reconciliation suite because its one-way bridge remains part of Phase B:

```bash
pnpm --filter api exec vitest run \
  --config=vitest.integration.config.ts \
  test/identity-access-schema.integration.spec.ts
```

Run the Phase B session-schema suite:

```bash
pnpm --filter api exec vitest run \
  --config=vitest.integration.config.ts \
  test/auth-session-schema.integration.spec.ts
```

Run authentication HTTP integration:

```bash
pnpm --filter api exec vitest run \
  --config=vitest.integration.config.ts \
  test/auth.integration.spec.ts
```

Required focused behavior:

- single same-ID membership login succeeds;
- no, inactive, multiple, or distinct-ID membership fails closed;
- token headers, issuer, audiences, version, type, and UUID claims are enforced;
- `/auth/me` rejects a revoked, expired, suspended, or context-mismatched session;
- refresh has exactly one concurrent winner and rejects replay;
- refresh cannot change identity, membership, tenant, session, or absolute expiry;
- logout causes both refresh and access checks for the session to fail;
- identity, membership, and tenant state changes revoke or invalidate the session;
- persistence failures do not become misleading credential errors.

If the Step 6 session-schema test is intentionally renamed, update this runbook in the
same change. Do not silently omit that database-boundary suite.

## 7. Run the complete regression gates

```bash
pnpm --filter api test
pnpm --filter api test:integration
pnpm typecheck
pnpm lint
pnpm build
```

All commands must pass. Expected error logs from explicit negative-path tests are not test
failures, but every test file and test count must be recorded in the release evidence.

## 8. Smoke test before reopening traffic

Use a dedicated staging or release-test identity with exactly one active same-ID
membership. Never paste production tokens into tickets or logs.

1. Login returns HTTP 200 and only `accessToken` and `refreshToken`.
2. `GET /auth/me` with the access token returns the expected compatibility membership and
   tenant IDs.
3. Refresh returns a new pair; replay of the previous refresh token returns HTTP 401.
4. Logout returns HTTP 204.
5. `GET /auth/me` with the logged-out session's access token returns HTTP 401.
6. A pre-cutover/version 1 token returns HTTP 401.
7. A validly signed token with the wrong audience, type, key ID, membership, tenant, or
   session returns HTTP 401.
8. API logs contain no raw access token, refresh token, password, or refresh-token hash.

Confirm that the new session row has:

- the expected `identity_id`, `membership_id`, and `tenant_id`;
- `user_id` equal to the membership only for the same-ID compatibility path;
- a 64-character lowercase hexadecimal refresh-token hash;
- `expires_at <= absolute_expires_at`;
- null revocation fields before logout and an attributable reason after logout.

## 9. Reopen and monitor

Reopen external ingress only after every previous gate passes and a named release owner
approves the evidence.

Monitor at minimum:

- login, refresh, logout, and protected-route status rates;
- unexpected increases in HTTP 401, 409, or 503;
- database constraint, trigger, lock-timeout, and pool errors;
- refresh replay and forced-relogin support volume;
- active sessions with missing context or invalid timestamp shape;
- any attempt to authenticate a multi-membership or distinct-ID identity.

Do not classify a deliberate Phase B multi-membership denial as a reason to bypass the
gate. Complete Phase C instead.

## Rollback and forward-fix

The database migration is additive and has no supported down migration. Prefer a
forward-fix while maintenance mode remains enabled.

If the Phase B application must be rolled back:

1. close ingress and stop every Phase B API instance;
2. revoke all active sessions with an attributable rollback reason;
3. rotate both access and refresh signing secrets if any Phase B token may have been
   issued outside a tightly controlled smoke test;
4. deploy one coherent previous application version;
5. verify the legacy compatibility trigger fills the new mandatory session context;
6. require every user to sign in again;
7. record that the temporary rollback restores the previous, weaker token/session guard;
8. prepare and deploy a forward fix; do not remove migration `0025` objects.

Database-only revocation is not enough after an application rollback because the old
access guard did not consult session state. Signing-secret rotation is what guarantees
that already issued Phase B access tokens cannot remain valid under the old code.

Do not:

- restore version 1 acceptance in the Phase B application;
- edit or delete migration `0025` after it has reached a shared environment;
- disable the Phase A mirror or Phase B compatibility triggers during the rollback
  window;
- enable tenant selection before the Phase C membership-reference cutover;
- populate platform/support grants to solve a tenant-login problem.

## Release evidence checklist

- [ ] Restorable backup evidence
- [ ] Phase B preflight with zero issues
- [ ] Migration `0025` success and journal evidence
- [ ] Phase B postflight with exact counts and catalog evidence
- [ ] Migration-integrity and no-drift evidence
- [ ] API typecheck, unit, focused integration, full integration, lint, and build results
- [ ] Forced-relogin communication and smoke-test evidence
- [ ] Log-redaction review
- [ ] Rollback owner and signing-secret rotation procedure
- [ ] Named release approver
