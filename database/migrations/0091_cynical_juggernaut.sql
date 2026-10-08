/* The previous defaults were English ('en'). English is now an explicit
 * dropdown choice (en-GB), so migrate legacy default rows to French. */
UPDATE "account_settings" SET "locale" = 'fr-FR' WHERE "locale" = 'en';--> statement-breakpoint
UPDATE "tenant_settings" SET "locale" = 'fr' WHERE "locale" = 'en';--> statement-breakpoint
ALTER TABLE "account_settings" ALTER COLUMN "locale" SET DEFAULT 'fr-FR';--> statement-breakpoint
ALTER TABLE "tenant_settings" ALTER COLUMN "locale" SET DEFAULT 'fr';
