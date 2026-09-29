# Identity Phase A Deployment Runbook

This runbook deploys migration `0024_nosy_marvex`, the additive identity schema defined by
[ADR-005](../decisions/ADR-005-identity-tenancy-and-support-access.md).

After the Phase A migration, reconciliation, catalog checks, and focused integration tests
pass, continue with the separate
[Identity Phase B deployment runbook](./IDENTITY_PHASE_B_RUNBOOK.md). Do not rerun Phase A
steps against an environment that has already applied migration `0025`.

Phase A does **not** cut authentication or authorization over to the new model. The legacy
`users` table remains authoritative. The migration backfills same-ID identity and membership
shadows and installs a one-way compatibility trigger so later legacy writes cannot drift.

## Dormant-feature boundary

Until the later phases are implemented and separately approved:

- authentication continues to read `users` and `auth_sessions`;
- tenant authorization continues to read `user_access_grants.user_id`;
- no token may claim a new identity, membership, platform, or support context;
- `platform_access_grants` and `support_access_grants` must remain empty;
- no Super Administrator or support API may be enabled;
- no application code may write the shadow tables directly;
- RLS and restricted runtime-role cutover remain out of scope;
- `users_identity_membership_sync_trigger` must remain enabled.

The trigger also mirrors a legacy hard delete by removing the same-ID membership and, when
no membership or platform/support reference remains, the identity. This exists to preserve
current cleanup behavior; it is not an account-retention design. Do not expose a production
user-delete path until deletion is replaced with an explicitly audited soft-disable or other
approved retention workflow.

The new platform tables define future authority; their presence does not grant authority.

## 1. Before the maintenance window

1. Create and verify a restorable database backup.
2. Confirm that no other deployment or migration is running.
3. Keep authentication traffic available, but pause user provisioning and administrative
   account mutations while the migration command runs.
4. Run the migration-chain check:

```bash
pnpm db:migrations:check
```

Do not run `db:generate`; migration `0024_nosy_marvex` and its snapshot are already included.

## 2. Preflight the existing data

Run this before applying the migration:

```bash
docker compose exec -T postgres psql \
  -v ON_ERROR_STOP=1 \
  -U trackroster \
  -d trackroster <<'SQL'
WITH duplicate_normalized_emails AS (
  SELECT
    lower(btrim(email)) AS normalized_email,
    count(*) AS duplicate_count,
    string_agg(id::text, ', ' ORDER BY id::text) AS user_ids
  FROM public.users
  GROUP BY lower(btrim(email))
  HAVING count(*) > 1
),
violations(issue, row_id, detail) AS (
  SELECT 'users.email_not_normalized', id::text, email
  FROM public.users
  WHERE email IS DISTINCT FROM lower(btrim(email))

  UNION ALL

  SELECT 'users.email_blank', id::text, email
  FROM public.users
  WHERE char_length(btrim(email)) = 0

  UNION ALL

  SELECT 'users.password_hash_blank', id::text, NULL::text
  FROM public.users
  WHERE char_length(btrim(password_hash)) = 0

  UNION ALL

  SELECT 'users.display_name_invalid', id::text, display_name
  FROM public.users
  WHERE display_name IS NOT NULL
    AND (
      display_name IS DISTINCT FROM btrim(display_name)
      OR char_length(display_name) = 0
    )

  UNION ALL

  SELECT
    'users.timestamp_order',
    id::text,
    format('created=%s updated=%s', created_at, updated_at)
  FROM public.users
  WHERE updated_at < created_at

  UNION ALL

  SELECT
    'users.normalized_email_duplicate',
    NULL::text,
    format(
      'email=%s count=%s ids=%s',
      normalized_email,
      duplicate_count,
      user_ids
    )
  FROM duplicate_normalized_emails

  UNION ALL

  SELECT 'users.tenant_missing', users.id::text, users.tenant_id::text
  FROM public.users AS users
  LEFT JOIN public.tenants AS tenants
    ON tenants.id = users.tenant_id
  WHERE tenants.id IS NULL

  UNION ALL

  SELECT
    'user_access_grants.user_tenant_mismatch',
    grants.id::text,
    format(
      'grant_tenant=%s user_tenant=%s',
      grants.tenant_id,
      users.tenant_id
    )
  FROM public.user_access_grants AS grants
  LEFT JOIN public.users AS users
    ON users.id = grants.user_id
  WHERE users.id IS NULL
    OR users.tenant_id IS DISTINCT FROM grants.tenant_id

  UNION ALL

  SELECT 'auth_sessions.user_missing', sessions.id::text, sessions.user_id::text
  FROM public.auth_sessions AS sessions
  LEFT JOIN public.users AS users
    ON users.id = sessions.user_id
  WHERE users.id IS NULL
)
SELECT issue, row_id, detail
FROM violations
ORDER BY issue, row_id NULLS FIRST;
SQL
```

