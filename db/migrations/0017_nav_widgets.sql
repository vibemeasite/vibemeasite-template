-- BSA Phase 21 — breadcrumbs, side menu, and the entities.mount_page_slug
-- sync needed to render an entity-aware breadcrumb segment. Idempotent-style
-- (IF NOT EXISTS everywhere) even though this only ever runs once per fresh
-- site via runSiteMigrations — matches every other migration's convention.
ALTER TABLE "site_settings" ADD COLUMN "breadcrumbs_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "breadcrumbs_style" text DEFAULT 'chevron' NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "side_menu_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "side_menu_pages" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
CREATE TABLE "side_menu_items" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"kind" text NOT NULL,
	"target" text NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "entities" ADD COLUMN "mount_page_slug" text;
