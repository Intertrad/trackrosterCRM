\set ON_ERROR_STOP on

/*
 * Run before migration 0024. The result must contain zero rows.
 * Migration 0024 repeats these blockers while holding the users write lock.
 */
WITH duplicate_normalized_emails AS (
  SELECT
    lower(btrim(email)) AS normalized_email,
    count(*) AS duplicate_count,
    string_agg(id::text, ', ' ORDER BY id::text) AS user_ids
  FROM public.users
  GROUP BY lower(btrim(email))
  HAVING count(*) > 1
),
violations (issue, row_id, detail) AS (
  SELECT
    'users.email_not_normalized',
    id::text,
    email
  FROM public.users
  WHERE email IS DISTINCT FROM lower(btrim(email))

  UNION ALL

  SELECT
    'users.email_blank',
    id::text,
    email
  FROM public.users
  WHERE char_length(btrim(email)) = 0

  UNION ALL

  SELECT
    'users.password_hash_blank',
    id::text,
    NULL::text
  FROM public.users
  WHERE char_length(btrim(password_hash)) = 0

  UNION ALL

  SELECT
    'users.display_name_invalid',
    id::text,
    display_name
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

  SELECT
    'users.tenant_missing',
    users.id::text,
    users.tenant_id::text
  FROM public.users AS users
  LEFT JOIN public.tenants AS tenants
    ON tenants.id = users.tenant_id
  WHERE tenants.id IS NULL

  UNION ALL

  SELECT
    'user_access_grants.user_tenant_mismatch',
    grants.id::text,
    format('grant_tenant=%s user_tenant=%s', grants.tenant_id, users.tenant_id)
  FROM public.user_access_grants AS grants
  LEFT JOIN public.users AS users
    ON users.id = grants.user_id
  WHERE users.id IS NULL
    OR users.tenant_id IS DISTINCT FROM grants.tenant_id

  UNION ALL

  SELECT
    'auth_sessions.user_missing',
    sessions.id::text,
    sessions.user_id::text
  FROM public.auth_sessions AS sessions
  LEFT JOIN public.users AS users
    ON users.id = sessions.user_id
  WHERE users.id IS NULL
)
SELECT issue, row_id, detail
FROM violations
ORDER BY issue, row_id NULLS FIRST;
