SET LOCAL lock_timeout = '5s';
--> statement-breakpoint
SET LOCAL statement_timeout = '5min';
--> statement-breakpoint
ALTER TABLE public.auth_sessions ADD COLUMN identity_id uuid;
--> statement-breakpoint
ALTER TABLE public.auth_sessions ADD COLUMN membership_id uuid;
--> statement-breakpoint
ALTER TABLE public.auth_sessions ADD COLUMN tenant_id uuid;
--> statement-breakpoint
ALTER TABLE public.auth_sessions ADD COLUMN absolute_expires_at timestamp with time zone;
--> statement-breakpoint
ALTER TABLE public.auth_sessions ADD COLUMN revoked_reason varchar(64);
--> statement-breakpoint
LOCK TABLE public.users IN SHARE ROW EXCLUSIVE MODE;
--> statement-breakpoint
LOCK TABLE public.tenant_memberships IN SHARE ROW EXCLUSIVE MODE;
--> statement-breakpoint
LOCK TABLE public.auth_sessions IN SHARE ROW EXCLUSIVE MODE;
--> statement-breakpoint
DO $preflight$
DECLARE
  violation_count bigint;
  violation_sample text;
BEGIN
  WITH violations AS (
    SELECT 'session.user_missing' AS issue, sessions.id::text AS row_id
    FROM public.auth_sessions AS sessions
    LEFT JOIN public.users AS users
      ON users.id = sessions.user_id
    WHERE sessions.user_id IS NULL OR users.id IS NULL

    UNION ALL

    SELECT 'session.identity_missing', sessions.id::text
    FROM public.auth_sessions AS sessions
    LEFT JOIN public.identities AS identities
      ON identities.id = sessions.user_id
    WHERE identities.id IS NULL

    UNION ALL

    SELECT 'session.exact_membership_missing', sessions.id::text
    FROM public.auth_sessions AS sessions
    LEFT JOIN public.users AS users
      ON users.id = sessions.user_id
    LEFT JOIN public.tenant_memberships AS memberships
      ON memberships.tenant_id = users.tenant_id
      AND memberships.id = users.id
      AND memberships.identity_id = users.id
    WHERE memberships.id IS NULL

    UNION ALL

    SELECT 'session.refresh_hash_invalid', sessions.id::text
    FROM public.auth_sessions AS sessions
    WHERE sessions.refresh_token_hash !~ '^[0-9a-f]{64}$'

    UNION ALL

    SELECT 'session.timestamp_order', sessions.id::text
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
  )
  SELECT
    count(*),
    (
      SELECT string_agg(format('%s[%s]', issue, row_id), ', ' ORDER BY issue, row_id)
      FROM (
        SELECT issue, row_id
        FROM violations
        ORDER BY issue, row_id
        LIMIT 20
      ) AS sample
    )
  INTO violation_count, violation_sample
  FROM violations;

  IF violation_count > 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'integrity_constraint_violation',
      MESSAGE = format(
        'Authentication session context preflight failed with %s violation(s): %s',
        violation_count,
        violation_sample
      );
  END IF;
END;
$preflight$;
--> statement-breakpoint
UPDATE public.auth_sessions AS sessions
SET
  identity_id = users.id,
  membership_id = memberships.id,
  tenant_id = memberships.tenant_id,
  absolute_expires_at = sessions.expires_at,
  revoked_reason = CASE
    WHEN sessions.revoked_at IS NOT NULL THEN 'legacy_revocation'
    ELSE NULL
  END
FROM public.users AS users
INNER JOIN public.tenant_memberships AS memberships
  ON memberships.tenant_id = users.tenant_id
  AND memberships.id = users.id
  AND memberships.identity_id = users.id
WHERE sessions.user_id = users.id;
--> statement-breakpoint
DO $reconciliation$
DECLARE
  mismatch_count bigint;
