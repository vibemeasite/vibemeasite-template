-- Migration 0019: blog_categories table (BSA Phase 22). A blog POST needs
-- no schema change at all — it's a `pages` row with metadata inline on the
-- existing `seo_meta` column (see db/schema.ts's comment above pages/
-- blogCategories). Hand-written, no drizzle-kit snapshot, same as
-- 0014-0015/0018 (see meta/_journal.json).
CREATE TABLE IF NOT EXISTS "blog_categories" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"parent_slug" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
