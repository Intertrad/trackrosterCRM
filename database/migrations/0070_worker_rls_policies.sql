-- RLS for worker-owned tenant tables. FORCE RLS is intentionally deferred
-- until the runtime role is separated from the migration/table owner.
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'webhooks', 'webhook_deliveries',
    'scheduled_reports', 'scheduled_report_deliveries',
    'evidence_exports', 'audit_events', 'notifications',
    'prospect_follow_ups'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', table_name || '_tenant_isolation', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (tenant_id = NULLIF(current_setting(''trackroster.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting(''trackroster.tenant_id'', true), '''')::uuid)',
      table_name || '_tenant_isolation', table_name
    );
  END LOOP;
END $$;
