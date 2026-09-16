-- Multi-level header menu (up to 3 levels) — page_id becomes optional (a
-- category-header item with children and no linked page) and parent_id
-- self-references menu_items for the tree. submenu_mobile_style drives
-- accordion vs flyout presentation in side-nav/mobile layouts.
ALTER TABLE "menu_items" ALTER COLUMN "page_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "parent_id" text REFERENCES "menu_items"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "site_settings" ADD COLUMN "submenu_mobile_style" text DEFAULT 'accordion' NOT NULL;
