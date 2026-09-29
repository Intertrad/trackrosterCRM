\set ON_ERROR_STOP on

/*
 * Run immediately after migration 0024 and before enabling any later identity feature.
 */
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

/* Expected: zero rows. */
SELECT
  conrelid::regclass AS table_name,
  conname,
  contype
FROM pg_constraint
WHERE conrelid IN (
  'public.identities'::regclass,
  'public.tenant_memberships'::regclass,
  'public.platform_access_grants'::regclass,
  'public.support_access_grants'::regclass
)
  AND NOT convalidated
ORDER BY conrelid::regclass::text, conname;

/* Expected: one enabled trigger row (`tgenabled = O`). */
SELECT
  trigger_name,
  tgenabled,
  function_name
FROM (
  SELECT
    trigger_row.tgname AS trigger_name,
    trigger_row.tgenabled,
    function_row.proname AS function_name
  FROM pg_trigger AS trigger_row
  INNER JOIN pg_proc AS function_row
    ON function_row.oid = trigger_row.tgfoid
  WHERE trigger_row.tgrelid = 'public.users'::regclass
    AND trigger_row.tgname = 'users_identity_membership_sync_trigger'
    AND NOT trigger_row.tgisinternal
) AS identity_trigger;

/* Expected: six rows matching ADR-005 and migration 0024. */
SELECT
  pg_type.typname AS enum_name,
  array_agg(pg_enum.enumlabel ORDER BY pg_enum.enumsortorder) AS labels
FROM pg_enum
INNER JOIN pg_type
  ON pg_type.oid = pg_enum.enumtypid
INNER JOIN pg_namespace
  ON pg_namespace.oid = pg_type.typnamespace
WHERE pg_namespace.nspname = 'public'
  AND pg_type.typname IN (
    'identity_status',
    'tenant_membership_status',
    'platform_access_grant_source',
    'platform_role',
    'support_access_grant_status',
    'support_access_scope'
  )
GROUP BY pg_type.typname
ORDER BY pg_type.typname;

/* Expected tenant roles remain exactly the original five values. */
SELECT array_agg(enumlabel ORDER BY enumsortorder) AS tenant_roles
FROM pg_enum
INNER JOIN pg_type
  ON pg_type.oid = pg_enum.enumtypid
INNER JOIN pg_namespace
  ON pg_namespace.oid = pg_type.typnamespace
WHERE pg_namespace.nspname = 'public'
  AND pg_type.typname = 'user_role';