Required result: **zero rows**. Stop if any row is returned. Do not normalize, merge, or
delete production accounts automatically; reconcile them deliberately and rerun preflight.

The migration repeats these blockers while holding the legacy source lock, so skipping
preflight cannot bypass them.

## 3. Apply migration 0024

```bash
pnpm --filter api typecheck
pnpm --filter api db:migrate
```

The migration uses a five-second lock timeout and a five-minute statement timeout. It takes
`SHARE ROW EXCLUSIVE` on `users` only for the final preflight, backfill, reconciliation, and
trigger installation. Reads and session operations can continue; legacy user writes wait.

If the command reports a lock timeout or any reconciliation error, stop. Drizzle runs the
migration in a transaction, so the schema and journal entry roll back together. Do not edit
the migration journal manually.

## 4. Reconcile the backfill

Run immediately after a successful migration:

```bash
docker compose exec -T postgres psql \
  -v ON_ERROR_STOP=1 \
  -U trackroster \
  -d trackroster <<'SQL'
WITH identity_mismatches AS (
  SELECT COALESCE(users.id, identities.id) AS id
  FROM public.users AS users
  FULL JOIN public.identities AS identities
    ON identities.id = users.id
  WHERE users.id IS NULL
    OR identities.id IS NULL
    OR identities.email IS DISTINCT FROM users.email
    OR identities.password_hash IS DISTINCT FROM users.password_hash
    OR identities.status::text IS DISTINCT FROM users.status::text
    OR identities.credentials_updated_at IS DISTINCT FROM users.updated_at
    OR identities.security_state_updated_at IS DISTINCT FROM users.updated_at
    OR identities.suspended_at IS DISTINCT FROM CASE
      WHEN users.status::text = 'suspended' THEN users.updated_at
      ELSE NULL
    END
    OR identities.disabled_at IS DISTINCT FROM CASE
      WHEN users.status::text = 'disabled' THEN users.updated_at
      ELSE NULL
    END
    OR identities.email_verified_at IS NOT NULL
    OR identities.mfa_enrolled_at IS NOT NULL
    OR identities.mfa_recovery_codes_rotated_at IS NOT NULL
    OR identities.last_authenticated_at IS NOT NULL
    OR identities.created_at IS DISTINCT FROM users.created_at
    OR identities.updated_at IS DISTINCT FROM users.updated_at
),
membership_mismatches AS (
  SELECT COALESCE(users.id, memberships.id) AS id
  FROM public.users AS users
  FULL JOIN public.tenant_memberships AS memberships
    ON memberships.id = users.id
  WHERE users.id IS NULL
    OR memberships.id IS NULL
    OR memberships.tenant_id IS DISTINCT FROM users.tenant_id
    OR memberships.identity_id IS DISTINCT FROM users.id
    OR memberships.display_name IS DISTINCT FROM users.display_name
    OR memberships.status::text IS DISTINCT FROM CASE
      WHEN users.status::text = 'active' THEN 'active'
      ELSE 'suspended'
    END
    OR memberships.invited_at IS NOT NULL
    OR memberships.activated_at IS DISTINCT FROM users.created_at
    OR memberships.suspended_at IS DISTINCT FROM CASE
      WHEN users.status::text IN ('suspended', 'disabled') THEN users.updated_at
      ELSE NULL
    END
    OR memberships.departed_at IS NOT NULL
    OR memberships.default_organization_id IS NOT NULL
    OR memberships.default_team_id IS NOT NULL
    OR memberships.created_at IS DISTINCT FROM users.created_at
    OR memberships.updated_at IS DISTINCT FROM users.updated_at
),
grant_mismatches AS (
  SELECT grants.id
  FROM public.user_access_grants AS grants
  LEFT JOIN public.tenant_memberships AS memberships
    ON memberships.tenant_id = grants.tenant_id
    AND memberships.id = grants.user_id
  WHERE memberships.id IS NULL
),
session_mismatches AS (
  SELECT sessions.id
  FROM public.auth_sessions AS sessions
  LEFT JOIN public.identities AS identities
    ON identities.id = sessions.user_id
  WHERE identities.id IS NULL
)
SELECT
  (SELECT count(*) FROM public.users) AS source_users,
  (SELECT count(*) FROM public.identities) AS identities,
  (SELECT count(*) FROM public.tenant_memberships) AS memberships,
  (SELECT count(*) FROM identity_mismatches) AS identity_mismatches,
  (SELECT count(*) FROM membership_mismatches) AS membership_mismatches,
  (SELECT count(*) FROM grant_mismatches) AS grant_mismatches,
  (SELECT count(*) FROM session_mismatches) AS session_mismatches,
  (SELECT count(*) FROM public.platform_access_grants) AS platform_grants,
  (SELECT count(*) FROM public.support_access_grants) AS support_grants;
SQL
```

