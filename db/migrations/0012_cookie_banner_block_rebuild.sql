ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "cookie_banner_message";--> statement-breakpoint
ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "cookie_banner_accept_label";--> statement-breakpoint
ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "cookie_banner_reject_label";--> statement-breakpoint
ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "cookie_banner_policy_url";--> statement-breakpoint
ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "cookie_banner_position";--> statement-breakpoint
ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "cookie_banner_reopen_enabled";--> statement-breakpoint
ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "cookie_banner_reopen_position";--> statement-breakpoint
ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "cookie_banner_reopen_icon";