BEGIN
  SELECT count(*)
  INTO mismatch_count
  FROM public.auth_sessions AS sessions
  LEFT JOIN public.users AS users
    ON users.id = sessions.user_id
  LEFT JOIN public.identities AS identities
    ON identities.id = sessions.identity_id
  LEFT JOIN public.tenant_memberships AS memberships
    ON memberships.tenant_id = sessions.tenant_id
    AND memberships.id = sessions.membership_id
    AND memberships.identity_id = sessions.identity_id
  WHERE users.id IS NULL
    OR identities.id IS NULL
    OR memberships.id IS NULL
    OR sessions.identity_id IS DISTINCT FROM users.id
    OR sessions.membership_id IS DISTINCT FROM users.id
    OR sessions.tenant_id IS DISTINCT FROM users.tenant_id
    OR sessions.absolute_expires_at IS DISTINCT FROM sessions.expires_at
    OR (
      sessions.revoked_at IS NULL
      AND sessions.revoked_reason IS NOT NULL
    )
    OR (
      sessions.revoked_at IS NOT NULL
      AND sessions.revoked_reason IS DISTINCT FROM 'legacy_revocation'
    );

  IF mismatch_count <> 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'integrity_constraint_violation',
      MESSAGE = format(
        'Authentication session context reconciliation failed with %s mismatch(es)',
        mismatch_count
      );
  END IF;
END;
$reconciliation$;
--> statement-breakpoint
ALTER TABLE public.tenant_memberships
  ADD CONSTRAINT tenant_memberships_tenant_id_identity_unique
  UNIQUE (tenant_id, id, identity_id);
--> statement-breakpoint
ALTER TABLE public.auth_sessions ALTER COLUMN identity_id SET NOT NULL;
--> statement-breakpoint
ALTER TABLE public.auth_sessions ALTER COLUMN membership_id SET NOT NULL;
--> statement-breakpoint
ALTER TABLE public.auth_sessions ALTER COLUMN tenant_id SET NOT NULL;
--> statement-breakpoint
ALTER TABLE public.auth_sessions ALTER COLUMN absolute_expires_at SET NOT NULL;
--> statement-breakpoint
ALTER TABLE public.auth_sessions ALTER COLUMN user_id DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE public.auth_sessions
  ADD CONSTRAINT auth_sessions_identity_fk
  FOREIGN KEY (identity_id)
  REFERENCES public.identities(id)
  ON DELETE CASCADE
  ON UPDATE CASCADE
  NOT VALID;
--> statement-breakpoint
ALTER TABLE public.auth_sessions
  ADD CONSTRAINT auth_sessions_tenant_membership_identity_fk
  FOREIGN KEY (tenant_id, membership_id, identity_id)
  REFERENCES public.tenant_memberships(tenant_id, id, identity_id)
  ON DELETE CASCADE
  ON UPDATE CASCADE
  NOT VALID;
--> statement-breakpoint
ALTER TABLE public.auth_sessions
  ADD CONSTRAINT auth_sessions_legacy_user_context_check
  CHECK (
    user_id IS NULL
    OR (
      user_id = identity_id
      AND user_id = membership_id
    )
  )
  NOT VALID;
--> statement-breakpoint
ALTER TABLE public.auth_sessions
  ADD CONSTRAINT auth_sessions_refresh_token_hash_format_check
  CHECK (refresh_token_hash ~ '^[0-9a-f]{64}$')
  NOT VALID;
--> statement-breakpoint
ALTER TABLE public.auth_sessions
  ADD CONSTRAINT auth_sessions_timestamp_order_check
  CHECK (
    updated_at >= created_at
    AND expires_at > created_at
    AND absolute_expires_at >= expires_at
    AND (
      (
        revoked_at IS NULL
        AND revoked_reason IS NULL
      )
      OR (
        revoked_at IS NOT NULL
        AND revoked_at >= created_at
        AND revoked_at <= updated_at
        AND revoked_reason IS NOT NULL
        AND revoked_reason = btrim(revoked_reason)
        AND char_length(revoked_reason) > 0
      )
    )
  )
  NOT VALID;
--> statement-breakpoint
ALTER TABLE public.auth_sessions VALIDATE CONSTRAINT auth_sessions_identity_fk;
--> statement-breakpoint
ALTER TABLE public.auth_sessions VALIDATE CONSTRAINT auth_sessions_tenant_membership_identity_fk;
--> statement-breakpoint
ALTER TABLE public.auth_sessions VALIDATE CONSTRAINT auth_sessions_legacy_user_context_check;
--> statement-breakpoint
ALTER TABLE public.auth_sessions VALIDATE CONSTRAINT auth_sessions_refresh_token_hash_format_check;
--> statement-breakpoint
ALTER TABLE public.auth_sessions VALIDATE CONSTRAINT auth_sessions_timestamp_order_check;
--> statement-breakpoint
CREATE INDEX auth_sessions_identity_id_idx
  ON public.auth_sessions USING btree (identity_id);
--> statement-breakpoint
CREATE INDEX auth_sessions_tenant_membership_identity_idx
  ON public.auth_sessions USING btree (tenant_id, membership_id, identity_id);