Required result:

- `source_users = identities = memberships`;
- every mismatch count is `0`;
- `platform_grants = 0`;
- `support_grants = 0`.

## 5. Verify catalog objects and the compatibility bridge

Verify the new tables and enums:

```bash
docker compose exec -T postgres psql \
  -v ON_ERROR_STOP=1 \
  -U trackroster \
  -d trackroster <<'SQL'
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'identities',
    'tenant_memberships',
    'platform_access_grants',
    'support_access_grants'
  )
ORDER BY table_name;

SELECT
  types.typname AS enum_name,
  string_agg(labels.enumlabel, ', ' ORDER BY labels.enumsortorder) AS labels
FROM pg_type AS types
INNER JOIN pg_enum AS labels
  ON labels.enumtypid = types.oid
INNER JOIN pg_namespace AS namespaces
  ON namespaces.oid = types.typnamespace
WHERE namespaces.nspname = 'public'
  AND types.typname IN (
    'identity_status',
    'tenant_membership_status',
    'platform_access_grant_source',
    'platform_role',
    'support_access_grant_status',
    'support_access_scope'
  )
GROUP BY types.typname
ORDER BY types.typname;
SQL
```

Expected enum labels, in order:

| Enum                           | Labels                                 |
| ------------------------------ | -------------------------------------- |
| `identity_status`              | `active, suspended, disabled`          |
| `platform_access_grant_source` | `bootstrap, platform_admin`            |
| `platform_role`                | `super_admin, support_operator`        |
| `support_access_grant_status`  | `requested, approved, denied, revoked` |
| `support_access_scope`         | `read_only`                            |
| `tenant_membership_status`     | `invited, active, suspended, departed` |

Verify constraints and indexes:

