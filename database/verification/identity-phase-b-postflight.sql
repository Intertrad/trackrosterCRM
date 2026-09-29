\set ON_ERROR_STOP on
\pset pager off

/*
 * Run immediately after migration 0025, before accepting application traffic.
 *
 * The first result set must contain zero rows. In particular, the migration
 * intentionally revokes every session that existed before the v2 token
 * cutover, so an unrevoked session at this point is a deployment blocker.
 */
\echo 'Identity Phase B postflight issues (expected: zero rows)'

BEGIN;

CREATE TEMP TABLE identity_phase_b_postflight_issues
ON COMMIT DROP
AS
WITH expected_columns (
  column_name,
  udt_name,
  is_nullable,
  character_maximum_length
) AS (
  VALUES
    ('user_id', 'uuid', 'YES', NULL::integer),
    ('identity_id', 'uuid', 'NO', NULL::integer),
    ('membership_id', 'uuid', 'NO', NULL::integer),
    ('tenant_id', 'uuid', 'NO', NULL::integer),
    ('absolute_expires_at', 'timestamptz', 'NO', NULL::integer),
    ('revoked_reason', 'varchar', 'YES', 64)
),
actual_columns AS (
  SELECT column_name, udt_name, is_nullable, character_maximum_length
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'auth_sessions'
),
expected_constraints (
  table_name,
  constraint_name,
  constraint_type,
  local_columns,
  foreign_table,
  foreign_columns,
  update_action,
  delete_action,
  normalized_check_expression
) AS (
  VALUES
    (
      'tenant_memberships',
      'tenant_memberships_tenant_id_identity_unique',
      'u',
      ARRAY['tenant_id', 'id', 'identity_id']::text[],
      NULL::text,
      NULL::text[],
      NULL::text,
      NULL::text,
      NULL::text
    ),
    (
      'auth_sessions',
      'auth_sessions_identity_fk',
      'f',
      ARRAY['identity_id']::text[],
      'public.identities',
      ARRAY['id']::text[],
      'c',
      'c',
      NULL::text
    ),
    (
      'auth_sessions',
      'auth_sessions_tenant_membership_identity_fk',
      'f',
      ARRAY['tenant_id', 'membership_id', 'identity_id']::text[],
      'public.tenant_memberships',
      ARRAY['tenant_id', 'id', 'identity_id']::text[],
      'c',
      'c',
      NULL::text
    ),
    (
      'auth_sessions',
      'auth_sessions_legacy_user_context_check',
      'c',
      NULL::text[],
      NULL::text,
      NULL::text[],
      NULL::text,
      NULL::text,
      'user_idisnulloruser_id=identity_idanduser_id=membership_id'
    ),
    (
      'auth_sessions',
      'auth_sessions_refresh_token_hash_format_check',
      'c',
      NULL::text[],
      NULL::text,
      NULL::text[],
      NULL::text,
      NULL::text,
      'refresh_token_hash~''^[0-9a-f]{64}$'''
    ),
    (
      'auth_sessions',
      'auth_sessions_timestamp_order_check',
      'c',
      NULL::text[],
      NULL::text,
      NULL::text[],
      NULL::text,
      NULL::text,
      'updated_at>=created_atandexpires_at>created_atandabsolute_expires_at>=expires_atandrevoked_atisnullandrevoked_reasonisnullorrevoked_atisnotnullandrevoked_at>=created_atandrevoked_at<=updated_atandrevoked_reasonisnotnullandrevoked_reason=btrimrevoked_reasonandchar_lengthrevoked_reason>0'
    )
),
actual_constraints AS (
  SELECT
    class_row.relname AS table_name,
    constraint_row.conname AS constraint_name,
    constraint_row.contype::text AS constraint_type,
    constraint_row.convalidated,
    ARRAY(
      SELECT attribute_row.attname::text
      FROM unnest(constraint_row.conkey) WITH ORDINALITY
        AS key_column(attribute_number, position)
      INNER JOIN pg_attribute AS attribute_row
        ON attribute_row.attrelid = constraint_row.conrelid
        AND attribute_row.attnum = key_column.attribute_number
      ORDER BY key_column.position
    ) AS local_columns,
    CASE
      WHEN constraint_row.confrelid = 0 THEN NULL
      ELSE format('%I.%I', foreign_namespace.nspname, foreign_class.relname)
    END AS foreign_table,
    ARRAY(
      SELECT attribute_row.attname::text
      FROM unnest(constraint_row.confkey) WITH ORDINALITY
        AS key_column(attribute_number, position)
      INNER JOIN pg_attribute AS attribute_row
        ON attribute_row.attrelid = constraint_row.confrelid
        AND attribute_row.attnum = key_column.attribute_number
      ORDER BY key_column.position
    ) AS foreign_columns,
    constraint_row.confupdtype::text AS update_action,
    constraint_row.confdeltype::text AS delete_action,
    CASE
      WHEN constraint_row.contype <> 'c' THEN NULL
      ELSE translate(
        regexp_replace(
          replace(
            lower(pg_get_expr(constraint_row.conbin, constraint_row.conrelid, true)),
            '::text',
            ''
          ),
          '[[:space:]]',
          '',
          'g'
        ),
        '()"',
        ''
      )
    END AS normalized_check_expression
  FROM pg_constraint AS constraint_row
  INNER JOIN pg_class AS class_row
    ON class_row.oid = constraint_row.conrelid
  INNER JOIN pg_namespace AS namespace_row
    ON namespace_row.oid = class_row.relnamespace
  LEFT JOIN pg_class AS foreign_class
    ON foreign_class.oid = constraint_row.confrelid
  LEFT JOIN pg_namespace AS foreign_namespace
    ON foreign_namespace.oid = foreign_class.relnamespace
  WHERE namespace_row.nspname = 'public'
),
expected_triggers (table_name, trigger_name, function_name, trigger_type) AS (
  VALUES
    (
      'users',
      'users_identity_membership_sync_trigger',
      'sync_legacy_user_identity_membership',
      29::smallint
    ),
    (
      'auth_sessions',
      'auth_sessions_context_trigger',
      'enforce_auth_session_context',
      23::smallint
    ),
    (
      'tenant_memberships',
      'tenant_memberships_immutable_principal_trigger',
      'prevent_tenant_membership_reparenting',
      19::smallint
    ),
    (
      'identities',
      'identities_security_epoch_trigger',
      'enforce_identity_security_epochs',
      19::smallint
    ),
    (
      'identities',
      'identities_revoke_sessions_trigger',
      'revoke_sessions_for_identity_security_change',
      17::smallint
    ),
    (
      'tenant_memberships',
      'tenant_memberships_revoke_sessions_trigger',
      'revoke_sessions_for_membership_state_change',
      17::smallint
    ),
    (
      'tenants',
      'tenants_revoke_sessions_trigger',
      'revoke_sessions_for_tenant_state_change',
      17::smallint
    )
),
actual_triggers AS (
  SELECT
    class_row.relname AS table_name,
    trigger_row.tgname AS trigger_name,
    function_namespace.nspname AS function_schema,
    function_row.proname AS function_name,
    trigger_row.tgenabled,
    trigger_row.tgisinternal,
    trigger_row.tgtype,
    trigger_row.tgqual,
    function_row.prosecdef,
    function_row.proconfig,
    NOT EXISTS (
      SELECT 1
      FROM aclexplode(
        COALESCE(
          function_row.proacl,
          acldefault('f', function_row.proowner)
        )
      ) AS function_acl
      WHERE function_acl.grantee = 0
        AND function_acl.privilege_type = 'EXECUTE'
    ) AS public_execute_revoked
  FROM pg_trigger AS trigger_row
  INNER JOIN pg_class AS class_row
    ON class_row.oid = trigger_row.tgrelid
  INNER JOIN pg_namespace AS namespace_row
    ON namespace_row.oid = class_row.relnamespace
  INNER JOIN pg_proc AS function_row
    ON function_row.oid = trigger_row.tgfoid
  INNER JOIN pg_namespace AS function_namespace
    ON function_namespace.oid = function_row.pronamespace
  WHERE namespace_row.nspname = 'public'
),
expected_indexes (index_name, indexed_columns, normalized_predicate) AS (
  VALUES
    (
      'auth_sessions_identity_id_idx',
      ARRAY['identity_id']::text[],
      NULL::text
    ),
    (
      'auth_sessions_tenant_membership_identity_idx',
      ARRAY['tenant_id', 'membership_id', 'identity_id']::text[],
      NULL::text
    ),
    (
      'auth_sessions_active_identity_session_idx',
      ARRAY['identity_id', 'id']::text[],
      'revoked_atisnull'
    )
),
actual_indexes AS (
  SELECT
    index_class.relname AS index_name,
    index_row.indisvalid,
    index_row.indisready,
    ARRAY(
      SELECT attribute_row.attname::text
      FROM unnest(index_row.indkey::smallint[]) WITH ORDINALITY
        AS key_column(attribute_number, position)
      INNER JOIN pg_attribute AS attribute_row
        ON attribute_row.attrelid = index_row.indrelid
        AND attribute_row.attnum = key_column.attribute_number
      ORDER BY key_column.position
    ) AS indexed_columns,
    CASE
      WHEN index_row.indpred IS NULL THEN NULL
      ELSE regexp_replace(
        lower(pg_get_expr(index_row.indpred, index_row.indrelid, true)),
        '[[:space:]()]',
        '',
        'g'
      )
    END AS normalized_predicate
  FROM pg_index AS index_row
  INNER JOIN pg_class AS table_class
    ON table_class.oid = index_row.indrelid
  INNER JOIN pg_namespace AS namespace_row
    ON namespace_row.oid = table_class.relnamespace
  INNER JOIN pg_class AS index_class
    ON index_class.oid = index_row.indexrelid
  WHERE namespace_row.nspname = 'public'
    AND table_class.relname = 'auth_sessions'
),
violations (issue, row_id, detail) AS (
  SELECT
    'catalog.column_missing_or_wrong',
    expected_columns.column_name,
    format(
      'expected type=%s nullable=%s max_length=%s; actual type=%s nullable=%s max_length=%s',
      expected_columns.udt_name,
      expected_columns.is_nullable,
      expected_columns.character_maximum_length,
      actual_columns.udt_name,
      actual_columns.is_nullable,
      actual_columns.character_maximum_length
    )
  FROM expected_columns
  LEFT JOIN actual_columns
    ON actual_columns.column_name = expected_columns.column_name
  WHERE actual_columns.column_name IS NULL
    OR actual_columns.udt_name IS DISTINCT FROM expected_columns.udt_name
    OR actual_columns.is_nullable IS DISTINCT FROM expected_columns.is_nullable
    OR actual_columns.character_maximum_length
      IS DISTINCT FROM expected_columns.character_maximum_length

  UNION ALL

  SELECT
    'catalog.constraint_missing_wrong_or_unvalidated',
    expected_constraints.constraint_name,
    format(
      'table=%s expected_type=%s actual_type=%s validated=%s local=%s foreign=%s foreign_columns=%s update=%s delete=%s expected_check=%s actual_check=%s',
      expected_constraints.table_name,
      expected_constraints.constraint_type,
      actual_constraints.constraint_type,
      actual_constraints.convalidated,
      actual_constraints.local_columns,
      actual_constraints.foreign_table,
      actual_constraints.foreign_columns,
      actual_constraints.update_action,
      actual_constraints.delete_action,
      expected_constraints.normalized_check_expression,
      actual_constraints.normalized_check_expression
    )
  FROM expected_constraints
  LEFT JOIN actual_constraints
    ON actual_constraints.table_name = expected_constraints.table_name
    AND actual_constraints.constraint_name = expected_constraints.constraint_name
  WHERE actual_constraints.constraint_name IS NULL
    OR actual_constraints.constraint_type IS DISTINCT FROM expected_constraints.constraint_type
    OR actual_constraints.convalidated IS DISTINCT FROM true
    OR (
      expected_constraints.local_columns IS NOT NULL
      AND actual_constraints.local_columns
        IS DISTINCT FROM expected_constraints.local_columns
    )
    OR (
      expected_constraints.foreign_table IS NOT NULL
      AND actual_constraints.foreign_table
        IS DISTINCT FROM expected_constraints.foreign_table
    )
    OR (
      expected_constraints.foreign_columns IS NOT NULL
      AND actual_constraints.foreign_columns
        IS DISTINCT FROM expected_constraints.foreign_columns
    )
    OR (
      expected_constraints.update_action IS NOT NULL
      AND actual_constraints.update_action
        IS DISTINCT FROM expected_constraints.update_action
    )
    OR (
      expected_constraints.delete_action IS NOT NULL
      AND actual_constraints.delete_action
        IS DISTINCT FROM expected_constraints.delete_action
    )
    OR (
      expected_constraints.normalized_check_expression IS NOT NULL
      AND actual_constraints.normalized_check_expression
        IS DISTINCT FROM expected_constraints.normalized_check_expression
    )

  UNION ALL

  SELECT
    'catalog.trigger_missing_disabled_or_insecure',
    expected_triggers.trigger_name,
    format(
      'table=%s expected_function=%s actual=%s.%s enabled=%s trigger_type=%s expected_type=%s has_when=%s security_definer=%s public_execute_revoked=%s search_path=%s',
      expected_triggers.table_name,
      expected_triggers.function_name,
      actual_triggers.function_schema,
      actual_triggers.function_name,
      actual_triggers.tgenabled,
      actual_triggers.tgtype,
      expected_triggers.trigger_type,
      actual_triggers.tgqual IS NOT NULL,
      actual_triggers.prosecdef,
      actual_triggers.public_execute_revoked,
      actual_triggers.proconfig
    )
  FROM expected_triggers
  LEFT JOIN actual_triggers
    ON actual_triggers.table_name = expected_triggers.table_name
    AND actual_triggers.trigger_name = expected_triggers.trigger_name
  WHERE actual_triggers.trigger_name IS NULL
    OR actual_triggers.function_schema IS DISTINCT FROM 'public'
    OR actual_triggers.function_name IS DISTINCT FROM expected_triggers.function_name
    OR actual_triggers.tgenabled IS DISTINCT FROM 'O'
    OR actual_triggers.tgisinternal IS DISTINCT FROM false
    OR actual_triggers.tgtype IS DISTINCT FROM expected_triggers.trigger_type
    OR actual_triggers.tgqual IS NOT NULL
    OR actual_triggers.prosecdef IS DISTINCT FROM true
    OR actual_triggers.public_execute_revoked IS DISTINCT FROM true
    OR NOT (
      'search_path=pg_catalog' = ANY (
        COALESCE(actual_triggers.proconfig, ARRAY[]::text[])
      )
    )

  UNION ALL

  SELECT
    'catalog.index_missing_invalid_or_wrong',
    expected_indexes.index_name,
    format(
      'valid=%s ready=%s expected_columns=%s actual_columns=%s expected_predicate=%s actual_predicate=%s',
      actual_indexes.indisvalid,
      actual_indexes.indisready,
      expected_indexes.indexed_columns,
      actual_indexes.indexed_columns,
      expected_indexes.normalized_predicate,
      actual_indexes.normalized_predicate
    )
  FROM expected_indexes
  LEFT JOIN actual_indexes
    ON actual_indexes.index_name = expected_indexes.index_name
  WHERE actual_indexes.index_name IS NULL
    OR actual_indexes.indisvalid IS DISTINCT FROM true
    OR actual_indexes.indisready IS DISTINCT FROM true
    OR actual_indexes.indexed_columns IS DISTINCT FROM expected_indexes.indexed_columns
    OR actual_indexes.normalized_predicate
      IS DISTINCT FROM expected_indexes.normalized_predicate

  UNION ALL

  SELECT
    'catalog.constraint_not_validated',
    actual_constraints.constraint_name,
    format('table=%s', actual_constraints.table_name)
  FROM actual_constraints
  WHERE actual_constraints.table_name IN ('auth_sessions', 'tenant_memberships')
    AND NOT actual_constraints.convalidated

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
    'auth_sessions.principal_binding_invalid',
    sessions.id::text,
    format(
      'identity=%s membership=%s tenant=%s',
      sessions.identity_id,
      sessions.membership_id,
      sessions.tenant_id
    )
  FROM public.auth_sessions AS sessions
  LEFT JOIN public.identities AS identities
    ON identities.id = sessions.identity_id
  LEFT JOIN public.tenant_memberships AS memberships
    ON memberships.tenant_id = sessions.tenant_id
    AND memberships.id = sessions.membership_id
    AND memberships.identity_id = sessions.identity_id
  WHERE identities.id IS NULL
    OR memberships.id IS NULL

  UNION ALL

  SELECT
    'auth_sessions.legacy_context_invalid',
    sessions.id::text,
    format(
      'user=%s identity=%s membership=%s',
      sessions.user_id,
      sessions.identity_id,
      sessions.membership_id
    )
  FROM public.auth_sessions AS sessions
  WHERE sessions.user_id IS NOT NULL
    AND (
      sessions.user_id IS DISTINCT FROM sessions.identity_id
      OR sessions.user_id IS DISTINCT FROM sessions.membership_id
    )

  UNION ALL

  SELECT
    'auth_sessions.refresh_hash_invalid',
    sessions.id::text,
    NULL::text
  FROM public.auth_sessions AS sessions
  WHERE sessions.refresh_token_hash !~ '^[0-9a-f]{64}$'

  UNION ALL

  SELECT
    'auth_sessions.timestamp_or_revocation_shape_invalid',
    sessions.id::text,
    format(
      'created=%s updated=%s expires=%s absolute=%s revoked=%s reason=%s',
      sessions.created_at,
      sessions.updated_at,
      sessions.expires_at,
      sessions.absolute_expires_at,
      sessions.revoked_at,
      sessions.revoked_reason
    )
  FROM public.auth_sessions AS sessions
  WHERE sessions.updated_at < sessions.created_at
    OR sessions.expires_at <= sessions.created_at
    OR sessions.absolute_expires_at < sessions.expires_at
    OR (
      sessions.revoked_at IS NULL
      AND sessions.revoked_reason IS NOT NULL
    )
    OR (
      sessions.revoked_at IS NOT NULL
      AND (
        sessions.revoked_at < sessions.created_at
        OR sessions.revoked_at > sessions.updated_at
        OR sessions.revoked_reason IS NULL
        OR sessions.revoked_reason IS DISTINCT FROM btrim(sessions.revoked_reason)
        OR char_length(sessions.revoked_reason) = 0
      )
    )

  UNION ALL

  SELECT
    'cutover.session_not_revoked',
    sessions.id::text,
    format(
      'identity=%s membership=%s tenant=%s',
      sessions.identity_id,
      sessions.membership_id,
      sessions.tenant_id
    )
  FROM public.auth_sessions AS sessions
  WHERE sessions.revoked_at IS NULL

  UNION ALL

  SELECT
    'cutover.unexpected_revocation_reason',
    sessions.id::text,
    sessions.revoked_reason
  FROM public.auth_sessions AS sessions
  WHERE sessions.revoked_reason NOT IN (
    'identity_v2_cutover',
    'legacy_revocation'
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
FROM pg_temp.identity_phase_b_postflight_issues
ORDER BY issue, row_id NULLS FIRST;

DO $verification$
DECLARE
  issue_count bigint;
BEGIN
  SELECT count(*)
  INTO issue_count
  FROM pg_temp.identity_phase_b_postflight_issues;

  IF issue_count <> 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'integrity_constraint_violation',
      MESSAGE = format(
        'Identity Phase B postflight failed with %s issue(s)',
        issue_count
      );
  END IF;
END;
$verification$;

\echo 'Identity Phase B reconciliation summary'

SELECT
  (SELECT count(*) FROM public.users) AS legacy_users,
  (SELECT count(*) FROM public.identities) AS identities,
  (SELECT count(*) FROM public.tenant_memberships) AS memberships,
  (SELECT count(*) FROM public.auth_sessions) AS sessions,
  (
    SELECT count(*)
    FROM public.auth_sessions AS sessions
    INNER JOIN public.identities AS identities
      ON identities.id = sessions.identity_id
    INNER JOIN public.tenant_memberships AS memberships
      ON memberships.tenant_id = sessions.tenant_id
      AND memberships.id = sessions.membership_id
      AND memberships.identity_id = sessions.identity_id
  ) AS exact_session_bindings,
  (
    SELECT count(*)
    FROM public.auth_sessions
    WHERE revoked_at IS NULL
  ) AS unrevoked_sessions,
  (
    SELECT count(*)
    FROM public.auth_sessions
    WHERE revoked_reason = 'identity_v2_cutover'
  ) AS cutover_revocations,
  (SELECT count(*) FROM public.platform_access_grants) AS platform_grants,
  (SELECT count(*) FROM public.support_access_grants) AS support_grants;

\echo 'Identity Phase B required columns'

SELECT
  column_name,
  udt_name,
  is_nullable,
  character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'auth_sessions'
  AND column_name IN (
    'user_id',
    'identity_id',
    'membership_id',
    'tenant_id',
    'absolute_expires_at',
    'revoked_reason'
  )
ORDER BY ordinal_position;

\echo 'Identity Phase B required constraints (all must be validated)'

SELECT
  namespace_row.nspname || '.' || class_row.relname AS table_name,
  constraint_row.conname,
  constraint_row.contype,
  constraint_row.convalidated,
  pg_get_constraintdef(constraint_row.oid, true) AS definition
FROM pg_constraint AS constraint_row
INNER JOIN pg_class AS class_row
  ON class_row.oid = constraint_row.conrelid
INNER JOIN pg_namespace AS namespace_row
  ON namespace_row.oid = class_row.relnamespace
WHERE namespace_row.nspname = 'public'
  AND constraint_row.conname IN (
    'tenant_memberships_tenant_id_identity_unique',
    'auth_sessions_identity_fk',
    'auth_sessions_tenant_membership_identity_fk',
    'auth_sessions_legacy_user_context_check',
    'auth_sessions_refresh_token_hash_format_check',
    'auth_sessions_timestamp_order_check'
  )
ORDER BY 1, constraint_row.conname;

\echo 'Identity Phase B compatibility and revocation triggers (all must be enabled)'

SELECT
  namespace_row.nspname || '.' || class_row.relname AS table_name,
  trigger_row.tgname AS trigger_name,
  trigger_row.tgenabled,
  function_row.proname AS function_name,
  function_row.prosecdef AS security_definer,
  NOT EXISTS (
    SELECT 1
    FROM aclexplode(
      COALESCE(
        function_row.proacl,
        acldefault('f', function_row.proowner)
      )
    ) AS function_acl
    WHERE function_acl.grantee = 0
      AND function_acl.privilege_type = 'EXECUTE'
  ) AS public_execute_revoked,
  function_row.proconfig,
  pg_get_triggerdef(trigger_row.oid, true) AS definition
FROM pg_trigger AS trigger_row
INNER JOIN pg_class AS class_row
  ON class_row.oid = trigger_row.tgrelid
INNER JOIN pg_namespace AS namespace_row
  ON namespace_row.oid = class_row.relnamespace
INNER JOIN pg_proc AS function_row
  ON function_row.oid = trigger_row.tgfoid
WHERE namespace_row.nspname = 'public'
  AND trigger_row.tgname IN (
    'users_identity_membership_sync_trigger',
    'auth_sessions_context_trigger',
    'tenant_memberships_immutable_principal_trigger',
    'identities_security_epoch_trigger',
    'identities_revoke_sessions_trigger',
    'tenant_memberships_revoke_sessions_trigger',
    'tenants_revoke_sessions_trigger'
  )
  AND NOT trigger_row.tgisinternal
ORDER BY 1, trigger_row.tgname;

\echo 'Identity Phase B session indexes (all must be valid and ready)'

SELECT
  index_class.relname AS index_name,
  index_row.indisvalid,
  index_row.indisready,
  index_row.indpred IS NOT NULL AS is_partial,
  pg_get_indexdef(index_row.indexrelid, 0, true) AS definition,
  pg_get_expr(index_row.indpred, index_row.indrelid, true) AS predicate
FROM pg_index AS index_row
INNER JOIN pg_class AS table_class
  ON table_class.oid = index_row.indrelid
INNER JOIN pg_namespace AS namespace_row
  ON namespace_row.oid = table_class.relnamespace
INNER JOIN pg_class AS index_class
  ON index_class.oid = index_row.indexrelid
WHERE namespace_row.nspname = 'public'
  AND table_class.relname = 'auth_sessions'
  AND index_class.relname IN (
    'auth_sessions_identity_id_idx',
    'auth_sessions_tenant_membership_identity_idx',
    'auth_sessions_active_identity_session_idx'
  )
ORDER BY index_class.relname;

\echo 'Identity Phase B session revocation reasons'

SELECT
  revoked_reason,
  count(*) AS sessions
FROM public.auth_sessions
GROUP BY revoked_reason
ORDER BY revoked_reason NULLS FIRST;

COMMIT;
