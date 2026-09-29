\set ON_ERROR_STOP on
\pset pager off

/*
 * Run after migration 0024 and immediately before migration 0025.
 *
 * The first result set must contain zero rows. Migration 0025 repeats the
 * session blockers while holding the relevant write locks, so this script is
 * an operator-friendly early warning rather than a substitute for the
 * transactional checks in the migration itself.
 */
\echo 'Identity Phase B preflight issues (expected: zero rows)'

BEGIN;

CREATE TEMP TABLE identity_phase_b_preflight_issues
ON COMMIT DROP
AS
WITH phase_b_columns AS (
  SELECT column_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'auth_sessions'
    AND column_name IN (
      'identity_id',
      'membership_id',
      'tenant_id',
      'absolute_expires_at',
      'revoked_reason'
    )
),
phase_b_catalog_artifacts (artifact_type, artifact_name) AS (
  SELECT 'constraint', constraint_row.conname
  FROM pg_constraint AS constraint_row
  INNER JOIN pg_class AS class_row
    ON class_row.oid = constraint_row.conrelid
  INNER JOIN pg_namespace AS namespace_row
    ON namespace_row.oid = class_row.relnamespace
  WHERE namespace_row.nspname = 'public'
    AND (
      (
        class_row.relname = 'tenant_memberships'
        AND constraint_row.conname = 'tenant_memberships_tenant_id_identity_unique'
      )
      OR (
        class_row.relname = 'auth_sessions'
        AND constraint_row.conname IN (
          'auth_sessions_identity_fk',
          'auth_sessions_tenant_membership_identity_fk',
          'auth_sessions_legacy_user_context_check',
          'auth_sessions_refresh_token_hash_format_check',
          'auth_sessions_timestamp_order_check'
        )
      )
    )

  UNION ALL

  SELECT 'trigger', trigger_row.tgname
  FROM pg_trigger AS trigger_row
  INNER JOIN pg_class AS class_row
    ON class_row.oid = trigger_row.tgrelid
  INNER JOIN pg_namespace AS namespace_row
    ON namespace_row.oid = class_row.relnamespace
  WHERE namespace_row.nspname = 'public'
    AND NOT trigger_row.tgisinternal
    AND (
      (
        class_row.relname = 'auth_sessions'
        AND trigger_row.tgname = 'auth_sessions_context_trigger'
      )
      OR (
        class_row.relname = 'tenant_memberships'
        AND trigger_row.tgname IN (
          'tenant_memberships_immutable_principal_trigger',
          'tenant_memberships_revoke_sessions_trigger'
        )
      )
      OR (
        class_row.relname = 'identities'
        AND trigger_row.tgname IN (
          'identities_security_epoch_trigger',
          'identities_revoke_sessions_trigger'
        )
      )
      OR (
        class_row.relname = 'tenants'
        AND trigger_row.tgname = 'tenants_revoke_sessions_trigger'
      )
    )

  UNION ALL

  SELECT 'function', function_row.proname
  FROM pg_proc AS function_row
  INNER JOIN pg_namespace AS namespace_row
    ON namespace_row.oid = function_row.pronamespace
  WHERE namespace_row.nspname = 'public'
    AND function_row.pronargs = 0
    AND function_row.proname IN (
      'enforce_auth_session_context',
      'prevent_tenant_membership_reparenting',
      'enforce_identity_security_epochs',
      'revoke_sessions_for_identity_security_change',
      'revoke_sessions_for_membership_state_change',
      'revoke_sessions_for_tenant_state_change'
    )

  UNION ALL

  SELECT 'index', class_row.relname
  FROM pg_class AS class_row
  INNER JOIN pg_namespace AS namespace_row
    ON namespace_row.oid = class_row.relnamespace
  WHERE namespace_row.nspname = 'public'
    AND class_row.relkind = 'i'
    AND class_row.relname IN (
      'auth_sessions_identity_id_idx',
      'auth_sessions_tenant_membership_identity_idx',
      'auth_sessions_active_identity_session_idx'
    )
),
violations (issue, row_id, detail) AS (
  SELECT
    'phase_b.already_applied_or_partial',
    NULL::text,
    format('auth_sessions.%s already exists', column_name)
  FROM phase_b_columns

  UNION ALL

  SELECT
    'phase_b.already_applied_or_partial',
    artifact_name,
    format('%s %s already exists', artifact_type, artifact_name)
  FROM phase_b_catalog_artifacts

  UNION ALL

  SELECT
    'phase_a.constraint_not_validated',
    constraint_row.oid::text,
    format('%s.%s', constraint_row.conrelid::regclass, constraint_row.conname)
  FROM pg_constraint AS constraint_row
  WHERE constraint_row.conrelid IN (
    'public.identities'::regclass,
    'public.tenant_memberships'::regclass,
    'public.platform_access_grants'::regclass,
    'public.support_access_grants'::regclass
  )
    AND NOT constraint_row.convalidated

  UNION ALL

  SELECT
    'phase_a.sync_trigger_missing_or_disabled',
    NULL::text,
    'public.users.users_identity_membership_sync_trigger'
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_trigger AS trigger_row
    INNER JOIN pg_proc AS function_row
      ON function_row.oid = trigger_row.tgfoid
    WHERE trigger_row.tgrelid = 'public.users'::regclass
      AND trigger_row.tgname = 'users_identity_membership_sync_trigger'
      AND trigger_row.tgenabled = 'O'
      AND NOT trigger_row.tgisinternal
      AND function_row.proname = 'sync_legacy_user_identity_membership'
  )

  UNION ALL

  SELECT
    'users.identity_missing_or_mismatched',
    users.id::text,
    format('email=%s tenant=%s', users.email, users.tenant_id)
  FROM public.users AS users
  LEFT JOIN public.identities AS identities
    ON identities.id = users.id
  WHERE identities.id IS NULL
    OR identities.email IS DISTINCT FROM users.email
    OR identities.password_hash IS DISTINCT FROM users.password_hash
    OR identities.status::text IS DISTINCT FROM users.status::text

  UNION ALL

  SELECT
    'users.exact_membership_missing_or_mismatched',
    users.id::text,
    format('tenant=%s', users.tenant_id)
  FROM public.users AS users
  LEFT JOIN public.tenant_memberships AS memberships
    ON memberships.tenant_id = users.tenant_id
    AND memberships.id = users.id
    AND memberships.identity_id = users.id
  WHERE memberships.id IS NULL
    OR memberships.display_name IS DISTINCT FROM users.display_name
    OR memberships.status::text IS DISTINCT FROM CASE
      WHEN users.status::text = 'active' THEN 'active'
      ELSE 'suspended'
    END

  UNION ALL

  SELECT
    'user_access_grants.exact_membership_missing',
    grants.id::text,
    format('tenant=%s user=%s', grants.tenant_id, grants.user_id)
  FROM public.user_access_grants AS grants
  LEFT JOIN public.tenant_memberships AS memberships
    ON memberships.tenant_id = grants.tenant_id
    AND memberships.id = grants.user_id
    AND memberships.identity_id = grants.user_id
  WHERE memberships.id IS NULL

  UNION ALL

  SELECT
    'auth_sessions.user_missing',
    sessions.id::text,
    sessions.user_id::text
  FROM public.auth_sessions AS sessions
  LEFT JOIN public.users AS users
    ON users.id = sessions.user_id
  WHERE sessions.user_id IS NULL
    OR users.id IS NULL

  UNION ALL

  SELECT
    'auth_sessions.identity_missing',
    sessions.id::text,
    sessions.user_id::text
  FROM public.auth_sessions AS sessions
  LEFT JOIN public.identities AS identities
    ON identities.id = sessions.user_id
  WHERE identities.id IS NULL

  UNION ALL

  SELECT
    'auth_sessions.exact_membership_missing',
    sessions.id::text,
    format('user=%s tenant=%s', sessions.user_id, users.tenant_id)
  FROM public.auth_sessions AS sessions
  LEFT JOIN public.users AS users
    ON users.id = sessions.user_id
  LEFT JOIN public.tenant_memberships AS memberships
    ON memberships.tenant_id = users.tenant_id
    AND memberships.id = users.id
    AND memberships.identity_id = users.id
  WHERE memberships.id IS NULL

  UNION ALL

  SELECT
    'auth_sessions.refresh_hash_invalid',
    sessions.id::text,
    NULL::text
  FROM public.auth_sessions AS sessions
  WHERE sessions.refresh_token_hash !~ '^[0-9a-f]{64}$'

  UNION ALL

  SELECT
    'auth_sessions.timestamp_order_invalid',
    sessions.id::text,
    format(
      'created=%s updated=%s expires=%s revoked=%s',
      sessions.created_at,
      sessions.updated_at,
      sessions.expires_at,
      sessions.revoked_at
    )
  FROM public.auth_sessions AS sessions
  WHERE sessions.updated_at < sessions.created_at
    OR sessions.expires_at <= sessions.created_at
    OR (
      sessions.revoked_at IS NOT NULL
      AND (
        sessions.revoked_at < sessions.created_at
        OR sessions.revoked_at > sessions.updated_at
      )
    )

  UNION ALL

  SELECT
    'platform_access_grants.must_remain_dormant',
    NULL::text,
    format('rows=%s', count(*))
  FROM public.platform_access_grants
  HAVING count(*) <> 0

  UNION ALL

  SELECT
    'support_access_grants.must_remain_dormant',
    NULL::text,
    format('rows=%s', count(*))
  FROM public.support_access_grants
  HAVING count(*) <> 0
)
SELECT issue, row_id, detail
FROM violations
ORDER BY issue, row_id NULLS FIRST;

