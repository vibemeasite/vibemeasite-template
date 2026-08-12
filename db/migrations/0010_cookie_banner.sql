ALTER TABLE "site_settings" ADD COLUMN "cookie_banner_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "cookie_banner_message" text;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "cookie_banner_accept_label" text;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "cookie_banner_reject_label" text;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "cookie_banner_policy_url" text;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "cookie_banner_position" text DEFAULT 'bar' NOT NULL;
