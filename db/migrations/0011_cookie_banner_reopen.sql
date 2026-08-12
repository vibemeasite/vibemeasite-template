ALTER TABLE "site_settings" ADD COLUMN "cookie_banner_reopen_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "cookie_banner_reopen_position" text DEFAULT 'bottom-right' NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "cookie_banner_reopen_icon" text;