SELECT issue, row_id, detail
FROM pg_temp.identity_phase_b_preflight_issues
ORDER BY issue, row_id NULLS FIRST;

DO $verification$
DECLARE
  issue_count bigint;
BEGIN
  SELECT count(*)
  INTO issue_count
  FROM pg_temp.identity_phase_b_preflight_issues;

  IF issue_count <> 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'integrity_constraint_violation',
      MESSAGE = format(
        'Identity Phase B preflight failed with %s issue(s)',
        issue_count
      );
  END IF;
END;
$verification$;

/* Informational only. Phase B deliberately permits dormant extra memberships. */
\echo 'Identity Phase B preflight inventory'

SELECT
  (SELECT count(*) FROM public.users) AS legacy_users,
  (SELECT count(*) FROM public.identities) AS identities,
  (SELECT count(*) FROM public.tenant_memberships) AS memberships,
  (SELECT count(*) FROM public.auth_sessions) AS sessions_to_revoke,
  (
    SELECT count(*)
    FROM public.auth_sessions
    WHERE revoked_at IS NULL
  ) AS currently_active_sessions,
  (SELECT count(*) FROM public.platform_access_grants) AS platform_grants,
  (SELECT count(*) FROM public.support_access_grants) AS support_grants;

/* More than one active membership is allowed in storage but remains runtime-gated. */
\echo 'Informational: identities with multiple active memberships (allowed in storage; runtime-gated)'

SELECT
  memberships.identity_id,
  count(*) AS active_memberships
FROM public.tenant_memberships AS memberships
WHERE memberships.status::text = 'active'
GROUP BY memberships.identity_id
HAVING count(*) > 1
ORDER BY memberships.identity_id;

COMMIT;
