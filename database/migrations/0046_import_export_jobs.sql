CREATE TABLE "export_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"requester_id" uuid NOT NULL,
	"status" varchar(16) DEFAULT 'queued' NOT NULL,
	"request" jsonb NOT NULL,
	"authority_hash" varchar(64) NOT NULL,
	"filename" varchar(255),
	"content_type" varchar(128),
	"content_base64" text,
	"row_count" integer,
	"failure_code" varchar(64),
	"attempts" integer DEFAULT 0 NOT NULL,
	"lease_id" uuid,
	"lease_until" timestamp with time zone,
	"download_hash" varchar(64),
	"download_expires_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "export_jobs_status_check" CHECK ("export_jobs"."status" IN ('queued','processing','completed','failed','cancelled','expired'))
);
--> statement-breakpoint
CREATE TABLE "import_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"import_id" uuid NOT NULL,
	"row_id" uuid NOT NULL,
	"code" varchar(64) NOT NULL,
	"severity" varchar(16) NOT NULL,
	"message" text NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "import_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"requester_id" uuid NOT NULL,
	"status" varchar(16) DEFAULT 'draft' NOT NULL,
	"filename" varchar(255),
	"file_hash" varchar(64),
	"headers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"records" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"mapping" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "import_jobs_tenant_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "import_jobs_status_check" CHECK ("import_jobs"."status" IN ('draft','uploaded','validated','committed','cancelled'))
);
--> statement-breakpoint
CREATE TABLE "import_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"import_id" uuid NOT NULL,
	"row_number" integer NOT NULL,
	"data" jsonb NOT NULL,
	"resolution" varchar(24),
	"existing_id" uuid,
	"establishment_id" uuid,
	"contact_id" uuid,
	"result" varchar(16),
	CONSTRAINT "import_rows_tenant_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "import_rows_job_number_unique" UNIQUE("tenant_id","import_id","row_number")
);
--> statement-breakpoint
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_tenant_id_requester_id_tenant_memberships_tenant_id_id_fk" FOREIGN KEY ("tenant_id","requester_id") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_issues" ADD CONSTRAINT "import_issues_tenant_id_row_id_import_rows_tenant_id_id_fk" FOREIGN KEY ("tenant_id","row_id") REFERENCES "public"."import_rows"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_issues" ADD CONSTRAINT "import_issues_tenant_id_import_id_import_jobs_tenant_id_id_fk" FOREIGN KEY ("tenant_id","import_id") REFERENCES "public"."import_jobs"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_tenant_id_requester_id_tenant_memberships_tenant_id_id_fk" FOREIGN KEY ("tenant_id","requester_id") REFERENCES "public"."tenant_memberships"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_tenant_id_import_id_import_jobs_tenant_id_id_fk" FOREIGN KEY ("tenant_id","import_id") REFERENCES "public"."import_jobs"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "export_jobs_queue_idx" ON "export_jobs" USING btree ("status","lease_until","created_at");--> statement-breakpoint
CREATE INDEX "export_jobs_owner_idx" ON "export_jobs" USING btree ("tenant_id","requester_id","id");--> statement-breakpoint
CREATE INDEX "import_issues_job_idx" ON "import_issues" USING btree ("tenant_id","import_id","id");--> statement-breakpoint
CREATE INDEX "import_jobs_list_idx" ON "import_jobs" USING btree ("tenant_id","id");--> statement-breakpoint
CREATE INDEX "import_rows_job_idx" ON "import_rows" USING btree ("tenant_id","import_id","row_number");