--> statement-breakpoint
CREATE INDEX auth_sessions_active_identity_session_idx
  ON public.auth_sessions USING btree (identity_id, id)
  WHERE revoked_at IS NULL;
--> statement-breakpoint
CREATE FUNCTION public.enforce_auth_session_context()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  legacy_tenant_id uuid;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
      OR NEW.user_id IS DISTINCT FROM OLD.user_id
      OR NEW.identity_id IS DISTINCT FROM OLD.identity_id
      OR NEW.membership_id IS DISTINCT FROM OLD.membership_id
      OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
      OR NEW.absolute_expires_at IS DISTINCT FROM OLD.absolute_expires_at
    THEN
      RAISE EXCEPTION USING
        ERRCODE = 'integrity_constraint_violation',
        MESSAGE = 'Authentication session principal and absolute lifetime are immutable';
    END IF;

    IF OLD.revoked_at IS NOT NULL
      AND (
        NEW.revoked_at IS DISTINCT FROM OLD.revoked_at
        OR NEW.revoked_reason IS DISTINCT FROM OLD.revoked_reason
        OR NEW.refresh_token_hash IS DISTINCT FROM OLD.refresh_token_hash
        OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
      )
    THEN
      RAISE EXCEPTION USING
        ERRCODE = 'integrity_constraint_violation',
        MESSAGE = 'Revoked authentication sessions are immutable';
    END IF;

    IF NEW.expires_at > OLD.absolute_expires_at THEN
      NEW.expires_at := OLD.absolute_expires_at;
    END IF;

    IF NEW.revoked_at IS NOT NULL AND NEW.revoked_reason IS NULL THEN
      NEW.revoked_reason := 'legacy_revocation';
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.identity_id IS NULL
    AND NEW.membership_id IS NULL
    AND NEW.tenant_id IS NULL
  THEN
    IF NEW.user_id IS NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = 'not_null_violation',
        MESSAGE = 'Authentication session principal context is required';
    END IF;

    SELECT users.tenant_id
    INTO legacy_tenant_id
    FROM public.users AS users
    INNER JOIN public.tenant_memberships AS memberships
      ON memberships.tenant_id = users.tenant_id
      AND memberships.id = users.id
      AND memberships.identity_id = users.id
    WHERE users.id = NEW.user_id;

    IF legacy_tenant_id IS NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = 'foreign_key_violation',
        MESSAGE = format(
          'Legacy authentication principal %s has no exact identity membership',
          NEW.user_id
        );
    END IF;

    NEW.identity_id := NEW.user_id;
    NEW.membership_id := NEW.user_id;
    NEW.tenant_id := legacy_tenant_id;
  ELSIF NEW.identity_id IS NULL
    OR NEW.membership_id IS NULL
    OR NEW.tenant_id IS NULL
  THEN
    RAISE EXCEPTION USING
      ERRCODE = 'not_null_violation',
      MESSAGE = 'Authentication session principal context must be supplied completely';
  END IF;

  IF NEW.user_id IS NOT NULL
    AND (
      NEW.user_id IS DISTINCT FROM NEW.identity_id
      OR NEW.user_id IS DISTINCT FROM NEW.membership_id
    )
  THEN
    RAISE EXCEPTION USING
      ERRCODE = 'integrity_constraint_violation',
      MESSAGE = 'Legacy authentication user must match the exact identity membership';
  END IF;

  IF NEW.absolute_expires_at IS NULL THEN
    NEW.absolute_expires_at := NEW.expires_at;
  END IF;

  IF NEW.expires_at > NEW.absolute_expires_at THEN
    NEW.expires_at := NEW.absolute_expires_at;
  END IF;

  IF NEW.revoked_at IS NOT NULL AND NEW.revoked_reason IS NULL THEN
    NEW.revoked_reason := 'legacy_revocation';
  END IF;

  RETURN NEW;
END;
$function$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.enforce_auth_session_context() FROM PUBLIC;
--> statement-breakpoint
COMMENT ON FUNCTION public.enforce_auth_session_context() IS
  'Phase B rolling-deployment bridge. Fills legacy session context and prevents principal or absolute-lifetime mutation.';
