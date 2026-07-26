ALTER TABLE "pages" ADD COLUMN "in_scroll" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "layout_mode" text DEFAULT 'multi-page' NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "logo_url" text;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "logo_svg" text;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "custom_links" jsonb;