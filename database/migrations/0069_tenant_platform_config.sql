ALTER TABLE tenants ADD COLUMN IF NOT EXISTS platform_config jsonb NOT NULL DEFAULT '{}'::jsonb;
