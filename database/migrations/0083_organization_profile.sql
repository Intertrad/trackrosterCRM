ALTER TABLE "organizations"
  ADD COLUMN "short_name" varchar(100),
  ADD COLUMN "phone" varchar(80),
  ADD COLUMN "email" varchar(320),
  ADD COLUMN "website" varchar(500),
  ADD COLUMN "address" text,
  ADD COLUMN "color" varchar(7) DEFAULT '#05124A',
  ADD COLUMN "currency" varchar(3) DEFAULT 'EUR',
  ADD COLUMN "argumentaire" text,
  ADD COLUMN "prospected_sectors" text[] NOT NULL DEFAULT ARRAY[]::text[];
--> statement-breakpoint
ALTER TABLE "organizations"
  ADD CONSTRAINT "organizations_color_hex_check" CHECK ("color" IS NULL OR "color" ~ '^#[0-9A-Fa-f]{6}$'),
  ADD CONSTRAINT "organizations_currency_code_check" CHECK ("currency" IS NULL OR "currency" ~ '^[A-Za-z]{3}$');