--> statement-breakpoint
CREATE TRIGGER auth_sessions_context_trigger
BEFORE INSERT OR UPDATE ON public.auth_sessions
FOR EACH ROW
EXECUTE FUNCTION public.enforce_auth_session_context();
--> statement-breakpoint
CREATE FUNCTION public.prevent_tenant_membership_reparenting()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
    OR NEW.identity_id IS DISTINCT FROM OLD.identity_id
  THEN
    RAISE EXCEPTION USING
      ERRCODE = 'integrity_constraint_violation',
      MESSAGE = 'Tenant membership identity and tenant are immutable';
  END IF;

  RETURN NEW;
END;
$function$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.prevent_tenant_membership_reparenting() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER tenant_memberships_immutable_principal_trigger
BEFORE UPDATE ON public.tenant_memberships
FOR EACH ROW
EXECUTE FUNCTION public.prevent_tenant_membership_reparenting();
--> statement-breakpoint
CREATE FUNCTION public.enforce_identity_security_epochs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION USING
      ERRCODE = 'integrity_constraint_violation',
      MESSAGE = 'Identity ID and creation time are immutable';
  END IF;

  IF NEW.credentials_updated_at < OLD.credentials_updated_at
    OR NEW.security_state_updated_at < OLD.security_state_updated_at
  THEN
    RAISE EXCEPTION USING
      ERRCODE = 'integrity_constraint_violation',
      MESSAGE = 'Identity security epochs cannot move backwards';
  END IF;

  IF (
      NEW.email IS DISTINCT FROM OLD.email
      OR NEW.password_hash IS DISTINCT FROM OLD.password_hash
    )
    AND NEW.credentials_updated_at <= OLD.credentials_updated_at
  THEN
    RAISE EXCEPTION USING
      ERRCODE = 'integrity_constraint_violation',
      MESSAGE = 'Credential changes must advance credentials_updated_at';
  END IF;

  IF (
      NEW.status IS DISTINCT FROM OLD.status
      OR NEW.mfa_enrolled_at IS DISTINCT FROM OLD.mfa_enrolled_at
      OR NEW.mfa_recovery_codes_rotated_at IS DISTINCT FROM OLD.mfa_recovery_codes_rotated_at
    )
    AND NEW.security_state_updated_at <= OLD.security_state_updated_at
  THEN
    RAISE EXCEPTION USING
      ERRCODE = 'integrity_constraint_violation',
      MESSAGE = 'Security-state changes must advance security_state_updated_at';
  END IF;

  RETURN NEW;
END;
$function$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.enforce_identity_security_epochs() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER identities_security_epoch_trigger
BEFORE UPDATE ON public.identities
FOR EACH ROW
EXECUTE FUNCTION public.enforce_identity_security_epochs();
--> statement-breakpoint
CREATE FUNCTION public.revoke_sessions_for_identity_security_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status
    OR NEW.email IS DISTINCT FROM OLD.email
    OR NEW.password_hash IS DISTINCT FROM OLD.password_hash
    OR NEW.email_verified_at IS DISTINCT FROM OLD.email_verified_at
    OR NEW.mfa_enrolled_at IS DISTINCT FROM OLD.mfa_enrolled_at
    OR NEW.mfa_recovery_codes_rotated_at IS DISTINCT FROM OLD.mfa_recovery_codes_rotated_at
    OR NEW.credentials_updated_at IS DISTINCT FROM OLD.credentials_updated_at
    OR NEW.security_state_updated_at IS DISTINCT FROM OLD.security_state_updated_at
  THEN
    UPDATE public.auth_sessions AS sessions
    SET
      revoked_at = GREATEST(CURRENT_TIMESTAMP, sessions.created_at),
      revoked_reason = 'identity_security_change',
      updated_at = GREATEST(sessions.updated_at, CURRENT_TIMESTAMP, sessions.created_at)
    WHERE sessions.identity_id = NEW.id
      AND sessions.revoked_at IS NULL;
  END IF;

  RETURN NEW;
END;
$function$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.revoke_sessions_for_identity_security_change() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER identities_revoke_sessions_trigger
AFTER UPDATE ON public.identities
FOR EACH ROW
EXECUTE FUNCTION public.revoke_sessions_for_identity_security_change();
--> statement-breakpoint
CREATE FUNCTION public.revoke_sessions_for_membership_state_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status::text <> 'active' THEN
    UPDATE public.auth_sessions AS sessions
    SET
      revoked_at = GREATEST(CURRENT_TIMESTAMP, sessions.created_at),
      revoked_reason = 'membership_inactive',
      updated_at = GREATEST(sessions.updated_at, CURRENT_TIMESTAMP, sessions.created_at)
    WHERE sessions.tenant_id = NEW.tenant_id
      AND sessions.membership_id = NEW.id
      AND sessions.identity_id = NEW.identity_id
      AND sessions.revoked_at IS NULL;
  END IF;

  RETURN NEW;
