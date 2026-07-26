ALTER TABLE "site_settings" ADD COLUMN "staging_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "paused" boolean DEFAULT false NOT NULL;