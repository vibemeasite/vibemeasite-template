ALTER TABLE "site_settings" ADD COLUMN "logo_href" text DEFAULT '/' NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "header_cta" jsonb;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "body_css" text;