END;
$function$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.revoke_sessions_for_membership_state_change() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER tenant_memberships_revoke_sessions_trigger
AFTER UPDATE ON public.tenant_memberships
FOR EACH ROW
EXECUTE FUNCTION public.revoke_sessions_for_membership_state_change();
--> statement-breakpoint
CREATE FUNCTION public.revoke_sessions_for_tenant_state_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status::text <> 'active' THEN
    UPDATE public.auth_sessions AS sessions
    SET
      revoked_at = GREATEST(CURRENT_TIMESTAMP, sessions.created_at),
      revoked_reason = 'tenant_inactive',
      updated_at = GREATEST(sessions.updated_at, CURRENT_TIMESTAMP, sessions.created_at)
    WHERE sessions.tenant_id = NEW.id
      AND sessions.revoked_at IS NULL;
  END IF;

  RETURN NEW;
END;
$function$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.revoke_sessions_for_tenant_state_change() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER tenants_revoke_sessions_trigger
AFTER UPDATE ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.revoke_sessions_for_tenant_state_change();
--> statement-breakpoint
UPDATE public.auth_sessions AS sessions
SET
  revoked_at = COALESCE(
    sessions.revoked_at,
    GREATEST(CURRENT_TIMESTAMP, sessions.created_at)
  ),
  revoked_reason = COALESCE(sessions.revoked_reason, 'identity_v2_cutover'),
  updated_at = GREATEST(sessions.updated_at, CURRENT_TIMESTAMP, sessions.created_at);
--> statement-breakpoint
DO $postflight$
DECLARE
  mismatch_count bigint;
  unvalidated_count bigint;
  disabled_trigger_count bigint;
BEGIN
  SELECT count(*)
  INTO mismatch_count
  FROM public.auth_sessions AS sessions
  LEFT JOIN public.identities AS identities
    ON identities.id = sessions.identity_id
  LEFT JOIN public.tenant_memberships AS memberships
    ON memberships.tenant_id = sessions.tenant_id
    AND memberships.id = sessions.membership_id
    AND memberships.identity_id = sessions.identity_id
  WHERE sessions.identity_id IS NULL
    OR sessions.membership_id IS NULL
    OR sessions.tenant_id IS NULL
    OR identities.id IS NULL
    OR memberships.id IS NULL
    OR sessions.expires_at > sessions.absolute_expires_at
    OR sessions.revoked_at IS NULL
    OR sessions.revoked_reason IS NULL
    OR sessions.revoked_at < sessions.created_at
    OR sessions.revoked_at > sessions.updated_at;

  SELECT count(*)
  INTO unvalidated_count
  FROM unnest(ARRAY[
    'auth_sessions_identity_fk',
    'auth_sessions_tenant_membership_identity_fk',
    'auth_sessions_legacy_user_context_check',
    'auth_sessions_refresh_token_hash_format_check',
    'auth_sessions_timestamp_order_check'
  ]) AS expected(conname)
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint AS constraints
    WHERE constraints.conrelid = 'public.auth_sessions'::regclass
      AND constraints.conname = expected.conname
      AND constraints.convalidated
  );

  SELECT count(*)
  INTO disabled_trigger_count
  FROM unnest(ARRAY[
    'auth_sessions_context_trigger',
    'tenant_memberships_immutable_principal_trigger',
    'identities_security_epoch_trigger',
    'identities_revoke_sessions_trigger',
    'tenant_memberships_revoke_sessions_trigger',
    'tenants_revoke_sessions_trigger'
  ]) AS expected(tgname)
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_trigger AS triggers
    WHERE triggers.tgname = expected.tgname
      AND NOT triggers.tgisinternal
      AND triggers.tgenabled = 'O'
  );

  IF mismatch_count <> 0 OR unvalidated_count <> 0 OR disabled_trigger_count <> 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'integrity_constraint_violation',
      MESSAGE = format(
        'Authentication Phase B postflight failed: data=%s, constraints=%s, triggers=%s',
        mismatch_count,
        unvalidated_count,
        disabled_trigger_count
      );
  END IF;
END;
$postflight$;
--> statement-breakpoint
COMMENT ON TRIGGER auth_sessions_context_trigger ON public.auth_sessions IS
  'Phase B compatibility bridge for legacy auth-session writers. Remove only after the rollback window closes.';