```bash
docker compose exec -T postgres psql \
  -v ON_ERROR_STOP=1 \
  -U trackroster \
  -d trackroster <<'SQL'
SELECT
  constraints.conrelid::regclass AS table_name,
  constraints.conname,
  constraints.contype,
  constraints.convalidated,
  pg_get_constraintdef(constraints.oid) AS definition
FROM pg_constraint AS constraints
WHERE constraints.conrelid IN (
  'public.identities'::regclass,
  'public.tenant_memberships'::regclass,
  'public.platform_access_grants'::regclass,
  'public.support_access_grants'::regclass
)
ORDER BY constraints.conrelid::regclass::text, constraints.conname;

SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'identities',
    'tenant_memberships',
    'platform_access_grants',
    'support_access_grants'
  )
ORDER BY tablename, indexname;
SQL
```

Every constraint must show `convalidated = t`. Review the definitions rather than relying
only on object counts.

Verify the trigger function, restricted execution, and enabled trigger:

```bash
docker compose exec -T postgres psql \
  -v ON_ERROR_STOP=1 \
  -U trackroster \
  -d trackroster <<'SQL'
SELECT
  procedures.proname,
  procedures.prosecdef AS security_definer,
  procedures.proconfig,
  EXISTS (
    SELECT 1
    FROM aclexplode(
      COALESCE(
        procedures.proacl,
        acldefault('f', procedures.proowner)
      )
    ) AS privileges
    WHERE privileges.grantee = 0
      AND privileges.privilege_type = 'EXECUTE'
  ) AS public_execute
FROM pg_proc AS procedures
INNER JOIN pg_namespace AS namespaces
  ON namespaces.oid = procedures.pronamespace
WHERE namespaces.nspname = 'public'
  AND procedures.proname = 'sync_legacy_user_identity_membership';

SELECT
  triggers.tgname,
  triggers.tgenabled,
  pg_get_triggerdef(triggers.oid, true) AS definition
FROM pg_trigger AS triggers
INNER JOIN pg_class AS tables
  ON tables.oid = triggers.tgrelid
INNER JOIN pg_namespace AS namespaces
  ON namespaces.oid = tables.relnamespace
WHERE namespaces.nspname = 'public'
  AND tables.relname = 'users'
  AND triggers.tgname = 'users_identity_membership_sync_trigger'
  AND NOT triggers.tgisinternal;
SQL
```

Required result:

- function `security_definer = t`;
- function configuration contains `search_path=pg_catalog`;
- function `public_execute = f`;
- exactly one named trigger row;
- trigger `tgenabled = O` (enabled for normal-origin writes);
- trigger definition covers `AFTER INSERT OR DELETE OR UPDATE` on `users`.

## 6. Verification suite

```bash
pnpm db:migrations:check
pnpm --filter api typecheck
pnpm --filter api test
pnpm --filter api exec vitest run \
  --config=vitest.integration.config.ts \
  test/identity-access-schema.integration.spec.ts
pnpm lint
```

The focused integration suite must prove insert, credential/profile/status update, deletion
cleanup, and transaction rollback behavior for the compatibility trigger.

## Failure, rollback, and forward-fix guidance

### Migration fails before commit

The migration is atomic. Preserve the complete error, correct the cause in a new candidate,
and retry. Never insert or delete a Drizzle journal row manually.

### Migration succeeds but later Phase A checks fail

Keep authentication on the legacy path. Do not drop the new tables and do not enable any
platform or support feature. Ship a later numbered forward-fix migration, then rerun every
query in this runbook.

### Emergency trigger isolation

If the compatibility trigger unexpectedly blocks necessary legacy user writes:

1. stop all user provisioning and account mutations;
2. capture the failing SQLSTATE and database logs;
3. disable the trigger only under an approved incident change;
4. repair and reconcile the shadow rows before re-enabling it.

Disabling the trigger creates an immediate drift risk. Authentication reads can continue,
but no `users` mutation is safe while it is disabled.

### Later-phase rollback

Once Phase B or later writes native identities, memberships, platform grants, or support
grants, destructive rollback is prohibited. Retain the data and forward-fix. Remove the
transitional trigger only after dual-write/cutover reconciliation proves that `users` is no
longer authoritative.
